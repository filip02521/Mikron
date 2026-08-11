import { ZdEstimateRouteLoading } from "@/components/zakupy/ZdEstimateRouteLoading";

/**
 * Loading RSC — animowana checklista bootstrapu (nie kroki Policz).
 * Bez copy „dla dostawcy”; bez udawania wyliczania listy przed wyborem zakresu.
 */
export default function ZdEstimateLoading() {
  return <ZdEstimateRouteLoading />;
}
