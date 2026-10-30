"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { actionSetAdminPanelContext } from "@/app/actions/admin-panel-context";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  ADMIN_PANEL_CONTEXT_OPTIONS,
  labelForAdminPanelContext,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { cn } from "@/lib/cn";
import { NavIcon } from "@/components/icons/NavIcon";
import type { NavIconKey } from "@/lib/nav";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

const CONTEXT_ICON: Record<AdminPanelContext, NavIconKey> = {
  admin: "admin",
  zakupy: "dailyPanel",
  zakupy_zeby: "teeth",
  magazyn: "warehouse",
  sales: "myOrders",
  sales_manager: "team",
};

export function AdminPanelContextSwitcher({
  current,
}: {
  current: AdminPanelContext;
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const currentOpt =
    ADMIN_PANEL_CONTEXT_OPTIONS.find((o) => o.value === current) ??
    ADMIN_PANEL_CONTEXT_OPTIONS[0]!;
  const currentIcon = CONTEXT_ICON[current];

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setExpanded(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [expanded]);

  return (
    <div ref={rootRef} className="mb-3">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        title={currentOpt.title}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex min-h-10 w-full items-center gap-2.5 rounded-md border border-slate-200 bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors",
          controlFocusClass,
          "hover:border-slate-300 hover:bg-slate-50",
          pending && "opacity-60"
        )}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-500" aria-hidden>
          <NavIcon navKey={currentIcon} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6875rem] leading-tight text-slate-500">
            Podgląd panelu
          </span>
          <span className="block text-[0.8125rem] font-semibold leading-snug text-slate-900">
            {labelForAdminPanelContext(current)}
          </span>
        </span>
        <IconChevronDown
          size={16}
          className={cn(
            "shrink-0 text-slate-500 motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div
          id={panelId}
          role="group"
          aria-label="Wybór panelu podglądu"
          className={cn("mt-1.5 grid grid-cols-2 gap-0.5", pending && "opacity-60")}
        >
          {ADMIN_PANEL_CONTEXT_OPTIONS.map((opt) => {
            const isActive = opt.value === current;
            const iconKey = CONTEXT_ICON[opt.value];

            return (
              <button
                key={opt.value}
                type="button"
                disabled={pending}
                title={opt.title}
                aria-pressed={isActive}
                onClick={() => {
                  if (pending) return;
                  setExpanded(false);
                  if (isActive) return;
                  startTransition(() => {
                    void runServerActionWithRedirect(() =>
                      actionSetAdminPanelContext(opt.value)
                    );
                  });
                }}
                className={cn(
                  "flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  controlFocusClass,
                  // Wybrany panel wygląda jak aktywna pozycja menu (DESIGN.md → „Jedno wybrane”).
                  isActive
                    ? "bg-indigo-50 text-indigo-900"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  pending && "cursor-wait"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center",
                    isActive ? "text-indigo-700" : "text-slate-500"
                  )}
                  aria-hidden
                >
                  <NavIcon navKey={iconKey} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-[0.8125rem] leading-snug",
                      isActive ? "font-semibold" : "font-medium"
                    )}
                  >
                    {opt.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
