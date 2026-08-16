import { ZdEstimateRouteLoading } from "@/components/zakupy/ZdEstimateRouteLoading";
import { zdEstimatePageShellClass } from "@/lib/ui/ontime-theme";

/**
 * Loading RSC — animowana checklista bootstrapu (nie kroki Policz).
 * Ten sam fill-viewport shell co page.tsx, żeby karta nie siedziała u góry.
 */
export default function ZdEstimateLoading() {
  return (
    <div data-zd-estimate-viewport className={zdEstimatePageShellClass}>
      <ZdEstimateRouteLoading />
    </div>
  );
}
