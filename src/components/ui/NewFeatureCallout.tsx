"use client";

import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { newFeatureDismissedStore } from "@/lib/client/new-feature-store";

/**
 * Dymek „Nowość” przy nowej funkcji: znaczek, tytuł, jedno-dwa zdania.
 * „OK, rozumiem” chowa go do następnego wejścia; z zaznaczonym „Nie pokazuj więcej” — na stałe
 * (w tej przeglądarce). Po dacie `until` znika sam, żeby nowość nie wisiała miesiącami.
 */
export function NewFeatureCallout({
  id,
  title,
  children,
  until,
  arrow = "top",
  className,
}: {
  /** Klucz zapamiętania; zmień wersję (`-v2`), żeby pokazać dymek ponownie po zmianie funkcji. */
  id: string;
  title: string;
  children: ReactNode;
  /** RRRR-MM-DD — ostatni dzień pokazywania. */
  until?: string;
  /** Strzałka w stronę funkcji, której dotyczy dymek. */
  arrow?: "top" | "bottom" | "none";
  className?: string;
}) {
  const store = newFeatureDismissedStore(id);
  const dismissedForever = usePersistedFlag(store);
  const [closed, setClosed] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const checkboxId = useId();
  const titleId = useId();

  if (dismissedForever || closed || isPastUntil(until)) return null;

  function close() {
    if (dontShowAgain) store.setValue(true);
    setClosed(true);
  }

  return (
    <aside
      aria-labelledby={titleId}
      className={cn(
        // z-10: strzałka wystaje poza dymek — sąsiednia karta rysowana później by ją przykryła.
        "relative z-10 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 shadow-[var(--shadow-elevated)]",
        arrow === "top" && "mt-3",
        arrow === "bottom" && "mb-3",
        className
      )}
    >
      {arrow === "top" ? (
        <span
          aria-hidden
          className="absolute -top-[7px] left-6 size-3 rotate-45 border-l border-t border-indigo-200 bg-indigo-50"
        />
      ) : arrow === "bottom" ? (
        <span
          aria-hidden
          className="absolute -bottom-[7px] left-6 size-3 rotate-45 border-b border-r border-indigo-200 bg-indigo-50"
        />
      ) : null}
      <div className="flex items-start gap-2">
        <Badge variant="info" className="mt-px shrink-0 bg-card font-semibold ring-1 ring-indigo-200">
          Nowość
        </Badge>
        <div className="min-w-0 text-[0.8125rem] leading-snug">
          <p id={titleId} className="font-semibold text-slate-900">
            {title}
          </p>
          <div className="mt-0.5 text-slate-600">{children}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
        <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <input
            id={checkboxId}
            type="checkbox"
            className="size-4 cursor-pointer accent-[var(--primary)]"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          Nie pokazuj więcej
        </label>
        <Button type="button" size="sm" variant="secondary" className="min-h-8" onClick={close}>
          OK, rozumiem
        </Button>
      </div>
    </aside>
  );
}

export function isPastUntil(until: string | undefined): boolean {
  if (!until) return false;
  // Porównanie dat kalendarzowych (RRRR-MM-DD) — strefa nie przesuwa ostatniego dnia.
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  return today > until;
}
