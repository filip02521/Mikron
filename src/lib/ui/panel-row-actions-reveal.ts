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
    "transition-[grid-template-columns] ease-out motion-reduce:transition-none",
    "[@media(hover:hover)]:duration-[180ms]",
    "[@media(hover:hover)]:group-hover/panelRow:duration-[250ms]",
    "[@media(hover:hover)]:group-focus-within/panelRow:duration-[200ms]",
    panelRowActionsHoverIntentTimingClass(),
    "[@media(hover:hover)]:group-hover/panelRow:grid-cols-[1fr]",
    "[@media(hover:hover)]:group-focus-within/panelRow:grid-cols-[1fr]",
    forceVisible &&
      "[@media(hover:hover)]:grid-cols-[1fr] [@media(hover:hover)]:delay-0 [@media(hover:hover)]:duration-[200ms]"
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
    "transition-[opacity,transform] ease-out motion-reduce:transition-none motion-reduce:transform-none",
    "[@media(hover:hover)]:duration-[150ms]",
    "[@media(hover:hover)]:group-hover/panelRow:duration-[200ms]",
    "[@media(hover:hover)]:group-focus-within/panelRow:duration-[150ms]",
    panelRowActionsHoverIntentTimingClass(),
    className,
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none",
    !reserveSpace && "[@media(hover:hover)]:translate-x-2",
    "[@media(hover:hover)]:group-hover/panelRow:opacity-100 [@media(hover:hover)]:group-hover/panelRow:pointer-events-auto",
    !reserveSpace && "[@media(hover:hover)]:group-hover/panelRow:translate-x-0",
    "[@media(hover:hover)]:group-focus-within/panelRow:opacity-100 [@media(hover:hover)]:group-focus-within/panelRow:pointer-events-auto",
    !reserveSpace &&
      "[@media(hover:hover)]:group-focus-within/panelRow:translate-x-0",
    forceVisible &&
      "[@media(hover:hover)]:opacity-100 [@media(hover:hover)]:pointer-events-auto [@media(hover:hover)]:delay-0",
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

/** Desktop: ms zanim akcje zaczną się wysuwać (hover intent). */
const PANEL_ROW_HOVER_OPEN_DELAY =
  "[@media(hover:hover)]:group-hover/panelRow:delay-[450ms]";
/** Desktop: krótka tolerancja przy zjechaniu z wiersza. */
const PANEL_ROW_HOVER_CLOSE_DELAY = "[@media(hover:hover)]:delay-[120ms]";
/** Klawiatura: bez czekania po focus-within w wierszu. */
const PANEL_ROW_FOCUS_DELAY = "[@media(hover:hover)]:group-focus-within/panelRow:delay-0";

/** Wspólne opóźnienia hover intent (otwarcie wolniejsze, zamknięcie szybsze). */
function panelRowActionsHoverIntentTimingClass() {
  return cn(
    PANEL_ROW_HOVER_CLOSE_DELAY,
    PANEL_ROW_HOVER_OPEN_DELAY,
    PANEL_ROW_FOCUS_DELAY,
    "motion-reduce:delay-0"
  );
}

/**
 * Footer akcji karty prośby — na urządzeniach z hoverem zwija wysokość (0fr→1fr),
 * więc scroll nie pokazuje ściany przycisków. Touch / forceVisible = zawsze otwarty.
 * focus-within: klawiatura (gdy focus w grupie). Przyciski poza hoverem: invisible +
 * pointer-events-none (poza kolejnością Tab), żeby nie przechodzić przez ukryte CTA.
 *
 * Desktop: ~450 ms na karcie zanim stopka się wysunie (bez „skakania” przy przesuwaniu myszy).
 */
export function panelRowActionsFooterRevealClass({
  forceVisible = false,
  className,
}: PanelRowActionsFooterRevealOptions = {}) {
  return cn(
    "grid grid-rows-[1fr] ease-out motion-reduce:transition-none",
    "transition-[grid-template-rows]",
    "[@media(hover:hover)]:duration-[180ms]",
    "[@media(hover:hover)]:group-hover/panelRow:duration-[250ms]",
    "[@media(hover:hover)]:group-focus-within/panelRow:duration-[200ms]",
    panelRowActionsHoverIntentTimingClass(),
    className,
    "[@media(hover:hover)]:grid-rows-[0fr]",
    "[@media(hover:hover)]:group-hover/panelRow:grid-rows-[1fr]",
    "[@media(hover:hover)]:group-focus-within/panelRow:grid-rows-[1fr]",
    forceVisible &&
      "[@media(hover:hover)]:grid-rows-[1fr] [@media(hover:hover)]:delay-0 [@media(hover:hover)]:duration-[200ms]"
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
    "opacity-100 ease-out motion-reduce:transition-none",
    "transition-opacity",
    "[@media(hover:hover)]:duration-[150ms]",
    "[@media(hover:hover)]:group-hover/panelRow:duration-[200ms]",
    "[@media(hover:hover)]:group-focus-within/panelRow:duration-[150ms]",
    panelRowActionsHoverIntentTimingClass(),
    className,
    "[@media(hover:hover)]:invisible [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0",
    "[@media(hover:hover)]:group-hover/panelRow:visible [@media(hover:hover)]:group-hover/panelRow:pointer-events-auto [@media(hover:hover)]:group-hover/panelRow:opacity-100",
    "[@media(hover:hover)]:group-focus-within/panelRow:visible [@media(hover:hover)]:group-focus-within/panelRow:pointer-events-auto [@media(hover:hover)]:group-focus-within/panelRow:opacity-100",
    forceVisible &&
      "[@media(hover:hover)]:visible [@media(hover:hover)]:pointer-events-auto [@media(hover:hover)]:opacity-100 [@media(hover:hover)]:delay-0"
  );
}
