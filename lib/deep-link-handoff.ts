import type { AppSurface } from '@/lib/deep-links';

/**
 * One-shot handoff for a deep link that has to survive a route change (#733).
 *
 * The Pro shell owns a single route (`/pro`) and renders each surface inside a
 * tab, so a permalink like `/mail/message/<id>` can't reach the surface as a
 * route param: ProInterfaceRedirect intercepts it and replaces the URL. It
 * parks the segments here, opens the right tab, and the surface picks them up
 * on mount - exactly like `protocol-handlers/session` does for `mailto:`.
 *
 * Module state, deliberately: it must not survive a reload (the URL is gone by
 * then, so re-applying it would reopen something the user already closed).
 */
const pending = new Map<AppSurface, string[]>();

export function setPendingDeepLink(surface: AppSurface, segments: string[]): void {
  pending.set(surface, segments);
}

/** Returns the parked segments once, then forgets them. */
export function consumePendingDeepLink(surface: AppSurface): string[] | null {
  const segments = pending.get(surface);
  if (!segments) return null;
  pending.delete(surface);
  return segments;
}

export function clearPendingDeepLinks(): void {
  pending.clear();
}
