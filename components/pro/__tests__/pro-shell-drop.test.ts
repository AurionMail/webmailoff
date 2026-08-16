import { describe, expect, it } from 'vitest';
import {
  dragKindFromTypes,
  paneOnSide,
  parseEmailIdsPayload,
  resolveBodyDropTarget,
  PRO_TAB_DRAG_MIME,
  EMAIL_IDS_DRAG_MIME,
  SPLIT_EDGE_FRACTION,
} from '@/components/pro/pro-shell-drop';

describe('dragKindFromTypes', () => {
  it('recognises tab and email drags, tab winning when both are present', () => {
    expect(dragKindFromTypes([PRO_TAB_DRAG_MIME])).toBe('tab');
    expect(dragKindFromTypes([EMAIL_IDS_DRAG_MIME, 'text/plain'])).toBe('email');
    expect(dragKindFromTypes([EMAIL_IDS_DRAG_MIME, PRO_TAB_DRAG_MIME])).toBe('tab');
    expect(dragKindFromTypes(['text/plain', 'Files'])).toBeNull();
  });
});

describe('parseEmailIdsPayload', () => {
  it('parses id arrays and rejects malformed payloads', () => {
    expect(parseEmailIdsPayload('["a","b"]')).toEqual(['a', 'b']);
    expect(parseEmailIdsPayload('["a", 42, "", "b"]')).toEqual(['a', 'b']);
    expect(parseEmailIdsPayload('{"not":"an array"}')).toEqual([]);
    expect(parseEmailIdsPayload('not json')).toEqual([]);
    expect(parseEmailIdsPayload('')).toEqual([]);
  });
});

describe('paneOnSide', () => {
  it('maps a visual side to the pane rendered there', () => {
    expect(paneOnSide('left', 'right')).toBe('main');
    expect(paneOnSide('right', 'right')).toBe('split');
    expect(paneOnSide('left', 'left')).toBe('split');
    expect(paneOnSide('right', 'left')).toBe('main');
  });
});

describe('resolveBodyDropTarget - no split', () => {
  const base = { isSplit: false, splitSide: 'right' as const, canCreateSplit: true };

  it('edge zones create a split on that side', () => {
    expect(resolveBodyDropTarget({ ...base, xFrac: 0.05, kind: 'tab' }))
      .toEqual({ type: 'create-split', side: 'left' });
    expect(resolveBodyDropTarget({ ...base, xFrac: 0.95, kind: 'email' }))
      .toEqual({ type: 'create-split', side: 'right' });
    // Exactly on the threshold still counts as the edge.
    expect(resolveBodyDropTarget({ ...base, xFrac: SPLIT_EDGE_FRACTION, kind: 'tab' }))
      .toEqual({ type: 'create-split', side: 'left' });
  });

  it('the middle of the body is not a target', () => {
    expect(resolveBodyDropTarget({ ...base, xFrac: 0.5, kind: 'tab' })).toBeNull();
    expect(resolveBodyDropTarget({ ...base, xFrac: 0.5, kind: 'email' })).toBeNull();
  });

  it('refuses to create an impossible split (dragging the only tab)', () => {
    expect(resolveBodyDropTarget({ ...base, xFrac: 0.05, kind: 'tab', canCreateSplit: false }))
      .toBeNull();
  });

  it('clamps out-of-range positions', () => {
    expect(resolveBodyDropTarget({ ...base, xFrac: -0.3, kind: 'email' }))
      .toEqual({ type: 'create-split', side: 'left' });
    expect(resolveBodyDropTarget({ ...base, xFrac: 1.4, kind: 'email' }))
      .toEqual({ type: 'create-split', side: 'right' });
  });
});

describe('resolveBodyDropTarget - split active', () => {
  const base = { isSplit: true, canCreateSplit: true };

  it('each half targets the pane rendered there (split on the right)', () => {
    expect(resolveBodyDropTarget({ ...base, splitSide: 'right', xFrac: 0.25, kind: 'email' }))
      .toEqual({ type: 'pane', pane: 'main', side: 'left' });
    expect(resolveBodyDropTarget({ ...base, splitSide: 'right', xFrac: 0.75, kind: 'email' }))
      .toEqual({ type: 'pane', pane: 'split', side: 'right' });
  });

  it('side mapping follows the persisted splitSide (split on the left)', () => {
    expect(resolveBodyDropTarget({ ...base, splitSide: 'left', xFrac: 0.25, kind: 'email' }))
      .toEqual({ type: 'pane', pane: 'split', side: 'left' });
    expect(resolveBodyDropTarget({ ...base, splitSide: 'left', xFrac: 0.75, kind: 'email' }))
      .toEqual({ type: 'pane', pane: 'main', side: 'right' });
  });

  it('a tab hovering its own pane is not a target (no-op move)', () => {
    expect(resolveBodyDropTarget({
      ...base, splitSide: 'right', xFrac: 0.25, kind: 'tab', draggedTabPane: 'main',
    })).toBeNull();
    expect(resolveBodyDropTarget({
      ...base, splitSide: 'right', xFrac: 0.75, kind: 'tab', draggedTabPane: 'main',
    })).toEqual({ type: 'pane', pane: 'split', side: 'right' });
  });

  it('emails can drop on either pane regardless of source', () => {
    expect(resolveBodyDropTarget({ ...base, splitSide: 'right', xFrac: 0.25, kind: 'email' }))
      .not.toBeNull();
    expect(resolveBodyDropTarget({ ...base, splitSide: 'right', xFrac: 0.75, kind: 'email' }))
      .not.toBeNull();
  });
});
