import { IconCircleCheck, IconWarehouse } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  zkWatchProsbaCoveredMeta,
  type ZkWatchProsbaCoveredReason,
} from "@/lib/sales/zk-watch-line-ui-state";
import { zkWatchProsbaSettledStatusClass } from "@/lib/ui/zk-watch-attention-styles";
import { zkWatchRowActionStatusClass } from "@/lib/ui/zk-watch-row-action-styles";

export function ZkWatchProsbaCoveredChip({
  reason,
  className,
  size = "default",
}: {
  reason: ZkWatchProsbaCoveredReason;
  className?: string;
  size?: "default" | "compact";
}) {
  const meta = zkWatchProsbaCoveredMeta(reason);
  const Icon = reason === "scope_excluded" ? IconWarehouse : IconCircleCheck;
  const isRowSettled = size === "compact" && reason === "complete";

  return (
    <span
      className={cn(
        zkWatchRowActionStatusClass,
        size === "compact" ? "px-2" : "px-2.5",
        isRowSettled ? zkWatchProsbaSettledStatusClass : meta.badgeClass,
        className
      )}
      title={meta.detail}
    >
      <Icon size={12} strokeWidth={2.25} className="shrink-0 text-current opacity-90" />
      <span>{meta.shortLabel}</span>
    </span>
  );
}
