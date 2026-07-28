"use client";

import { cn } from "@/lib/utils";
import { useShortenedText } from "@/hooks/use-shortened-text";

/**
 * A tag name inside one of the tag pickers, shortened to what that picker has
 * room for.
 *
 * The pickers differ in width - a narrow popover, a context submenu, a
 * full-width mobile sheet - so each row measures itself instead of sharing one
 * cap. `candidates` runs longest first (see `keywordRenderings`); the full name
 * stays reachable through the tooltip.
 */
export function TagOptionLabel({
  candidates,
  className,
}: {
  candidates: string[];
  className?: string;
}) {
  const [labelRef, shortenedLabel] = useShortenedText(candidates);

  return (
    <span ref={labelRef} className={cn("min-w-0 truncate", className)} title={candidates[0]}>
      {shortenedLabel}
    </span>
  );
}
