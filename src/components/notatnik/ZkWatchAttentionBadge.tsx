import type { ComponentType } from "react";
import {
  IconBell,
  IconCircleCheck,
  IconInfoCircle,
  IconLayers,
  IconSparkles,
  IconWarehouse,
  type StrokeIconProps,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import type { ZkWatchRowAttentionKind } from "@/lib/sales/zk-watch-row-attention";
import { zkWatchRowAttentionBadgeClass } from "@/lib/ui/zk-watch-attention-styles";

const ICON_BY_KIND: Partial<
  Record<ZkWatchRowAttentionKind, ComponentType<StrokeIconProps>>
> = {
  regal_new: IconWarehouse,
  regal_waiting: IconWarehouse,
  follow_up_due: IconBell,
  informacja_ready: IconInfoCircle,
  new_lines: IconLayers,
  newly_added: IconSparkles,
  ready_to_close: IconCircleCheck,
};

export function ZkWatchAttentionBadge({
  kind,
  label,
  title,
  className,
}: {
  kind: ZkWatchRowAttentionKind;
  label: string;
  title?: string;
  className?: string;
}) {
  const Icon = ICON_BY_KIND[kind];

  return (
    <span
      className={cn(zkWatchRowAttentionBadgeClass(kind), className)}
      title={title}
    >
      {Icon ? (
        <Icon
          size={10}
          strokeWidth={2.35}
          className="shrink-0 opacity-[0.88]"
        />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
