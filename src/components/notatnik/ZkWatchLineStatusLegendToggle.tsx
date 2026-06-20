"use client";

import { ProsbaOptionalSection } from "@/components/orders/ProsbaOptionalSection";
import {
  buildContextualZkWatchStatusLegend,
} from "@/lib/sales/zk-watch-contextual-status-legend";
import type { ZkWatchLineUiStateCounts } from "@/lib/sales/zk-watch-line-ui-state";
import { ZkWatchLineStatusChip } from "./ZkWatchLineStatusChip";

export function ZkWatchLineStatusLegendToggle({
  counts,
}: {
  counts: ZkWatchLineUiStateCounts;
}) {
  const items = buildContextualZkWatchStatusLegend(counts);
  if (items.length === 0) return null;

  return (
    <ProsbaOptionalSection
      kind="zk-status"
      title="Co oznaczają statusy?"
      description="Tylko stany obecne w tym ZK"
      showOptionalLabel={false}
      summaryClassName="items-center py-1.5"
      bodyClassName="pb-2 pt-1.5"
      className="border-slate-200/70 bg-white/80"
    >
      <ul className="space-y-1.5">
        {items.map(({ state, hint }) => (
          <li
            key={state}
            className="flex items-start gap-2 text-[0.68rem] leading-snug text-slate-600"
          >
            <ZkWatchLineStatusChip state={state} className="mt-px shrink-0 scale-90" />
            <span>{hint}</span>
          </li>
        ))}
      </ul>
    </ProsbaOptionalSection>
  );
}
