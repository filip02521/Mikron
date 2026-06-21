import { IconCircleCheck, IconWarehouse } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  zkWatchProsbaCoveredMeta,
  type ZkWatchProsbaCoveredReason,
} from "@/lib/sales/zk-watch-line-ui-state";
import { salesTypography } from "@/lib/ui/ontime-theme";

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

  return (
    <span
      className={cn(
        salesTypography.kindTag,
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold",
        size === "compact" ? "px-1.5 py-0.5 text-[0.62rem]" : "px-2 py-0.5 text-[0.68rem]",
        meta.badgeClass,
        className
      )}
      title={meta.detail}
    >
      <Icon size={size === "compact" ? 11 : 12} strokeWidth={2.25} className="text-current opacity-90" />
      <span>{meta.shortLabel}</span>
    </span>
  );
}
