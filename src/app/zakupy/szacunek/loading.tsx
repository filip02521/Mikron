import { ZdEstimateRouteLoading } from "@/components/zakupy/ZdEstimateRouteLoading";
import { zdEstimatePageShellClass } from "@/lib/ui/ontime-theme";

/**
 * Loading RSC — krótki bootstrap kreatora.
 * Pełne wznowienie sesji robi workbench (jeden gate resume).
 */
export default function ZdEstimateLoading() {
  return (
    <div data-zd-estimate-viewport className={zdEstimatePageShellClass}>
      <ZdEstimateRouteLoading />
    </div>
  );
}
