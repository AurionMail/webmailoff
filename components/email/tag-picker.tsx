"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { buildKeywordTree, type KeywordNode } from "@/lib/keyword-nesting";
import { useKeywordFormat } from "@/hooks/use-keyword-format";

/** Below this many tags a filter box costs more room than it saves. */
const SEARCH_THRESHOLD = 10;

/**
 * The list of tags to apply to a message.
 *
 * Shared by all four places one appears - the toolbar popover, the overflow
 * flyout, the mobile sheet and the context menu - because they had drifted into
 * four different dot sizes, check alignments and separators, and only one of
 * them capped its height.
 *
 * Nested tags are drawn as a tree rather than repeating the parent's name on
 * every child. Filtering flattens it: with a query the hierarchy is noise, and
 * the full path is what gets matched.
 */
export function TagPicker({
  selectedIds,
  onToggle,
  onClearAll,
  touch = false,
}: {
  selectedIds: string[];
  onToggle: (tagId: string) => void;
  onClearAll?: () => void;
  /** Larger hit areas for the mobile sheet. */
  touch?: boolean;
}) {
  const t = useTranslations("email_viewer");
  const keywords = useSettingsStore((state) => state.emailKeywords);
  const nestedTags = useSettingsStore((state) => state.nestedTags);
  const { tagName, tagColor } = useKeywordFormat();
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim().toLowerCase();
  const showSearch = keywords.length >= SEARCH_THRESHOLD;

  const matches = useMemo(
    () =>
      trimmedQuery
        ? keywords.filter((keyword) => tagName(keyword.id).toLowerCase().includes(trimmedQuery))
        : [],
    // `tagName` is rebuilt whenever the definitions or the nesting setting change.
    [keywords, trimmedQuery, tagName],
  );

  const tree = useMemo(
    () => (nestedTags ? buildKeywordTree(keywords) : keywords.map((k) => ({ ...k, children: [], depth: 0 }))),
    [keywords, nestedTags],
  );

  const rowClass = cn(
    "w-full text-start flex items-center gap-2 hover:bg-muted cursor-pointer",
    touch ? "px-4 py-2.5 min-h-[44px] text-sm gap-3" : "px-3 py-1.5 text-sm",
  );
  const dotClass = touch ? "w-3.5 h-3.5" : "w-3 h-3";
  const checkClass = touch ? "w-4 h-4" : "w-3.5 h-3.5";

  const renderRow = (id: string, label: string) => {
    const isActive = selectedIds.includes(id);
    return (
      <button
        key={id}
        type="button"
        role="menuitemcheckbox"
        aria-checked={isActive}
        onClick={() => onToggle(id)}
        className={cn(rowClass, isActive && "bg-accent font-medium")}
        title={tagName(id)}
      >
        <span className={cn("rounded-full flex-shrink-0", dotClass, tagColor(id).dot)} />
        <span className="flex-1 min-w-0 truncate">{label}</span>
        {isActive && <Check className={cn("ms-auto flex-shrink-0 text-foreground", checkClass)} />}
      </button>
    );
  };

  const renderBranch = (nodes: KeywordNode[]) =>
    nodes.map((node) => (
      <div key={node.id}>
        {renderRow(node.id, node.depth === 0 ? tagName(node.id) : node.label)}
        {node.children.length > 0 && <div className="ps-4">{renderBranch(node.children)}</div>}
      </div>
    ));

  return (
    <>
      {showSearch && (
        <div className={cn("relative", touch ? "px-3 pb-2" : "px-2 pb-1")}>
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("tag_filter_placeholder")}
            aria-label={t("tag_filter_placeholder")}
            className="w-full ps-8 pe-2 py-1 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div className="max-h-[min(20rem,60vh)] overflow-y-auto">
        {trimmedQuery ? (
          matches.length > 0 ? (
            matches.map((keyword) => renderRow(keyword.id, tagName(keyword.id)))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">{t("tag_no_matches")}</p>
          )
        ) : (
          renderBranch(tree)
        )}
      </div>

      {onClearAll && selectedIds.length > 0 && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            type="button"
            onClick={onClearAll}
            className={cn(rowClass, "text-muted-foreground")}
          >
            <X className={cn("flex-shrink-0", touch ? "w-4 h-4" : "w-3 h-3")} />
            <span>{t("remove_tag")}</span>
          </button>
        </>
      )}
    </>
  );
}
