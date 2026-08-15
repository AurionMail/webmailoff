"use client";

import { Menu, ArrowLeft, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onCompose?: () => void;
  onSearch?: () => void;
  className?: string;
  /** Id of the sidebar this header's menu button toggles. */
  sidebarId?: string;
}

export function MobileHeader({
  title,
  showBack = false,
  onBack,
  onCompose,
  onSearch,
  className,
  sidebarId,
}: MobileHeaderProps) {
  const t = useTranslations('sidebar');
  const { toggleSidebar, goBack, sidebarOpen } = useUIStore();
  // Pane-aware: in Pro split mode the viewport is desktop-wide while the
  // pane is narrow. The Tailwind `lg:hidden` variant alone would never fire
  // there, so we additionally hide via JS when the surrounding pane is
  // desktop-sized. Outside of Pro this still returns the viewport value.
  const isPaneDesktop = useIsDesktop();
  if (isPaneDesktop) return null;

  const handleLeftAction = () => {
    if (showBack && onBack) {
      onBack();
    } else if (showBack) {
      goBack();
    } else {
      toggleSidebar();
    }
  };

  return (
    <header
      className={cn(
        "flex items-center justify-between px-4 h-14 border-b border-border bg-background shrink-0",
        className
      )}
    >
      {/* Left action: Menu or Back button */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLeftAction}
          className={cn(
            "h-11 w-11",
            !showBack && sidebarOpen && "bg-accent"
          )}
          data-sidebar-toggle={!showBack ? "" : undefined}
          aria-label={showBack ? t('mobile.go_back') : t('mobile.toggle_menu')}
          aria-expanded={!showBack ? sidebarOpen : undefined}
          aria-controls={!showBack ? sidebarId : undefined}
        >
          {showBack ? (
            <ArrowLeft className="h-5 w-5" />
          ) : sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>

        {/* Title */}
        <h1 className="font-semibold text-lg truncate">{title}</h1>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {onSearch && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSearch}
            className="h-11 w-11"
            aria-label={t('mobile.search')}
          >
            <Search className="h-5 w-5" />
          </Button>
        )}
        {onCompose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCompose}
            className="h-11 w-11 text-primary"
            aria-label={t('mobile.compose')}
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>
    </header>
  );
}

/**
 * Viewer header for mobile - shows when viewing an email
 */
interface MobileViewerHeaderProps {
  subject?: string;
  onBack: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  className?: string;
}

export function MobileViewerHeader({
  subject,
  onBack,
  onDelete: _onDelete,
  onArchive: _onArchive,
  className,
}: MobileViewerHeaderProps) {
  const t = useTranslations('sidebar');
  const isPaneDesktop = useIsDesktop();
  if (isPaneDesktop) return null;

  return (
    <header
      className={cn(
        "flex items-center justify-between px-2 h-14 border-b border-border bg-background shrink-0",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="h-11 w-11"
        aria-label={t('mobile.go_back')}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <h1 className="flex-1 font-medium text-sm truncate px-2 text-center">
        {subject || "(No Subject)"}
      </h1>

      <div className="flex items-center">
        {/* Placeholder for additional actions - kept minimal */}
        <div className="w-10" />
      </div>
    </header>
  );
}
