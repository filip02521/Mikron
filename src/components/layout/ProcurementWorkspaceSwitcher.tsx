"use client";

import { useTransition, useState, useCallback } from "react";
import { actionSetProcurementWorkspace } from "@/app/actions/procurement-workspace";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  PROCUREMENT_WORKSPACE_OPTIONS,
  type ProcurementWorkspace,
  subtitleForProcurementWorkspace,
  workspaceTone,
  workspaceToneBg,
  workspaceToneRing,
  workspaceToneText,
  workspaceToneIconBg,
  workspaceToneAccent,
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

export function ProcurementWorkspaceSwitcher({
  current,
  options = PROCUREMENT_WORKSPACE_OPTIONS,
}: {
  current: ProcurementWorkspace;
  options?: typeof PROCUREMENT_WORKSPACE_OPTIONS;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dismissError = useCallback(() => setError(null), []);

  return (
    <div className="mb-3">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Przełącz obszar
      </p>
      {error ? (
        <div className="mb-1.5 mx-2 flex items-center justify-between gap-2 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
          <span className="min-w-0 truncate">{error}</span>
          <button type="button" onClick={dismissError} className="shrink-0 text-rose-400 hover:text-rose-600">
            ✕
          </button>
        </div>
      ) : null}
      <div
        className={cn("grid gap-1.5 px-2", pending && "opacity-60")}
        role="group"
        aria-label="Wybór obszaru pracy"
        style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 2)}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const isActive = opt.value === current;
          const iconKey = WORKSPACE_ICON[opt.value];
          const tone = workspaceTone(opt.value) as NavTone;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              title={opt.title}
              aria-pressed={isActive}
              onClick={() => {
                if (pending || isActive) return;
                setError(null);
                startTransition(() => {
                  void runServerActionWithRedirect(
                    () => actionSetProcurementWorkspace(opt.value),
                    (err) => {
                      setError(err instanceof Error ? err.message : "Nie udało się przełączyć obszaru");
                    }
                  );
                });
              }}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg px-2.5 py-2 text-left transition-all",
                controlFocusClass,
                isActive
                  ? cn(workspaceToneBg(opt.value), workspaceToneRing(opt.value), "ring-1 ring-inset shadow-sm")
                  : "hover:bg-slate-50 ring-1 ring-transparent",
                pending && "cursor-wait"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? navIconTileActiveClassForTone(tone)
                      : navIconTileClassForTone(tone)
                  )}
                >
                  <NavIcon navKey={iconKey} size={15} />
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] font-medium leading-snug",
                    isActive ? cn("font-semibold", workspaceToneText(opt.value)) : "text-slate-600"
                  )}
                >
                  {opt.label}
                </span>
                {isActive ? (
                  <span
                    className={cn(
                      "shrink-0 h-1.5 w-1.5 rounded-full bg-current",
                      workspaceToneAccent(opt.value),
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
              <p className={cn(
                "truncate text-[10px] leading-tight",
                isActive ? "text-slate-500" : "text-slate-400",
              )}>
                {subtitleForProcurementWorkspace(opt.value)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
