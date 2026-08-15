"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsSection, SettingItem, ToggleSwitch, Select } from './settings-section';
import { playNotificationSound, NOTIFICATION_SOUNDS } from '@/lib/notification-sound';
import type { NotificationSoundChoice } from '@/lib/notification-sound';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Lock, Volume2, XCircle } from 'lucide-react';
import { usePolicyStore } from '@/stores/policy-store';
import { useAuthStore } from '@/stores/auth-store';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import {
  DEFAULT_RELAY_BASE_URL,
  WebPushUnsupportedError,
  disableWebPush,
  enableWebPush,
  isWebPushEnabled,
  isWebPushSupported,
} from '@/lib/web-push';

type PushStatus =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'enabled' }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

export function NotificationSettings() {
  const t = useTranslations('settings.notifications');
  const {
    emailNotificationsEnabled,
    emailNotificationSound,
    notificationSoundChoice,
    calendarNotificationsEnabled,
    calendarNotificationSound,
    calendarInvitationParsingEnabled,
    updateSetting,
  } = useSettingsStore();
  const { isSettingLocked, isSettingHidden } = usePolicyStore();
  const adminPushRelayUrl = usePolicyStore((s) => s.policy.pushRelayUrl);
  const pushRelayLocked = usePolicyStore((s) => s.policy.pushRelayUrlLocked) === true;
  const client = useAuthStore((s) => s.client);
  const username = useAuthStore((s) => s.username);
  const { dialogProps: confirmDialogProps, confirm: confirmDialog } = useConfirmDialog();

  const supported = typeof window !== 'undefined' && isWebPushSupported();
  const adminUrl = (adminPushRelayUrl ?? '').trim();
  const [relayUrl, setRelayUrl] = useState(adminUrl || DEFAULT_RELAY_BASE_URL);
  const [pushStatus, setPushStatus] = useState<PushStatus>(
    supported ? { kind: 'idle' } : { kind: 'unsupported' },
  );

  // Pull the admin-configured URL into local state when policy loads/changes.
  // When locked, the admin value always wins; when only set (not locked), use
  // it as the initial default but let the user override.
  useEffect(() => {
    if (pushRelayLocked && adminUrl) {
      setRelayUrl(adminUrl);
    } else if (adminUrl) {
      setRelayUrl((current) => (current === DEFAULT_RELAY_BASE_URL ? adminUrl : current));
    }
  }, [adminUrl, pushRelayLocked]);

  useEffect(() => {
    if (!supported) return;
    if (!client) return;
    const accountId = client.getAccountId();
    if (!accountId) return;
    void (async () => {
      const enabled = await isWebPushEnabled(accountId);
      setPushStatus(enabled ? { kind: 'enabled' } : { kind: 'idle' });
    })();
  }, [supported, client]);

  const trimmedRelay = relayUrl.trim().replace(/\/+$/, '');
  const isValidRelay = /^https?:\/\/.+/i.test(trimmedRelay);
  const busy = pushStatus.kind === 'busy';

  const handleEnablePush = async () => {
    if (!client) {
      setPushStatus({ kind: 'error', message: 'Sign in first' });
      return;
    }
    if (!isValidRelay) {
      setPushStatus({ kind: 'error', message: 'Enter a valid https:// URL' });
      return;
    }
    setPushStatus({ kind: 'busy' });
    try {
      await enableWebPush({
        client,
        relayBaseUrl: trimmedRelay,
        accountLabel: username ?? undefined,
      });
      setPushStatus({ kind: 'enabled' });
    } catch (err) {
      if (err instanceof WebPushUnsupportedError) {
        setPushStatus({ kind: 'unsupported' });
        return;
      }
      setPushStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to enable push',
      });
    }
  };

  const handleDisablePush = async () => {
    if (!client) return;
    const confirmed = await confirmDialog({
      title: t('push.confirm_disable_title'),
      message: t('push.confirm_disable_message'),
      confirmText: t('push.disable'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    setPushStatus({ kind: 'busy' });
    try {
      await disableWebPush({ client, relayBaseUrl: trimmedRelay });
      setPushStatus({ kind: 'idle' });
    } catch (err) {
      setPushStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to disable push',
      });
    }
  };

  const soundOptions = NOTIFICATION_SOUNDS.map((s) => ({
    value: s.id,
    label: t(`sounds.${s.id}`),
  }));

  return (
    <div className="space-y-8">
      <SettingsSection title={t('push.title')} description={t('push.description')}>
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium inline-flex items-center gap-1.5" htmlFor="push-relay-url">
              {t('push.relay_label')}
              {pushRelayLocked && (
                <Lock className="w-3 h-3 text-muted-foreground" aria-label={t('push.relay_locked')} />
              )}
            </label>
            <PushStatusBadge status={pushStatus} t={t} />
          </div>
          <p className="text-xs text-muted-foreground">
            {pushRelayLocked ? t('push.relay_locked_desc') : t('push.relay_desc')}
          </p>
          <input
            id="push-relay-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={relayUrl}
            onChange={(e) => setRelayUrl(e.target.value)}
            placeholder={t('push.relay_placeholder')}
            disabled={busy || pushStatus.kind === 'unsupported' || pushRelayLocked}
            readOnly={pushRelayLocked}
            className="w-full rounded border bg-background px-3 py-2 text-sm disabled:opacity-50"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleEnablePush}
              disabled={busy || pushStatus.kind === 'unsupported' || !isValidRelay || !client}
            >
              {pushStatus.kind === 'enabled' ? t('push.reenable') : t('push.enable')}
            </Button>
            {pushStatus.kind === 'enabled' && (
              <Button variant="outline" onClick={handleDisablePush} disabled={busy}>
                {t('push.disable')}
              </Button>
            )}
          </div>
          {pushStatus.kind === 'unsupported' && (
            <p className="text-xs text-muted-foreground">{t('push.ios_hint')}</p>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={t('sound_selection.title')} description={t('sound_selection.description')}>
        <SettingItem
          label={t('sound_selection.choose')}
          description={t('sound_selection.choose_desc')}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => playNotificationSound(notificationSoundChoice)}
              title={t('test_sound')}
            >
              <Volume2 className="w-4 h-4" />
            </Button>
            <Select
              value={notificationSoundChoice}
              onChange={(value) => {
                const choice = value as NotificationSoundChoice;
                updateSetting('notificationSoundChoice', choice);
                playNotificationSound(choice);
              }}
              options={soundOptions}
            />
          </div>
        </SettingItem>
      </SettingsSection>

      <SettingsSection title={t('email.title')} description={t('email.description')}>
        {!isSettingHidden('emailNotificationsEnabled') && (
        <SettingItem
          label={t('email.enabled')}
          description={t('email.enabled_desc')}
          locked={isSettingLocked('emailNotificationsEnabled')}
        >
          <ToggleSwitch
            checked={emailNotificationsEnabled}
            onChange={(checked) => updateSetting('emailNotificationsEnabled', checked)}
          />
        </SettingItem>
        )}

        <SettingItem
          label={t('email.sound')}
          description={t('email.sound_desc')}
        >
          <ToggleSwitch
            checked={emailNotificationSound}
            onChange={(checked) => updateSetting('emailNotificationSound', checked)}
            disabled={!emailNotificationsEnabled}
          />
        </SettingItem>
      </SettingsSection>

      <SettingsSection title={t('calendar.title')} description={t('calendar.description')}>
        {!isSettingHidden('calendarNotificationsEnabled') && (
        <SettingItem
          label={t('calendar.enabled')}
          description={t('calendar.enabled_desc')}
          locked={isSettingLocked('calendarNotificationsEnabled')}
        >
          <ToggleSwitch
            checked={calendarNotificationsEnabled}
            onChange={(checked) => updateSetting('calendarNotificationsEnabled', checked)}
          />
        </SettingItem>
        )}

        <SettingItem
          label={t('calendar.sound')}
          description={t('calendar.sound_desc')}
        >
          <ToggleSwitch
            checked={calendarNotificationSound}
            onChange={(checked) => updateSetting('calendarNotificationSound', checked)}
            disabled={!calendarNotificationsEnabled}
          />
        </SettingItem>

        <SettingItem
          label={t('calendar.invitation_parsing')}
          description={t('calendar.invitation_parsing_desc')}
        >
          <ToggleSwitch
            checked={calendarInvitationParsingEnabled}
            onChange={(checked) => updateSetting('calendarInvitationParsingEnabled', checked)}
          />
        </SettingItem>
      </SettingsSection>

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}

function PushStatusBadge({
  status,
  t,
}: {
  status: PushStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  if (status.kind === 'enabled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {t('push.status_active')}
      </span>
    );
  }
  if (status.kind === 'busy') {
    return <span className="text-xs text-muted-foreground">{t('push.status_busy')}</span>;
  }
  if (status.kind === 'unsupported') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <XCircle className="w-3.5 h-3.5" />
        {t('push.status_unsupported')}
      </span>
    );
  }
  if (status.kind === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive" title={status.message}>
        <XCircle className="w-3.5 h-3.5" />
        {status.message}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{t('push.status_inactive')}</span>;
}
