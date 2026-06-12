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
}: {
  variant: DailyPanelUnseenVariant;
  nestedInBlock?: boolean;
  isUnseen?: boolean;
  isFocused?: boolean;
  highlightFresh?: boolean;
  pending?: boolean;
}) {
  const isStockOut = variant === "stockOut";

  return cn(
    panelRowGroupClass(
      nestedInBlock
        ? "rounded-none border-0 bg-transparent shadow-none transition-colors hover:bg-white/70"
        : cn(
            "rounded-md border border-slate-200 bg-white shadow-sm transition-shadow hover:border-slate-300/90",
            isStockOut && "hover:border-amber-200/80"
          )
    ),
    pending && rowPendingRingClass,
    isFocused &&
      (isStockOut
        ? "relative z-10 ring-2 ring-inset ring-amber-400/70"
        : "relative z-10 ring-2 ring-inset ring-violet-400/70"),
    isUnseen && dailyPanelUnseenRequestRowClass(variant, { nestedInBlock }),
    highlightFresh && isUnseen && dailyPanelFreshHighlightClass
  );
}

/** Meta wiersza prośby w bloku dostawcy — bez powtarzania nazwy dostawcy. */
export function procurementNestedRowMeta({ countLabel }: { countLabel: string }): string {
  return countLabel;
}
