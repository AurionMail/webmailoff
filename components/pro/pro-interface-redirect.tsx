"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSettingsStore } from "@/stores/settings-store";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useProTabStore, type ProTabKind } from "@/stores/pro-tab-store";

const STANDARD_PATH_TO_TAB: Record<string, Exclude<ProTabKind, 'compose' | 'email'>> = {
  '/': 'mail',
  '/calendar': 'calendar',
  '/contacts': 'contacts',
  '/files': 'files',
  '/settings': 'settings',
};

/**
 * When the Pro interface is enabled, the standard mail/calendar/contacts/
 * files/settings routes are taken over by the Pro shell — the user shouldn't
 * have to click "Open" in settings to land there. Mobile/tablet keeps the
 * standard layout because Pro is desktop-only (see pro/page.tsx).
 */
export function ProInterfaceRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const proInterface = useSettingsStore((s) => s.proInterface);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!proInterface || !isDesktop) return;
    const tabKind = STANDARD_PATH_TO_TAB[pathname];
    if (!tabKind) return;
    useProTabStore.getState().openTab(tabKind);
    router.replace('/pro');
  }, [proInterface, isDesktop, pathname, router]);

  return null;
}
