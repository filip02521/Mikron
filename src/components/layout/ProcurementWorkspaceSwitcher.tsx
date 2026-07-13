"use client";

import { useTransition } from "react";
import { actionSetProcurementWorkspace } from "@/app/actions/procurement-workspace";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  PROCUREMENT_WORKSPACE_OPTIONS,
  type ProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";
import { cn } from "@/lib/cn";
import { NavIcon } from "@/components/icons/NavIcon";
import {
  navIconTileActiveClassForTone,
  navIconTileClassForTone,
} from "@/components/icons/NavIcon";
import {
  controlFocusClass,
} from "@/lib/ui/ontime-theme";
import type { NavIconKey, NavTone } from "@/lib/nav";

const WORKSPACE_ICON: Record<ProcurementWorkspace, NavIconKey> = {
  dostawy: "dailyPanel",
  zeby: "teeth",
  magazyn: "warehouse",
};

const WORKSPACE_TONE: Record<ProcurementWorkspace, NavTone> = {
  dostawy: "indigo",
  zeby: "sky",
  magazyn: "emerald",
};

export function ProcurementWorkspaceSwitcher({
  current,
  options = PROCUREMENT_WORKSPACE_OPTIONS,
}: {
  current: ProcurementWorkspace;
  options?: typeof PROCUREMENT_WORKSPACE_OPTIONS;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-3">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Obszar pracy
      </p>
      <div
        className={cn("grid gap-1 px-2", pending && "opacity-60")}
        role="group"
        aria-label="Wybór obszaru pracy"
        style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 2)}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const isActive = opt.value === current;
          const iconKey = WORKSPACE_ICON[opt.value];
          const tone = WORKSPACE_TONE[opt.value];

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
                    actionSetProcurementWorkspace(opt.value)
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
