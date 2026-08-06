import { CalendarApp } from "@/components/calendar/calendar-app";

// Calendar permalinks (#733):
//   /calendar                        the stored view, today
//   /calendar/<view>/<YYYY-MM-DD>    a view anchored on a date
//   /calendar/event/<eventId>        one event, with ?calendar=<id> to
//                                    disambiguate across accounts
export default async function CalendarRoute({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  return <CalendarApp linkSegments={segments ?? []} />;
}
