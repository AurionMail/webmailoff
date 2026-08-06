import { describe, it, expect, vi } from 'vitest';
import type { InstalledPlugin } from '../plugin-types';

vi.mock('@/stores/toast-store', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// host-api pulls in the whole store layer; nothing asserted here reaches a
// store, but the module graph has to resolve.
import { dispatchApiCall } from '../plugin-sandbox/host-api';

function plugin(overrides: Partial<InstalledPlugin> = {}): InstalledPlugin {
  return {
    id: 'p1',
    name: 'Test plugin',
    version: '1.0.0',
    author: 'test',
    description: '',
    type: 'hook',
    permissions: [],
    entrypoint: 'index.js',
    enabled: true,
    status: 'running',
    settings: {},
    ...overrides,
  };
}

/**
 * Message of the rejection, or '' when the call got through. The gates are
 * what's under test; what happens afterwards needs an IndexedDB and a JMAP
 * session, so "did not fail at a gate" is the useful assertion for the
 * allowed cases.
 */
async function gateError(...args: Parameters<typeof dispatchApiCall>): Promise<string> {
  try {
    await dispatchApiCall(...args);
    return '';
  } catch (err) {
    return (err as Error).message;
  }
}

const GATE_FAILURE = /lacks permission|requires the privileged plugin tier|Unknown API method/;

/**
 * The staged-attachment API is the one place an untrusted plugin can touch the
 * bytes of a file the user is sending, so the read/write asymmetry is worth
 * pinning down: reading back a file it was just handed the id of is a normal
 * permission, replacing that file is privileged-tier only.
 */
describe('upfiles tier + permission gates', () => {
  it('refuses upfiles.get without email:blob-read', async () => {
    expect(await gateError(plugin(), 'upfiles.get', ['some-id']))
      .toMatch(/lacks permission "email:blob-read"/);
  });

  it('refuses upfiles.get when the permission is declared but not granted', async () => {
    const p = plugin({ permissions: ['email:blob-read'], grantedPermissions: [] });
    expect(await gateError(p, 'upfiles.get', ['some-id']))
      .toMatch(/lacks permission "email:blob-read"/);
  });

  it('allows upfiles.get for an untrusted plugin granted email:blob-read', async () => {
    const p = plugin({ permissions: ['email:blob-read'], grantedPermissions: ['email:blob-read'] });
    expect(await gateError(p, 'upfiles.get', ['some-id'])).not.toMatch(GATE_FAILURE);
  });

  it('refuses upfiles.save from an untrusted plugin even with email:blob-write', async () => {
    const p = plugin({ permissions: ['email:blob-write'], grantedPermissions: ['email:blob-write'] });
    expect(await gateError(p, 'upfiles.save', ['old-id', new File(['x'], 'x.txt')]))
      .toMatch(/requires the privileged plugin tier/);
  });

  it('lets a privileged plugin call upfiles.save', async () => {
    const p = plugin({ permissions: ['email:blob-write'], grantedPermissions: ['email:blob-write'] });
    const err = await gateError(p, 'upfiles.save', ['old-id', new File(['x'], 'x.txt')], { privileged: true });
    expect(err).not.toMatch(GATE_FAILURE);
  });

  it('keeps stored message blobs privileged-only', async () => {
    const p = plugin({ permissions: ['email:blob-read'], grantedPermissions: ['email:blob-read'] });
    expect(await gateError(p, 'jmap.fetchBlob', ['blob-1']))
      .toMatch(/requires the privileged plugin tier/);
  });
});

describe('method-name typos', () => {
  // Guards the class of bug this suite was added for: an entry in the
  // privileged set naming a method the dispatcher never sees, which gates
  // nothing while looking like it does.
  it('rejects a method with no entry in the permission map', async () => {
    expect(await gateError(plugin(), 'upfiles.set', ['x'])).toMatch(/Unknown API method/);
  });
});
