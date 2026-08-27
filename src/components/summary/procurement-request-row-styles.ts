import { cn } from "@/lib/cn";
import {
  dailyPanelFreshHighlightClass,
  dailyPanelUnseenRequestRowClass,
  rowPendingRingClass,
  type DailyPanelUnseenVariant,
} from "@/lib/ui/ontime-theme";
import { panelRowGroupClass } from "@/lib/ui/panel-row-actions-reveal";

/** Karta prośby — spójna z harmonogramem (urgent-card-styles). */
export function procurementRequestRowClassName({
  variant,
  nestedInBlock = false,
  isUnseen = false,
  isFocused = false,
  highlightFresh = false,
  pending = false,
  /** Wielopozycyjna — widać że klik rozwija produkty. */
  expandable = false,
}: {
  variant: DailyPanelUnseenVariant;
  nestedInBlock?: boolean;
  isUnseen?: boolean;
  isFocused?: boolean;
  highlightFresh?: boolean;
  pending?: boolean;
  expandable?: boolean;
}) {
  const isStockOut = variant === "stockOut";

  return cn(
    panelRowGroupClass(
      nestedInBlock
        ? cn(
            "rounded-none border-0 bg-transparent shadow-none transition-colors",
            expandable
              ? isStockOut
                ? "hover:bg-amber-50/80"
                : "hover:bg-indigo-50/50"
              : "hover:bg-white/70"
          )
        : cn(
            "rounded-md border border-slate-200 bg-white shadow-sm transition-[border-color,box-shadow,background-color]",
            expandable
              ? isStockOut
                ? "hover:border-amber-300/90 hover:bg-amber-50/35 hover:shadow-md"
                : "hover:border-indigo-300/80 hover:bg-indigo-50/25 hover:shadow-md"
              : cn(
                  "hover:border-slate-300/90",
                  isStockOut && "hover:border-amber-200/80"
                )
          )
    ),
    expandable && "cursor-pointer",
    pending && rowPendingRingClass,
    isFocused &&
      (isStockOut
        ? "relative z-10 ring-2 ring-inset ring-amber-400/70"
        : "relative z-10 ring-2 ring-inset ring-violet-400/70"),
    isUnseen && dailyPanelUnseenRequestRowClass(variant, { nestedInBlock }),
    highlightFresh && isUnseen && dailyPanelFreshHighlightClass
  );
}

/** Nazwa dostawcy — czytelny link, subtelny hover (bez „chipa” / underline). */
export function procurementSupplierNameLinkClass(
  variant: DailyPanelUnseenVariant = "prosby"
): string {
  const isStockOut = variant === "stockOut";
  return cn(
    "text-left font-semibold tracking-tight transition-colors duration-150",
    isStockOut
      ? "text-amber-950 hover:text-amber-800"
      : "text-indigo-950 hover:text-indigo-700"
  );
}

/** Strefa P — podświetlenie przy hoverze karty (sygnał: tu są produkty / klik rozwija). */
export function procurementRequestOrderBodyInteractiveClass(
  variant: DailyPanelUnseenVariant = "prosby"
): string {
  const isStockOut = variant === "stockOut";
  return cn(
    "transition-[background-color,border-color,box-shadow] duration-150",
    isStockOut
      ? "group-hover/panelRow:border-amber-200/90 group-hover/panelRow:bg-amber-50/70 group-hover/panelRow:shadow-sm"
      : "group-hover/panelRow:border-indigo-200/80 group-hover/panelRow:bg-indigo-50/55 group-hover/panelRow:shadow-sm"
  );
}

/** Tytuł produktu — zaznacza się przy hoverze prośby. */
export function procurementRequestProductTitleClass(
  variant: DailyPanelUnseenVariant = "prosby"
): string {
  const isStockOut = variant === "stockOut";
  return cn(
    "text-xs font-medium leading-snug text-slate-800 transition-colors duration-150",
    isStockOut
      ? "group-hover/panelRow:text-amber-950"
      : "group-hover/panelRow:text-indigo-950"
  );
}

/** Meta wiersza prośby w bloku dostawcy — produkty · lokalizacja · uwagi. */
export function procurementNestedRowMeta({
  countLabel,
  locationLabel: loc,
  noteSuffix,
}: {
  countLabel: string;
  locationLabel?: string | null;
  noteSuffix?: string | null;
}): string {
  const parts = [countLabel];
  if (loc?.trim()) parts.push(loc.trim());
  const note = noteSuffix?.trim().replace(/^·\s*/, "") ?? "";
  if (note) parts.push(note);
  return parts.join(" · ");
}

/** Pasek kontekstu karty / bloku dostawcy (chipy). */
export const procurementRequestContextStripClass =
  "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1";

/** Druga linia kontekstu — osoba · ETA · on-demand (tekst, nie chipy). */
export const procurementRequestContextMetaClass =
  "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5";

/** Strefa zamówienia — inset pod kontekstem (produkt / uwagi / expand). */
export const procurementRequestOrderBodyClass =
  "mt-1 flex flex-col gap-1 rounded-md border border-slate-100/90 bg-slate-50/40 px-2 py-1";

/** Strefa P bez ramki — typowy przypadek 1 produktu. */
export const procurementRequestOrderBodyFlatClass = "mt-1 flex flex-col gap-1";

/** Pozycja w expanded liście wewnątrz insetu — bez drugiej ramki. */
export const procurementRequestLineInOrderBodyClass =
  "rounded-none border-0 border-t border-slate-100/80 bg-transparent px-0 py-1 text-xs first:border-t-0 first:pt-0 last:pb-0";

/** Przycisk rozwinięcia listy produktów — pełniejszy hit target. */
export const procurementRequestExpandProductsClass =
  "h-7 w-full justify-start px-1.5 text-xs font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100/80 hover:text-slate-900 group-hover/panelRow:bg-slate-100/90 group-hover/panelRow:text-slate-900";

/** Treść karty prośby (H / C / P) — bez prawej szyny akcji. */
export const procurementRequestCardBodyClass = "px-2.5 py-1.5 sm:px-3";

/** Treść wiersza w bloku dostawcy — ciaśniejsza. */
export const procurementRequestCardBodyNestedClass = "px-2 py-1";

/** Footer karty — padding; widoczność steruje ProcurementRequestActionsFooter. */
export const procurementRequestCardFooterClass = "px-2.5 py-1 sm:px-3";

/** Footer wiersza nested. */
export const procurementRequestCardFooterNestedClass = "px-2 py-1";

/** Footer nagłówka bloku dostawcy (Zamów razem + batch Główne). */
export const procurementSupplierBlockFooterClass = "px-2.5 py-1 sm:px-3";

/** Etykieta scope w footerze (Zamów razem / Tylko ta osoba). */
export const procurementRequestFooterScopeLabelClass =
  "shrink-0 text-[10px] font-medium leading-none text-slate-400";
