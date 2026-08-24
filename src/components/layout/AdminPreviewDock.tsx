"use client";

import { useEffect, useId, useState } from "react";
import { actionSetAdminPanelContext } from "@/app/actions/admin-panel-context";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  isAdminOperationsPreviewReadOnly,
  labelForAdminPanelContext,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { Button } from "@/components/ui/Button";
import { IconChevronDown, IconEye } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  controlFocusClass,
  noticeBodyInlineClass,
  noticeTitleInlineClass,
} from "@/lib/ui/ontime-theme";
import { ADMIN_PREVIEW_DOCK_HEIGHT } from "@/lib/ui/sales-mobile-chrome";

function previewDockDescription(
  panelContext: AdminPanelContext,
  salesName: string | null
): string {
  if (salesName) {
    return `Handlowiec: ${salesName}. Tryb tylko do odczytu — zmiany w panelu administracji.`;
  }
  // Zakupy / Zęby: realna praca operacyjna (nie read-only w UI).
  if (panelContext === "zakupy" || panelContext === "zakupy_zeby") {
    return "Podgląd panelu operacyjnego — możesz pracować jak w tym dziale. Wróć do administracji, gdy skończysz.";
  }
  return "Tryb tylko do odczytu. Zmiany w systemie wykonujesz z panelu administracji.";
}

export function AdminPreviewDock({
  panelContext,
  previewSalesPersonName,
}: {
  panelContext: AdminPanelContext;
  previewSalesPersonName?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dockContext, setDockContext] = useState(panelContext);
  if (panelContext !== dockContext) {
    setDockContext(panelContext);
    setExpanded(false);
  }
  const titleId = useId();
  const regionId = useId();
  const label = labelForAdminPanelContext(panelContext);
  const salesName = previewSalesPersonName?.trim() || null;
  const description = previewDockDescription(panelContext, salesName);
  const collapsedLabel = salesName
    ? `Podgląd: ${label} · ${salesName}`
    : `Podgląd: ${label}`;
  const readOnlyHint = isAdminOperationsPreviewReadOnly("admin", panelContext);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      {expanded ? (
        <button
          type="button"
          aria-label="Zwiń podgląd panelu"
          className="fixed inset-0 z-[55] bg-slate-900/20"
          onClick={() => setExpanded(false)}
        />
      ) : null}

      <div
        className={cn(
          "fixed z-[60] flex flex-col",
          "inset-x-2 bottom-[var(--mobile-bottom-chrome,0px)]",
          "md:inset-x-auto md:bottom-3 md:left-[calc(16rem+1rem)] md:right-auto md:w-full md:max-w-md"
        )}
      >
        {expanded ? (
          <section
            id={regionId}
            role="region"
            aria-labelledby={titleId}
            className="mb-1.5 max-h-[min(45dvh,22rem)] overflow-y-auto rounded-md border border-slate-200/90 bg-white p-3 shadow-[var(--shadow-card-elevated)] sm:p-3.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p id={titleId} className={noticeTitleInlineClass}>
                  Podgląd panelu: {label}
                  {readOnlyHint ? (
                    <span className="ml-1.5 text-[11px] font-medium text-slate-500">
                      tylko odczyt
                    </span>
                  ) : null}
                </p>
                <p className={cn("mt-0.5", noticeBodyInlineClass)}>{description}</p>
              </div>
              <button
                type="button"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                  controlFocusClass
                )}
                aria-label="Zwiń"
                onClick={() => setExpanded(false)}
              >
                <IconChevronDown size={18} />
              </button>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                className="min-h-10 w-full sm:w-auto"
                onClick={() => {
                  void runServerActionWithRedirect(() =>
                    actionSetAdminPanelContext("admin")
                  );
                }}
              >
                Wróć do administracji
              </Button>
            </div>
          </section>
        ) : null}

        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? regionId : undefined}
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-md border border-slate-200/90 bg-white px-3 text-left shadow-[var(--shadow-card-elevated)]",
            "hover:bg-slate-50",
            controlFocusClass
          )}
          style={{ height: ADMIN_PREVIEW_DOCK_HEIGHT }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-800">
            <IconEye size={15} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">
            {collapsedLabel}
          </span>
          <IconChevronDown
            size={16}
            className={cn(
              "shrink-0 text-slate-500 motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none",
              !expanded && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </div>
    </>
  );
}
