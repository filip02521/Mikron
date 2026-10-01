"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { cn } from "@/lib/cn";
import { ZK_PAGE_SECTION_COPY } from "@/lib/sales/zk-page-copy";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Rozwinięty formularz dodawania ZK — pełna szerokość paska narzędzi listy. */
export function ZkWatchAddInlineStrip({
  children,
  showCollapse = false,
  onCollapse,
  className,
}: {
  children: ReactNode;
  showCollapse?: boolean;
  onCollapse?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-slate-200/90 bg-white px-3 py-2.5 shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={cn(salesTypography.sectionLabel, "normal-case text-slate-700")}>
            {ZK_PAGE_SECTION_COPY.addTitle}
          </span>
          <HelpHintBubble
            message={ZK_PAGE_SECTION_COPY.addDescription}
            tone="slate"
            size="md"
            ariaLabel="Jak wpisać numer ZK"
          />
        </div>
        {showCollapse && onCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 shrink-0 text-slate-600"
            onClick={onCollapse}
          >
            Zwiń
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
