import { INFORMACJA_STOCK_OUT_PANEL_BADGE } from "@/lib/orders/informacja-flow-copy";
import { FlowChevron } from "@/components/ui/UiGlyphs";
import { INFORMACJA_FLOW_LINE_BADGE_STYLES } from "@/lib/orders/informacja-flow-ui";
import { cn } from "@/lib/cn";

type LineWithFlow = {
  informacjaViaPanel?: boolean;
  informacjaStockOut?: boolean;
};

/** Etykieta ścieżki informacji na pozycji w panelu Dziś. */
export function InformacjaFlowLineBadge({
  line,
  className,
}: {
  line: LineWithFlow;
  className?: string;
}) {
  if (line.informacjaStockOut) {
    return (
      <span
        className={cn(
          "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          INFORMACJA_FLOW_LINE_BADGE_STYLES.amber,
          className
        )}
      >
        {INFORMACJA_STOCK_OUT_PANEL_BADGE}
      </span>
    );
  }
  if (line.informacjaViaPanel) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          INFORMACJA_FLOW_LINE_BADGE_STYLES.indigo,
          className
        )}
      >
        <span>Magazyn</span>
        <FlowChevron size={10} className="text-indigo-400/90" />
        <span>info</span>
      </span>
    );
  }
  return null;
}
