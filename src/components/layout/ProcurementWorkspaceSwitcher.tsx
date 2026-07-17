"use client";

import { useTransition, useState, useCallback } from "react";
import { actionSetProcurementWorkspace } from "@/app/actions/procurement-workspace";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  PROCUREMENT_WORKSPACE_OPTIONS,
  type ProcurementWorkspace,
  workspaceToneBg,
  workspaceToneRing,
  workspaceToneText,
  workspaceToneAccent,
} from "@/lib/auth/procurement-workspace";
import { cn } from "@/lib/cn";
import { NavIcon } from "@/components/icons/NavIcon";
import {
  controlFocusClass,
} from "@/lib/ui/ontime-theme";
import type { NavIconKey } from "@/lib/nav";

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

  const stacked = options.length >= 3;

  return (
    <div className="mb-3">
      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
        className={cn(
          "px-2",
          stacked ? "space-y-1" : "flex gap-1",
          pending && "opacity-60",
        )}
        role="group"
        aria-label="Wybór obszaru pracy"
      >
        {options.map((opt) => {
          const isActive = opt.value === current;
          const iconKey = WORKSPACE_ICON[opt.value];

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
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all",
                stacked ? "w-full" : "flex-1 justify-center gap-1.5 text-center",
                controlFocusClass,
                isActive
                  ? cn(workspaceToneBg(opt.value), workspaceToneRing(opt.value), "ring-1 ring-inset shadow-sm")
                  : "hover:bg-slate-50 ring-1 ring-transparent",
                pending && "cursor-wait"
              )}
            >
              <NavIcon navKey={iconKey} size={stacked ? 16 : 14} />
              <span
                className={cn(
                  "min-w-0 truncate text-[11px] font-medium leading-tight",
                  stacked && "flex-1",
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
