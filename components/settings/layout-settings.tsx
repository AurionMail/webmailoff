"use client";

import { useTranslations } from 'next-intl';
import { useSettingsStore, type ToolbarPosition, type MailLayout } from '@/stores/settings-store';
import { SettingsSection, SettingItem, RadioGroup, ToggleSwitch } from './settings-section';
import { cn } from '@/lib/utils';
import { usePolicyStore } from '@/stores/policy-store';
import { useAccountStore } from '@/stores/account-store';

const MAIL_LAYOUT_PREVIEW_ROWS = [
  { sender: 'Alice', subject: 'Quarterly roadmap', preview: 'The draft is ready for review.', selected: false },
  { sender: 'Nadia', subject: 'Design sync', preview: 'Pushed updated mocks and notes.', selected: true },
  { sender: 'Billing', subject: 'Invoice 1042', preview: 'Your receipt is attached.', selected: false },
];

const MAIL_LAYOUT_PREVIEW_ROWS_FOCUS = [
  ...MAIL_LAYOUT_PREVIEW_ROWS,
  { sender: 'Sam', subject: 'Lunch?', preview: '', selected: false },
  { sender: 'Newsletter', subject: 'Weekly digest', preview: '', selected: false },
];

function MailLayoutPreview({
  value,
  t,
}: {
  value: MailLayout;
  t: (key: string) => string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-3">
      <div>
        <div className="text-sm font-medium text-foreground">{t(`mail_layout.${value}`)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{t(`mail_layout.${value}_description`)}</div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-muted/20">
        <div className="flex h-28">
          <div className="w-11 border-r border-border bg-muted/40" />

          {value === 'split' && (
            <>
              <div className="w-28 border-r border-border bg-background">
                {MAIL_LAYOUT_PREVIEW_ROWS.map((row) => (
                  <div
                    key={row.subject}
                    className={cn(
                      'border-b border-border px-2 py-1.5 text-[10px] last:border-b-0',
                      row.selected && 'bg-primary/10'
                    )}
                  >
                    <div className="truncate font-medium text-foreground">{row.sender}</div>
                    <div className="truncate text-muted-foreground">{row.subject}</div>
                  </div>
                ))}
              </div>
              <div className="flex-1 bg-background px-3 py-2">
                <div className="h-2.5 w-20 rounded bg-foreground/10" />
                <div className="mt-2 h-2 w-full rounded bg-foreground/10" />
                <div className="mt-1.5 h-2 w-5/6 rounded bg-foreground/10" />
                <div className="mt-1.5 h-2 w-2/3 rounded bg-foreground/10" />
              </div>
            </>
          )}

          {value === 'focus' && (
            <div className="flex-1 bg-background">
              {MAIL_LAYOUT_PREVIEW_ROWS_FOCUS.map((row) => (
                <div
                  key={row.subject}
                  className={cn(
                    'border-b border-border px-2 py-1 text-[10px] last:border-b-0',
                    row.selected && 'bg-primary/10'
                  )}
                >
                  <div className="truncate text-foreground">
                    <span className="font-medium">{row.sender}</span>
                    <span className="mx-1.5 text-muted-foreground">{row.subject}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {value === 'horizontal' && (
            <div className="flex-1 flex flex-col bg-background">
              <div className="border-b border-border bg-background">
                {MAIL_LAYOUT_PREVIEW_ROWS.map((row) => (
                  <div
                    key={row.subject}
                    className={cn(
                      'border-b border-border px-2 py-1 text-[10px] last:border-b-0',
                      row.selected && 'bg-primary/10'
                    )}
                  >
                    <div className="truncate text-foreground">
                      <span className="font-medium">{row.sender}</span>
                      <span className="mx-1.5 text-muted-foreground">{row.subject}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-1 bg-background px-3 py-2">
                <div className="h-2 w-20 rounded bg-foreground/10" />
                <div className="mt-1.5 h-1.5 w-full rounded bg-foreground/10" />
                <div className="mt-1 h-1.5 w-5/6 rounded bg-foreground/10" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LayoutSettings() {
  const t = useTranslations('settings.appearance');
  const tEmail = useTranslations('settings.email_behavior');
  const { toolbarPosition, showToolbarLabels, hideAccountSwitcher, showRailAccountList, enableUnifiedMailbox, colorfulSidebarIcons, mailLayout, proInterface, updateSetting } = useSettingsStore();
  const { isSettingLocked, isSettingHidden } = usePolicyStore();
  const accounts = useAccountStore(s => s.accounts);

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      {!isSettingHidden('mailLayout') && (
      <SettingItem label={tEmail('mail_layout.label')} description={tEmail('mail_layout.description')} locked={isSettingLocked('mailLayout')}>
        <div className="w-[22rem] max-w-full">
          <RadioGroup
            value={mailLayout}
            onChange={(value) => updateSetting('mailLayout', value as MailLayout)}
            options={[
              { value: 'split', label: tEmail('mail_layout.split') },
              { value: 'focus', label: tEmail('mail_layout.focus') },
              { value: 'horizontal', label: tEmail('mail_layout.horizontal') },
            ]}
          />
          <MailLayoutPreview value={mailLayout} t={tEmail} />
        </div>
      </SettingItem>
      )}

      <SettingItem label={t('toolbar_position.label')} description={t('toolbar_position.description')}>
        <RadioGroup
          value={toolbarPosition}
          onChange={(value) => updateSetting('toolbarPosition', value as ToolbarPosition)}
          options={[
            { value: 'top', label: t('toolbar_position.top') },
            { value: 'below-subject', label: t('toolbar_position.below_subject') },
          ]}
        />
      </SettingItem>

      <SettingItem label={t('toolbar_labels.label')} description={t('toolbar_labels.description')}>
        <ToggleSwitch
          checked={showToolbarLabels}
          onChange={(checked) => updateSetting('showToolbarLabels', checked)}
        />
      </SettingItem>

      <SettingItem label={t('hide_account_switcher.label')} description={t('hide_account_switcher.description')}>
        <ToggleSwitch
          checked={hideAccountSwitcher}
          onChange={(checked) => updateSetting('hideAccountSwitcher', checked)}
        />
      </SettingItem>

      <SettingItem label={t('show_rail_account_list.label')} description={t('show_rail_account_list.description')}>
        <ToggleSwitch
          checked={showRailAccountList}
          onChange={(checked) => updateSetting('showRailAccountList', checked)}
        />
      </SettingItem>

      <SettingItem label={t('colorful_sidebar_icons.label')} description={t('colorful_sidebar_icons.description')}>
        <ToggleSwitch
          checked={colorfulSidebarIcons}
          onChange={(checked) => updateSetting('colorfulSidebarIcons', checked)}
        />
      </SettingItem>

      {accounts.length > 1 && (
        <SettingItem
          label={t('unified_mailbox.label')}
          description={t('unified_mailbox.description')}
        >
          <ToggleSwitch
            checked={enableUnifiedMailbox}
            onChange={(v) => updateSetting('enableUnifiedMailbox', v)}
          />
        </SettingItem>
      )}

      <SettingItem label={t('pro_interface.label')} description={t('pro_interface.description')}>
        <ToggleSwitch
          checked={proInterface}
          onChange={(v) => updateSetting('proInterface', v)}
        />
      </SettingItem>
    </SettingsSection>
  );
}
