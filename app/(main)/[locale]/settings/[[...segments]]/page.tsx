import { SettingsApp } from "@/components/settings/settings-app";

// Settings permalinks (#733): /settings/<tabId>. Without a tab the page falls
// back to the last tab the user had open, as before.
export default async function SettingsRoute({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  return <SettingsApp linkSegments={segments ?? []} />;
}
