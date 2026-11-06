"use client";

import { useState } from "react";
import { IconCheck, IconClock, IconMinus } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import type { ServiceStamp } from "@/lib/orders/service-order-board";

/** Pieczątka przybita w ciągu ostatnich sekund dostaje „wbicie” (sv-stamp-in); starsze stoją spokojnie. */
const FRESH_MS = 6000;

function dayMonth(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Inicjały jak na pieczątce: „serwis.test” → „ST”, „Jan Kowalski” → „JK”. */
function initials(actor: string): string {
  const parts = actor.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, 2).map((p) => p[0]) : [actor.slice(0, 2)]).join("").toLocaleUpperCase("pl-PL");
}

function stampText(s: ServiceStamp): string {
  if (s.state === "waiting") return `${s.label}: czeka na część`;
  if (s.state === "skipped") return `${s.label}: pominięte`;
  if (s.state === "empty") return `${s.label}: jeszcze nie`;
  return `${s.label}: ${s.at ? dayMonth(s.at) : "tak"}${s.state === "current" ? " (teraz)" : ""}`;
}

/** Krótki opis dla czytnika w wierszu listy: bieżący krok i od kiedy — reszta jest w karcie zlecenia. */
export function stampSummary(stamps: ServiceStamp[]): string {
  const now = stamps.find((s) => s.state === "current" || s.state === "waiting") ?? [...stamps].reverse().find((s) => s.state === "done");
  if (!now) return "";
  if (now.state === "waiting") return "Naprawa czeka na część";
  return `${now.label}${now.at ? ` ${dayMonth(now.at)}` : ""}`;
}

/**
 * Rubryki karty serwisowej: pięć kroków naprawy, osiągnięte z okrągłą pieczątką i datą, bieżący obrysowany,
 * czekanie na część w bursztynie. Ruch charakterystyczny Serwisu — wiersz listy (`row`, same spany, bo stoi
 * w przycisku) i nagłówek karty zlecenia (`card`, lista z opisem dla czytnika).
 */
export function ServiceStampStrip({
  stamps,
  size = "row",
  cancelled = false,
  className,
}: {
  stamps: ServiceStamp[];
  size?: "row" | "card";
  /** Zlecenie anulowane: rubryki przygaszone, osiągnięte zostają widoczne. */
  cancelled?: boolean;
  className?: string;
}) {
  const card = size === "card";
  // Jeden odczyt czasu na montowanie — porównanie „świeżej” pieczątki nie zmienia się przy kolejnych renderach.
  const [mountedAt] = useState(() => Date.now());
  const Root = card ? "ol" : "span";
  const Item = card ? "li" : "span";
  return (
    <Root
      {...(card ? { "aria-label": `Przebieg naprawy: ${stamps.map(stampText).join(", ")}` } : { "aria-hidden": true })}
      className={cn("flex items-start", card ? "gap-2 sm:gap-3" : "gap-1.5", cancelled && "opacity-60", className)}
    >
      {stamps.map((s) => {
        const inked = s.state === "done" || s.state === "current";
        const fresh = inked && s.at != null && mountedAt - new Date(s.at).getTime() < FRESH_MS;
        return (
          <Item key={s.key} aria-hidden className={cn("flex flex-col items-center", card ? "w-16 gap-1.5" : "w-12 gap-1")}>
            <span
              className={cn(
                "relative flex items-center justify-center rounded-md",
                card ? "h-16 w-16" : "h-12 w-12",
                s.state === "current" && "border-2 border-[var(--sv-stamp)] bg-card",
                s.state === "done" && "border border-[var(--sv-rule)] bg-card",
                s.state === "waiting" && "border-2 border-amber-500 bg-amber-50",
                (s.state === "empty" || s.state === "skipped") && "border border-dashed border-[var(--sv-rule)] bg-[var(--sv-box)]"
              )}
            >
              {inked ? (
                <span
                  className={cn(
                    "flex rotate-[-7deg] flex-col items-center justify-center rounded-full border-2 border-[var(--sv-stamp)] text-[var(--sv-stamp)]",
                    card ? "h-[3.25rem] w-[3.25rem]" : "h-10 w-10",
                    fresh && "sv-stamp-in"
                  )}
                >
                  {s.at ? (
                    <span className={cn("font-display font-semibold leading-none tabular-nums", card ? "text-[0.8125rem]" : "text-[0.6875rem]")}>
                      {dayMonth(s.at)}
                    </span>
                  ) : (
                    <IconCheck size={card ? 18 : 14} aria-hidden />
                  )}
                  {card && s.actor ? (
                    <span className="mt-1 font-display text-[0.625rem] font-semibold leading-none tracking-[0.07em]" title={s.actor}>
                      {initials(s.actor)}
                    </span>
                  ) : null}
                </span>
              ) : s.state === "waiting" ? (
                <span className="flex flex-col items-center gap-0.5 text-amber-800">
                  <IconClock size={card ? 20 : 16} aria-hidden />
                  {card ? <span className="text-[0.6875rem] font-semibold">czeka</span> : null}
                </span>
              ) : s.state === "skipped" ? (
                <IconMinus size={card ? 18 : 14} className="text-slate-400" aria-hidden />
              ) : null}
            </span>
            <span
              className={cn(
                "whitespace-nowrap font-display font-semibold leading-none tracking-[0.02em]",
                card ? "text-[0.75rem]" : "text-[0.6875rem]",
                s.state === "current" ? "text-[var(--sv-stamp)]" : s.state === "waiting" ? "text-amber-800" : "text-slate-600"
              )}
            >
              {s.label}
            </span>
          </Item>
        );
      })}
    </Root>
  );
}
