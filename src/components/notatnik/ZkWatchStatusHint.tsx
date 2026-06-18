"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { zkWatchStatusHintDismissedStore } from "@/lib/sales/zk-watch-status-hint-storage";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { ZkWatchStatusGuideContent } from "./ZkWatchStatusGuideContent";

export function ZkWatchStatusHint({
  tourPreview = false,
}: {
  /** W tourze zawsze pokazuj — bez zapisu „ukryj”. */
  tourPreview?: boolean;
}) {
  const hidden = usePersistedFlag(zkWatchStatusHintDismissedStore);

  if (!tourPreview && hidden) return null;

  function dismiss() {
    if (tourPreview) return;
    zkWatchStatusHintDismissedStore.setValue(true);
  }

  return (
    <div
      className={cn(
        "border-b border-indigo-100/90 bg-indigo-50/45 px-3 py-3 sm:px-4",
        salesChromeInsetClass
      )}
      data-zk-status-hint=""
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className={cn(salesTypography.blockTitle, "text-indigo-950")}>
              Co oznaczają statusy pozycji ZK?
            </p>
            <p className={cn("mt-0.5", salesTypography.sectionHint, "text-indigo-950/75")}>
              Regal → odbiór w Moje → zakończenie w ZK. Chip obok pozycji pokazuje aktualny etap.
            </p>
          </div>
          <ZkWatchStatusGuideContent compact />
        </div>
        {!tourPreview ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 text-xs"
            onClick={dismiss}
          >
            Rozumiem
          </Button>
        ) : null}
      </div>
    </div>
  );
}
