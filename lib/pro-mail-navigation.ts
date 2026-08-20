/**
 * Navigation requests into the Pro shell's Mail tab from surfaces outside it.
 *
 * A Pro email tab renders its own folder sidebar (Roundcube-style mail view);
 * clicking a folder there must steer the *Mail tab's* list. The Mail tab's
 * `MailApp` owns all the folder-selection logic (unified views, scheduled,
 * cross-account, keeping searches applied, ...), so instead of duplicating
 * it, the email tab focuses the Mail tab and publishes a request here that
 * the embedded MailApp handles with its own selection handlers.
 *
 * The deep-link handoff (lib/deep-link-handoff.ts) can't serve this: it is
 * consumed once on mount, and in the Pro shell the Mail tab's MailApp stays
 * mounted for the whole session.
 */
export type ProMailNavigationRequest =
  | {
      kind: 'mailbox';
      /** Connected-account id owning the folder; null = the active account. */
      accountId: string | null;
      mailboxId: string;
    }
  | { kind: 'tag'; keywordId: string | null };

type Listener = (request: ProMailNavigationRequest) => void;

const listeners = new Set<Listener>();

export function onProMailNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Publish a request. Returns false when no Mail tab is listening. */
export function requestProMailNavigation(request: ProMailNavigationRequest): boolean {
  if (listeners.size === 0) return false;
  for (const listener of [...listeners]) listener(request);
  return true;
}
