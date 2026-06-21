"use client";

import { cn } from "@/lib/cn";
import {
  zkWatchProsbaCoveredMeta,
  type ZkWatchProsbaCoveredReason,
} from "@/lib/sales/zk-watch-line-ui-state";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { ZkWatchProsbaCoveredChip } from "./ZkWatchProsbaCoveredChip";

export function ZkWatchProsbaCoveredPanel({ reason }: { reason: ZkWatchProsbaCoveredReason }) {
  const meta = zkWatchProsbaCoveredMeta(reason);

  return (
    <div className={cn("rounded-lg border px-3 py-2.5 shadow-[var(--shadow-card)]", meta.panelClass)}>
      <ZkWatchProsbaCoveredChip reason={reason} />
      <p className={cn("mt-1.5 text-xs leading-relaxed", meta.detailClass, salesTypography.rowMeta)}>
        {meta.detail}
      </p>
    </div>
  );
}
