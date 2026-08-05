import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JMAPClient } from '../jmap/client';

// The server advertises Contacts globally while the per-account
// accountCapabilities independently includes or omits it.
function makeSession(accountCapabilities: Record<string, unknown>, isPersonal = true, serverAdvertises = true) {
  return {
    capabilities: {
      'urn:ietf:params:jmap:core': {},
      ...(serverAdvertises ? { 'urn:ietf:params:jmap:contacts': {} } : {}),
    },
    accounts: {
      'acct-1': { name: 'test', isPersonal, accountCapabilities },
    },
    primaryAccounts: { 'urn:ietf:params:jmap:mail': 'acct-1' },
    apiUrl: 'https://mail.example.com/jmap/api',
    downloadUrl: 'https://mail.example.com/jmap/download/{accountId}/{blobId}/{name}',
    uploadUrl: 'https://mail.example.com/jmap/upload/{accountId}/',
    eventSourceUrl: 'https://mail.example.com/jmap/eventsource',
  };
}

function mockFetchResponse(status: number, body?: unknown): Response {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function connect(accountCapabilities: Record<string, unknown>, isPersonal = true, serverAdvertises = true): Promise<JMAPClient> {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  fetchSpy.mockResolvedValueOnce(mockFetchResponse(200, makeSession(accountCapabilities, isPersonal, serverAdvertises)));
  const client = new JMAPClient('https://mail.example.com', 'user@test.com', 'pass123');
  await client.connect();
  fetchSpy.mockReset();
  return client;
}

describe('JMAPClient.supportsContacts (account-scoped capability)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns true when the account advertises the contacts capability', async () => {
    const client = await connect({ 'urn:ietf:params:jmap:contacts': {} });
    expect(client.supportsContacts()).toBe(true);
  });

  it('returns false when the server advertises contacts but the account does not', async () => {
    const client = await connect({ 'urn:ietf:params:jmap:mail': {} });
    expect(client.supportsContacts()).toBe(false);
  });

  it('treats non-personal (shared/group) accounts as capable even without per-account advertisement', async () => {
    const client = await connect({}, /* isPersonal */ false);
    expect(client.supportsContacts()).toBe(true);
  });

  it('returns false for a shared account when the server does not advertise contacts', async () => {
    const client = await connect({}, /* isPersonal */ false, /* serverAdvertises */ false);
    expect(client.supportsContacts()).toBe(false);
  });
});
