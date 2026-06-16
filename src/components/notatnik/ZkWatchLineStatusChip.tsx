import {
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconPackageCheck,
  IconTruck,
  IconWarehouse,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  zkWatchLineUiStateMeta,
  type ZkWatchLineUiState,
} from "@/lib/sales/zk-watch-line-ui-state";
import { salesTypography } from "@/lib/ui/ontime-theme";

function StatusIcon({ state }: { state: ZkWatchLineUiState }) {
  const meta = zkWatchLineUiStateMeta(state);
  const className = "text-current opacity-90";

  switch (meta.icon) {
    case "check":
      return <IconCircleCheck size={12} strokeWidth={2.25} className={className} />;
    case "package":
      return <IconPackageCheck size={12} strokeWidth={2.25} className={className} />;
    case "truck":
      return <IconTruck size={12} strokeWidth={2.25} className={className} />;
    case "clock":
      return <IconClock size={12} strokeWidth={2.25} className={className} />;
    case "alert":
      return <IconAlertCircle size={12} strokeWidth={2.25} className={className} />;
    case "new":
      return (
        <span
          className={cn("size-2 shrink-0 rounded-full bg-amber-500", className)}
          aria-hidden
        />
      );
    case "warehouse":
      return <IconWarehouse size={12} strokeWidth={2.25} className={className} />;
    default:
      return null;
  }
}

export function ZkWatchLineStatusChip({
  state,
  className,
}: {
  state: ZkWatchLineUiState;
  className?: string;
}) {
  const meta = zkWatchLineUiStateMeta(state);
  if (!meta.shortLabel) return null;

  return (
    <span
      className={cn(
        salesTypography.kindTag,
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5",
        meta.badgeClass,
        className
      )}
      title={meta.label}
    >
      <StatusIcon state={state} />
      <span>{meta.shortLabel}</span>
    </span>
  );
}
