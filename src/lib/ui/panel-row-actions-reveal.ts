import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";

/** Klasa grupy Tailwind — dodaj na kontener wiersza (article / li). */
export const PANEL_ROW_GROUP_CLASS = "group/panelRow";

export function panelRowGroupClass(...extra: Array<string | false | null | undefined>) {
  return cn(PANEL_ROW_GROUP_CLASS, ...extra);
}

/** Po wyjechaniu myszką — chowaj akcje trzymane przez focus wewnątrz wiersza. */
export function panelRowClearFocusOnLeave(event: MouseEvent<HTMLElement>) {
  const row = event.currentTarget;
  const active = document.activeElement;
  if (active instanceof HTMLElement && row.contains(active)) {
    active.blur();
  }
}

type PanelRowActionsRevealOptions = {
  forceVisible?: boolean;
  className?: string;
};

/** Opacity reveal — wewnątrz slotu o stałym wymiarze. */
export function panelRowActionsRevealClass({
  forceVisible = false,
  className,
}: PanelRowActionsRevealOptions = {}) {
  return cn(
    "opacity-100 pointer-events-auto transition-opacity duration-200 ease-out",
    className,
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none",
    "[@media(hover:hover)]:group-hover/panelRow:opacity-100 [@media(hover:hover)]:group-hover/panelRow:pointer-events-auto",
    forceVisible && "[@media(hover:hover)]:opacity-100 [@media(hover:hover)]:pointer-events-auto"
  );
}

type PanelRowActionsInlineEndOptions = {
  forceVisible?: boolean;
  /**
   * Zarezerwuj szerokość akcji zawsze (tylko fade) — bez grid 0fr→1fr.
   * Zapobiega ściskaniu tytułu / planowego przy hoverze wiersza.
   */
  reserveSpace?: boolean;
  /** @deprecated Szerokość wynika z zawartości (grid 0fr → 1fr). */
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** Zewnętrzny kontener akcji po prawej — grid 0fr → 1fr na desktopie (lub stała szerokość). */
export function panelRowActionsInlineEndClass({
  forceVisible = false,
  reserveSpace = false,
  className,
}: PanelRowActionsInlineEndOptions = {}) {
  if (reserveSpace) {
    return cn("grid shrink-0 self-start grid-cols-[1fr]", className);
  }
  return cn(
    "grid shrink-0 self-start grid-cols-[1fr]",
    className,
    "[@media(hover:hover)]:grid-cols-[0fr] [@media(hover:hover)]:overflow-hidden",
    "[@media(hover:hover)]:transition-[grid-template-columns] [@media(hover:hover)]:duration-250 [@media(hover:hover)]:ease-out",
    "[@media(hover:hover)]:group-hover/panelRow:grid-cols-[1fr]",
    forceVisible && "[@media(hover:hover)]:grid-cols-[1fr]"
  );
}

/** Wewnętrzny wrapper — overflow dla animacji grid. */
export function panelRowActionsInlineEndInnerClass(className?: string) {
  return cn("min-w-0 overflow-hidden", className);
}

/** Zawartość akcji — fade (+ slide gdy slot się rozszerza). */
export function panelRowActionsInlineEndContentClass({
  forceVisible = false,
  reserveSpace = false,
  className,
}: PanelRowActionsRevealOptions & { reserveSpace?: boolean } = {}) {
  return cn(
    reserveSpace ? "w-full min-w-0" : "w-max",
    "opacity-100 pointer-events-auto",
    !reserveSpace && "translate-x-0",
    "transition-[opacity,transform] duration-250 ease-out motion-reduce:transition-none motion-reduce:transform-none",
    className,
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none",
    !reserveSpace && "[@media(hover:hover)]:translate-x-2",
    "[@media(hover:hover)]:group-hover/panelRow:opacity-100 [@media(hover:hover)]:group-hover/panelRow:pointer-events-auto",
    !reserveSpace && "[@media(hover:hover)]:group-hover/panelRow:translate-x-0",
    "[@media(hover:hover)]:group-hover/panelRow:delay-75",
    forceVisible && "[@media(hover:hover)]:opacity-100 [@media(hover:hover)]:pointer-events-auto",
    forceVisible && !reserveSpace && "[@media(hover:hover)]:translate-x-0"
  );
}

/** Ciasny pasek na dole — tylko wąskie kolumny planu tygodnia. */
export function panelRowActionsSlotClass({ className }: { className?: string } = {}) {
  return cn(
    "flex min-h-7 items-center justify-end border-t border-slate-100/80 pt-1",
    "[@media(hover:hover)]:border-transparent",
    "[@media(hover:hover)]:group-hover/panelRow:border-slate-100/80",
    className
  );
}

type PanelRowActionsFooterRevealOptions = {
  forceVisible?: boolean;
  className?: string;
};

/**
 * Footer akcji karty prośby — na urządzeniach z hoverem zwija wysokość (0fr→1fr),
 * więc scroll nie pokazuje ściany przycisków. Touch / forceVisible = zawsze otwarty.
 * focus-within: klawiatura (gdy focus w grupie). Przyciski poza hoverem: invisible +
 * pointer-events-none (poza kolejnością Tab), żeby nie przechodzić przez ukryte CTA.
 */
export function panelRowActionsFooterRevealClass({
  forceVisible = false,
  className,
}: PanelRowActionsFooterRevealOptions = {}) {
  return cn(
    "grid grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
    className,
    "[@media(hover:hover)]:grid-rows-[0fr]",
    "[@media(hover:hover)]:group-hover/panelRow:grid-rows-[1fr]",
    "[@media(hover:hover)]:group-focus-within/panelRow:grid-rows-[1fr]",
    forceVisible && "[@media(hover:hover)]:grid-rows-[1fr]"
  );
}

/** Wewnętrzny wrapper footera — overflow dla animacji grid-rows. */
export function panelRowActionsFooterRevealInnerClass(className?: string) {
  return cn("min-h-0 overflow-hidden", className);
}

/**
 * Zawartość footera — poza hoverem niewidoczna i poza Tab (hover devices).
 * group-focus-within: po wejściu skrótem / fokusie wiersza CTA wracają do tab order.
 */
export function panelRowActionsFooterRevealContentClass({
  forceVisible = false,
  className,
}: PanelRowActionsFooterRevealOptions = {}) {
  return cn(
    "opacity-100",
    className,
    "[@media(hover:hover)]:invisible [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0",
    "[@media(hover:hover)]:group-hover/panelRow:visible [@media(hover:hover)]:group-hover/panelRow:pointer-events-auto [@media(hover:hover)]:group-hover/panelRow:opacity-100",
    "[@media(hover:hover)]:group-focus-within/panelRow:visible [@media(hover:hover)]:group-focus-within/panelRow:pointer-events-auto [@media(hover:hover)]:group-focus-within/panelRow:opacity-100",
    forceVisible &&
      "[@media(hover:hover)]:visible [@media(hover:hover)]:pointer-events-auto [@media(hover:hover)]:opacity-100"
  );
}
