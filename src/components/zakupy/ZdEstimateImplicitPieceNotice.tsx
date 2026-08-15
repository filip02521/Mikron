"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  ZD_ESTIMATE_UI,
  type ImplicitPieceSnapshotNotice,
} from "@/lib/orders/zd-estimate-ui-copy";

/**
 * Preflight przy potwierdzeniu Create / Powiąż ZD — nie w trakcie przeglądania listy.
 * Ostrzeżenie + chipy + CTA do poprawy jednostek przed snapshotem.
 */
export function ZdEstimateImplicitPieceNotice({
  notice,
  onOpenPackaging,
  onOpenPairs,
  className,
}: {
  notice: ImplicitPieceSnapshotNotice;
  onOpenPackaging?: () => void;
  onOpenPairs?: () => void;
  className?: string;
}) {
  const showActions = Boolean(onOpenPackaging || onOpenPairs);

  return (
    <div className={className}>
      <Alert tone="warning" title={notice.title}>
        <div className="space-y-2.5">
          <p className="text-sm leading-snug text-amber-950/95">
            <span className="font-semibold tabular-nums text-amber-950">
              {notice.countLabel}
            </span>{" "}
            bez opakowania ani pary.
          </p>
          <p className="text-sm leading-snug text-amber-950/85">{notice.body}</p>

          <ul
            className="flex flex-wrap gap-1.5"
            aria-label="Przykładowe pozycje bez opakowania"
          >
            {notice.samples.map((s) => (
              <li key={s.twId}>
                <span
                  className="inline-flex max-w-[11rem] items-center truncate rounded-md bg-amber-100/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-950 ring-1 ring-amber-200/80"
                  title={`${s.symbol} · tw_Id ${s.twId}`}
                >
                  {s.symbol}
                </span>
              </li>
            ))}
            {notice.moreCount > 0 ? (
              <li>
                <span className="inline-flex items-center rounded-md bg-white/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-900/80 ring-1 ring-amber-200/70">
                  +{notice.moreCount}
                </span>
              </li>
            ) : null}
          </ul>

          <p className="text-xs leading-snug text-amber-900/75">
            {ZD_ESTIMATE_UI.implicitPieceSnapshotContinueHint}
          </p>

          {showActions ? (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {onOpenPackaging ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onOpenPackaging}
                >
                  {ZD_ESTIMATE_UI.implicitPieceSnapshotOpenPackagingCta}
                </Button>
              ) : null}
              {onOpenPairs ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onOpenPairs}
                >
                  {ZD_ESTIMATE_UI.implicitPieceSnapshotOpenPairsCta}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Alert>
    </div>
  );
}
