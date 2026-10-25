"use client";

import { useTransition, useState, useCallback } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { actionSetProcurementWorkspace } from "@/app/actions/procurement-workspace";
import { runServerActionWithRedirect } from "@/lib/client/server-action-redirect";
import {
  PROCUREMENT_WORKSPACE_OPTIONS,
  type ProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";
import { cn } from "@/lib/cn";
import { NavIcon } from "@/components/icons/NavIcon";
import { IconX } from "@/components/icons/StrokeIcons";
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
      <p className="mb-1.5 px-1 text-[0.6875rem] leading-tight text-slate-500">
        Przełącz obszar
      </p>
      {error ? (
        <div className="mb-1.5 flex items-start justify-between gap-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700" role="alert">
          <span className="min-w-0">{error}</span>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Zamknij komunikat"
            className={cn("shrink-0 rounded text-red-700 hover:text-red-800", controlFocusClass)}
          >
            <IconX size={14} />
          </button>
        </div>
      ) : null}
      <div
        className={cn(
          stacked ? "space-y-0.5" : "flex gap-1",
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
                      setError(userFacingErrorText(err, "Nie udało się przełączyć obszaru"));
                    }
                  );
                });
              }}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
                stacked ? "w-full" : "flex-1 justify-center gap-1.5 text-center",
                controlFocusClass,
                // Wybrany obszar wygląda jak aktywna pozycja menu (DESIGN.md → „Jedno wybrane”).
                isActive
                  ? "bg-indigo-50 text-indigo-900"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                pending && "cursor-wait"
              )}
            >
              <NavIcon
                navKey={iconKey}
                size={stacked ? 16 : 14}
                className={isActive ? "text-indigo-700" : "text-slate-500"}
              />
              <span
                className={cn(
                  "min-w-0 text-[0.8125rem] leading-tight",
                  stacked && "flex-1",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
