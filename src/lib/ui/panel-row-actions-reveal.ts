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
  /** @deprecated Szerokość wynika z zawartości (grid 0fr → 1fr). */
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** Zewnętrzny kontener akcji po prawej — grid 0fr → 1fr na desktopie. */
export function panelRowActionsInlineEndClass({
  forceVisible = false,
  className,
}: PanelRowActionsInlineEndOptions = {}) {
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

/** Zawartość akcji — fade + lekki slide przy hover wiersza. */
export function panelRowActionsInlineEndContentClass({
  forceVisible = false,
  className,
}: PanelRowActionsRevealOptions = {}) {
  return cn(
    "w-max opacity-100 translate-x-0 pointer-events-auto",
    "transition-[opacity,transform] duration-250 ease-out motion-reduce:transition-none motion-reduce:transform-none",
    className,
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:translate-x-2 [@media(hover:hover)]:pointer-events-none",
    "[@media(hover:hover)]:group-hover/panelRow:opacity-100 [@media(hover:hover)]:group-hover/panelRow:translate-x-0 [@media(hover:hover)]:group-hover/panelRow:pointer-events-auto",
    "[@media(hover:hover)]:group-hover/panelRow:delay-75",
    forceVisible && "[@media(hover:hover)]:opacity-100 [@media(hover:hover)]:translate-x-0 [@media(hover:hover)]:pointer-events-auto"
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
