"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsSection, SettingItem, ToggleSwitch, Select } from './settings-section';
import { playNotificationSound, NOTIFICATION_SOUNDS } from '@/lib/notification-sound';
import type { NotificationSoundChoice } from '@/lib/notification-sound';
import { Button } from '@/components/ui/button';
import { Volume2, XCircle } from 'lucide-react';
import { usePolicyStore } from '@/stores/policy-store';
import { useAuthStore } from '@/stores/auth-store';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import {
  WebPushUnsupportedError,
  disableWebPush,
  enableWebPush,
  isWebPushEnabled,
  isWebPushSupported,
} from '@/lib/web-push';
import {
  resolveActiveRelayUrl,
  resolvePushRelayOptions,
} from '@/lib/push-relays';

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
    pushRelayUrl,
    updateSetting,
  } = useSettingsStore();
  const { isSettingLocked, isSettingHidden } = usePolicyStore();
  const policy = usePolicyStore((s) => s.policy);
  const pushRelayLocked = policy.pushRelayUrlLocked === true;
  const client = useAuthStore((s) => s.client);
  const username = useAuthStore((s) => s.username);
  const { dialogProps: confirmDialogProps, confirm: confirmDialog } = useConfirmDialog();

  const supported = typeof window !== 'undefined' && isWebPushSupported();
  const [pushStatus, setPushStatus] = useState<PushStatus>(
    supported ? { kind: 'idle' } : { kind: 'unsupported' },
  );

  // Relay URLs come from admin policy only - users pick one of the offered
  // relays, they never type a URL.
  const relayOptions = resolvePushRelayOptions(policy);
  const activeRelayUrl = resolveActiveRelayUrl(policy, pushRelayUrl);
  const relayChoiceFixed = pushRelayLocked || relayOptions.length < 2;
  const activeRelayLabel =
    relayOptions.find((option) => option.url === activeRelayUrl)?.label ?? activeRelayUrl;

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

  const busy = pushStatus.kind === 'busy';
  const pushEnabled = pushStatus.kind === 'enabled';
  const statusDescription = pushStatus.kind === 'unsupported'
    ? `${t('push.status_unsupported')} ${t('push.ios_hint')}`
    : busy
      ? t('push.status_busy')
      : pushEnabled
        ? t('push.status_active')
        : t('push.status_inactive');

  const handleEnablePush = async () => {
    if (!client) {
      setPushStatus({ kind: 'error', message: 'Sign in first' });
      return;
    }
    setPushStatus({ kind: 'busy' });
    try {
      await enableWebPush({
        client,
        relayBaseUrl: activeRelayUrl,
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
      await disableWebPush({ client, relayBaseUrl: activeRelayUrl });
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
        <SettingItem label={t('push.enable')} description={statusDescription}>
          <div className="flex items-center gap-2">
            {pushEnabled && (
              <Button variant="ghost" size="sm" onClick={handleEnablePush} disabled={busy}>
                {t('push.reenable')}
              </Button>
            )}
            <ToggleSwitch
              checked={pushEnabled}
              onChange={(checked) => void (checked ? handleEnablePush() : handleDisablePush())}
              disabled={busy || pushStatus.kind === 'unsupported' || !client}
            />
          </div>
        </SettingItem>

        <SettingItem
          label={t('push.relay_label')}
          description={pushRelayLocked ? t('push.relay_locked_desc') : t('push.relay_desc')}
          locked={pushRelayLocked}
        >
          {relayChoiceFixed ? (
            <span className="text-sm text-muted-foreground">{activeRelayLabel}</span>
          ) : (
            <Select
              value={activeRelayUrl}
              onChange={(value) => updateSetting('pushRelayUrl', value)}
              options={relayOptions.map((option) => ({ value: option.url, label: option.label }))}
              disabled={busy || pushStatus.kind === 'unsupported'}
            />
          )}
        </SettingItem>

        {pushStatus.kind === 'error' && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
            <XCircle className="w-3.5 h-3.5 mt-px shrink-0" />
            {pushStatus.message}
          </p>
        )}
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
