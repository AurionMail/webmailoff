import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/browser-navigation', () => ({ apiFetch }));

import { useSettingsStore } from '../settings-store';

describe('settings sync debounce', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    useSettingsStore.getState().disableSync();
    useSettingsStore.setState({ sendDelaySeconds: 0 });
  });

  it('flushes a pending snapshot for the account that scheduled it', async () => {
    const settings = useSettingsStore.getState();
    settings.enableSync('a@example.com', 'https://mail-a.example.com');
    settings.updateSetting('sendDelaySeconds', 10);

    await useSettingsStore.getState().flushSync();

    expect(apiFetch).toHaveBeenCalledTimes(1);
    const request = apiFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      username: 'a@example.com',
      serverUrl: 'https://mail-a.example.com',
      settings: { sendDelaySeconds: 10 },
    });
  });

  it('does not rewrite a pending account snapshot after another account becomes active', async () => {
    const settings = useSettingsStore.getState();
    settings.enableSync('a@example.com', 'https://mail-a.example.com');
    settings.updateSetting('sendDelaySeconds', 10);

    const flush = useSettingsStore.getState().flushSync();
    useSettingsStore.getState().disableSync();
    useSettingsStore.getState().enableSync('b@example.com', 'https://mail-b.example.com');
    useSettingsStore.getState().updateSetting('sendDelaySeconds', 30);
    await flush;

    const request = apiFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      username: 'a@example.com',
      settings: { sendDelaySeconds: 10 },
    });
  });
});
