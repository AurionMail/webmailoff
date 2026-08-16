import type { ProPaneId, ProSplitSide } from "@/stores/pro-tab-store";

/** Custom MIME type used to carry the dragged Pro tab id between handlers. */
export const PRO_TAB_DRAG_MIME = "application/x-pro-tab-id";

/**
 * MIME type email rows put on the drag (see hooks/use-email-drag.ts). The
 * Pro shell accepts these so a message can be dragged straight into a pane
 * or an edge zone to open it there / split the screen with it.
 */
export const EMAIL_IDS_DRAG_MIME = "application/x-email-ids";

/** Fraction of the body width on each side that acts as a "create split" edge zone. */
export const SPLIT_EDGE_FRACTION = 0.2;

export type ShellDragKind = "tab" | "email";

export type BodyDropTarget =
  | { type: "pane"; pane: ProPaneId; side: ProSplitSide }
  | { type: "create-split"; side: ProSplitSide }
  | null;

/** Classify a drag by its payload types. Tab drags win over email drags. */
export function dragKindFromTypes(types: readonly string[]): ShellDragKind | null {
  if (types.includes(PRO_TAB_DRAG_MIME)) return "tab";
  if (types.includes(EMAIL_IDS_DRAG_MIME)) return "email";
  return null;
}

/** Which pane renders on a given visual side. */
export function paneOnSide(side: ProSplitSide, splitSide: ProSplitSide): ProPaneId {
  return side === splitSide ? "split" : "main";
}

/**
 * Pure resolution of a body-level drag position to a drop outcome.
 *
 *  - Split active: each half of the body targets the pane rendered there.
 *    A tab hovering its own pane resolves to null (moving a tab onto the
 *    pane it's already in is a no-op, so no drop affordance is shown).
 *  - No split: only the left/right edge zones are live - dropping there
 *    creates a split on that side. `canCreateSplit` is false when the drag
 *    could never produce two non-empty panes (e.g. dragging the only tab),
 *    which resolves to null so the browser shows no-drop feedback instead
 *    of silently ignoring the gesture.
 */
export function resolveBodyDropTarget(args: {
  /** Horizontal position within the panes container, 0..1. */
  xFrac: number;
  isSplit: boolean;
  splitSide: ProSplitSide;
  kind: ShellDragKind;
  canCreateSplit: boolean;
  /** For tab drags: the pane the dragged tab currently lives in. */
  draggedTabPane?: ProPaneId | null;
}): BodyDropTarget {
  const x = Math.min(1, Math.max(0, args.xFrac));

  if (args.isSplit) {
    const side: ProSplitSide = x < 0.5 ? "left" : "right";
    const pane = paneOnSide(side, args.splitSide);
    if (args.kind === "tab" && args.draggedTabPane === pane) return null;
    return { type: "pane", pane, side };
  }

  let side: ProSplitSide | null = null;
  if (x <= SPLIT_EDGE_FRACTION) side = "left";
  else if (x >= 1 - SPLIT_EDGE_FRACTION) side = "right";
  if (!side) return null;
  if (!args.canCreateSplit) return null;
  return { type: "create-split", side };
}

/** Parse the email-ids drag payload; returns [] for anything malformed. */
export function parseEmailIdsPayload(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}
