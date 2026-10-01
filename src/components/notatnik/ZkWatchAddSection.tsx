"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";
import { ZK_PAGE_SECTION_COPY } from "@/lib/sales/zk-page-copy";
import { cn } from "@/lib/cn";
import {
  notatnikAddPanelShellClass,
  notatnikPrimaryAddButtonClass,
  salesChromeInsetClass,
  salesTypography,
} from "@/lib/ui/ontime-theme";

/** Panel dodawania ZK — akcja funkcjonalna, nie zwijana pomoc jak skróty / legenda. */
export function ZkWatchAddSection({
  defaultOpen = false,
  showCollapse = false,
  embedded = true,
  onCollapse,
  children,
}: {
  defaultOpen?: boolean;
  showCollapse?: boolean;
  embedded?: boolean;
  onCollapse?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelRef = useRef<HTMLDivElement>(null);

  function collapse() {
    setOpen(false);
    onCollapse?.();
  }

  function expand() {
    setOpen(true);
    window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>("input[type='text']")?.focus();
    }, 0);
  }

  if (!open) {
    return (
      <div className={cn(embedded && cn(salesChromeInsetClass, "pb-2"))}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={notatnikPrimaryAddButtonClass}
          onClick={expand}
        >
          <IconPlusCircle size={16} strokeWidth={2} className="mr-1.5 shrink-0" aria-hidden />
          {ZK_PAGE_SECTION_COPY.addTitle}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(embedded && cn(salesChromeInsetClass, "pb-2"))}>
      <div
        ref={panelRef}
        className={notatnikAddPanelShellClass}
      >
        <div className="flex items-start justify-between gap-2 border-b border-indigo-100/80 px-3 py-2.5 sm:px-3.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800" className="mt-0.5 h-8 w-8">
              <IconPlusCircle size={17} strokeWidth={2.25} />
            </SectionHeadingIcon>
            <div className="min-w-0">
              <p className={cn(salesTypography.sectionLabel, "normal-case text-indigo-950")}>
                {ZK_PAGE_SECTION_COPY.addTitle}
              </p>
              <p className={cn("mt-0.5", salesTypography.sectionHint, "text-indigo-950/75")}>
                {ZK_PAGE_SECTION_COPY.addDescription}
              </p>
            </div>
          </div>
          {showCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9 shrink-0 text-indigo-800 hover:bg-indigo-100/80"
              onClick={collapse}
            >
              Zwiń
            </Button>
          ) : null}
        </div>
        <div className="px-3 py-3 sm:px-3.5">{children}</div>
      </div>
    </div>
  );
}
