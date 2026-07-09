"use client";

import { useTransition } from "react";
import { actionSetAdminPanelContext } from "@/app/actions/admin-panel-context";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  ADMIN_PANEL_CONTEXT_OPTIONS,
  type AdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import { cn } from "@/lib/cn";
import { NavIcon } from "@/components/icons/NavIcon";
import type { NavIconKey, NavTone } from "@/lib/nav";
import {
  navIconTileActiveClassForTone,
  navIconTileClassForTone,
} from "@/components/icons/NavIcon";
import {
  controlFocusClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";

const CONTEXT_ICON: Record<AdminPanelContext, NavIconKey> = {
  admin: "admin",
  zakupy: "dailyPanel",
  zakupy_zeby: "teeth",
  magazyn: "warehouse",
  sales: "myOrders",
  sales_manager: "team",
};

const CONTEXT_TONE: Record<AdminPanelContext, NavTone> = {
  admin: "violet",
  zakupy: "indigo",
  zakupy_zeby: "sky",
  magazyn: "emerald",
  sales: "indigo",
  sales_manager: "slate",
};

export function AdminPanelContextSwitcher({
  current,
}: {
  current: AdminPanelContext;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-3">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Podgląd panelu
      </p>
      <div
        className={cn("grid grid-cols-2 gap-1 px-2", pending && "opacity-60")}
        role="group"
        aria-label="Wybór panelu podglądu"
      >
        {ADMIN_PANEL_CONTEXT_OPTIONS.map((opt) => {
          const isActive = opt.value === current;
          const iconKey = CONTEXT_ICON[opt.value];
          const tone = CONTEXT_TONE[opt.value];

          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              title={opt.title}
              aria-pressed={isActive}
              onClick={() => {
                if (pending || isActive) return;
                startTransition(() => {
                  void runServerActionWithRedirect(() =>
                    actionSetAdminPanelContext(opt.value)
                  );
                });
              }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                controlFocusClass,
                isActive
                  ? "bg-slate-100 ring-1 ring-slate-200/80"
                  : "hover:bg-slate-50",
                pending && "cursor-wait"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  isActive
                    ? navIconTileActiveClassForTone(tone)
                    : navIconTileClassForTone(tone)
                )}
              >
                <NavIcon navKey={iconKey} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[13px] font-medium leading-snug",
                    isActive ? "font-semibold text-slate-900" : "text-slate-700"
                  )}
                >
                  {opt.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
