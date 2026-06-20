"use client";

import { ProsbaOptionalSection } from "@/components/orders/ProsbaOptionalSection";
import { ZK_WATCH_STATUS_GUIDE_COPY } from "@/lib/sales/zk-watch-status-guide-copy";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";
import { ZkWatchStatusGuideContent } from "./ZkWatchStatusGuideContent";

/** Zwijana legenda statusów pozycji ZK — spójna ze skrótami klawiszowymi na innych stronach. */
export function ZkWatchStatusGuideStrip({
  className,
  embedded = true,
  defaultOpen = false,
  open,
  onOpenChange,
}: {
  className?: string;
  embedded?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const copy = ZK_WATCH_STATUS_GUIDE_COPY;

  return (
    <div
      className={cn(
        embedded
          ? cn(salesChromeInsetClass, "border-b border-slate-100 bg-white py-2")
          : "py-2",
        className
      )}
    >
      <ProsbaOptionalSection
        kind="zk-status"
        title={copy.title}
        description={copy.description}
        showOptionalLabel={false}
        defaultOpen={defaultOpen}
        open={open}
        onOpenChange={onOpenChange}
        summaryClassName="items-center py-2"
        bodyClassName="pb-2.5 pt-2"
        className={embedded ? "bg-indigo-50/35" : undefined}
      >
        <ZkWatchStatusGuideContent compact />
      </ProsbaOptionalSection>
    </div>
  );
}
