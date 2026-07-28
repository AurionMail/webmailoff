"use client";

import { useMemo } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { formatKeyword, formatKeywordLabels, keywordRenderings } from "@/lib/keyword-format";

/**
 * Names tags for the screen, bound to the user's tag settings.
 *
 * Resolving the definitions and the nesting setting here rather than at every
 * call site means no caller can forget the setting and render a nested name to
 * someone who never asked for nesting. Subscribing to it also keeps names in
 * step the moment it is toggled: reading it straight from the store inside the
 * formatter would leave every list showing stale names until something else
 * happened to re-render them.
 */
export function useKeywordFormat() {
  const keywords = useSettingsStore((state) => state.emailKeywords);
  const nested = useSettingsStore((state) => state.nestedTags);

  return useMemo(
    () => ({
      /** The tag's display name. */
      tagName: (id: string) => formatKeyword(id, keywords, nested),
      /** Its progressively shorter forms, longest first, for `useShortenedText`. */
      tagNameCandidates: (id: string) => keywordRenderings(formatKeywordLabels(id, keywords, nested)),
    }),
    [keywords, nested],
  );
}
