"use client";

import { Button } from "@/components/ui/Button";
import { ZkProsbaLinkChip } from "@/components/orders/ZkProsbaLinkChip";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { formatProsbaCount } from "@/lib/orders/my-order-plural";

export function MojeClientKhFilterBanner({
  clientLabel,
  zkNumber,
  zkWatchId,
  salesPersonId,
  matchCount,
  totalCount,
  onClear,
}: {
  clientLabel?: string | null;
  zkNumber?: string | null;
  zkWatchId?: string | null;
  salesPersonId?: string | null;
  matchCount?: number;
  totalCount: number;
  onClear: () => void;
}) {
  const displayName = clientLabel?.trim() || null;
  const zk = zkNumber?.trim();
  const matched = matchCount ?? 0;

  const matchLabel =
    matched === 0
      ? "Brak pasujących prośb na liście"
      : matched === 1
        ? "1 prośba na liście"
        : formatProsbaCount(matched);

  const scopeLabel = zk
    ? null
    : displayName
      ? `Prośby klienta: ${displayName}`
      : "Prośby powiązane z notatnikiem";

  return (
    <div
      className={cn(
        "border-b border-slate-200/80 bg-slate-50/90 px-3 py-2.5 sm:px-4 lg:px-6",
        "flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
      )}
      role="status"
    >
      <div className="min-w-0">
        {scopeLabel ? (
          <p className={cn(salesTypography.rowTitle, "text-slate-900")}>{scopeLabel}</p>
        ) : (
          <p className={cn(salesTypography.rowTitle, "text-slate-900")}>
            <span className="font-medium text-slate-700">Prośby · </span>
            <ZkProsbaLinkChip
              zkNumber={zk!}
              zkWatchId={zkWatchId}
              salesPersonId={salesPersonId}
              inline
            />
            {displayName ? (
              <span className="font-medium text-slate-700"> · {displayName}</span>
            ) : null}
          </p>
        )}
        <p className={cn("mt-0.5", salesTypography.rowMeta, "text-slate-600")}>
          {matchLabel}
          {totalCount > 0 ? (
            <>
              {" "}
              · pełna lista ma{" "}
              <span className="font-semibold tabular-nums">{totalCount}</span>{" "}
              {totalCount === 1 ? "prośbę" : totalCount < 5 ? "prośby" : "prośb"}
            </>
          ) : null}
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onClear}
        className="shrink-0"
      >
        Pokaż całą listę
        {totalCount > 0 ? (
          <span className="ml-1 tabular-nums text-slate-500">({totalCount})</span>
        ) : null}
      </Button>
    </div>
  );
}
