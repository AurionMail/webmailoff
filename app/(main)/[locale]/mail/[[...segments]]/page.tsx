import { MailApp } from "@/components/mail/mail-app";

// Permalinks into the mail client (#733):
//   /mail                        the list
//   /mail/folder/<role|id>       a mailbox
//   /mail/message/<emailId>      one message
//   /mail/thread/<threadId>      a conversation
//
// Every one of them renders the same client shell as "/" - the segments are
// an intent the shell applies once its JMAP session is up, not a different
// page. Unknown segments are ignored and the shell falls back to the list, so
// stale links degrade instead of 404ing.
export default async function MailDeepLinkRoute({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  return <MailApp linkSegments={segments ?? []} />;
}
