"use client";

import { useEffect, useState, useTransition } from "react";
import { actionFetchZdEstimateProductReservations } from "@/app/actions/zd-estimate";
import type { ZdEstimateReservedZkRow } from "@/lib/orders/zd-estimate-reservations";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { formatPlDate } from "@/lib/display-labels";
import { formatZdEstimateTableQty } from "@/lib/orders/zd-estimate-table-qty";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { cn } from "@/lib/cn";

function formatIssuedAt(iso: string | null): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  return formatPlDate(day) || day;
}

function SummaryChip({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-[6.5rem] flex-1 rounded-lg border px-3 py-2.5",
        emphasize
          ? "border-amber-200/90 bg-amber-50/80"
          : "border-slate-200/90 bg-white"
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums leading-tight",
          emphasize ? "text-amber-950" : "text-slate-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ReservationZkCard({ row }: { row: ZdEstimateReservedZkRow }) {
  return (
    <li className="rounded-lg border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm shadow-slate-900/[0.02] sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold tabular-nums text-slate-900">
              {row.zkNumber}
            </h3>
            <span
              className="inline-flex shrink-0 items-center rounded-md border border-amber-200/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
              title={row.statusDescription ?? undefined}
            >
              {row.statusLabel}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-slate-800">{row.clientLabel}</p>
          {row.clientSymbol ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Symbol: {row.clientSymbol}
            </p>
          ) : null}
          {row.statusDescription ? (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              {row.statusDescription}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold tabular-nums leading-none text-slate-900">
            {formatZdEstimateTableQty(row.quantity)}
          </div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            szt.
          </div>
          <div className="mt-2 text-xs tabular-nums text-slate-500">
            {formatIssuedAt(row.issuedAt)}
          </div>
        </div>
      </div>
    </li>
  );
}

export function ZdEstimateReservationsModal({
  open,
  onClose,
  twId,
  symbol,
  name,
  listReservedQty,
}: {
  open: boolean;
  onClose: () => void;
  twId: number;
  symbol: string;
  name: string;
  /** Wartość z kolumny Rez. na liście (podgląd zanim dociągnie API). */
  listReservedQty: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ZdEstimateReservedZkRow[]>([]);
  const [reservedQtySum, setReservedQtySum] = useState(0);
  const [stanRez, setStanRez] = useState(listReservedQty);
  const [truncated, setTruncated] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRows([]);
    setReservedQtySum(0);
    setStanRez(listReservedQty);
    setTruncated(false);
    setLoaded(false);

    startTransition(async () => {
      try {
        const result = await actionFetchZdEstimateProductReservations({ twId });
        if (!result.ok) {
          setError(
            userFacingErrorText(result.message, ZD_ESTIMATE_UI.reservationsLoadError)
          );
          setLoaded(true);
          return;
        }
        setRows(result.rows);
        setReservedQtySum(result.reservedQtySum);
        setStanRez(result.summary.stanRez || listReservedQty);
        setTruncated(result.truncated);
        setLoaded(true);
      } catch (e) {
        setError(userFacingErrorText(e, ZD_ESTIMATE_UI.reservationsLoadError));
        setLoaded(true);
      }
    });
  }, [open, twId, listReservedQty]);

  const productSymbol = symbol.trim();
  const productName = name.trim();
  const listSubtitle =
    loaded && !error && rows.length > 0
      ? ZD_ESTIMATE_UI.reservationsListSummary(rows.length, reservedQtySum)
      : undefined;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="lg"
      title={ZD_ESTIMATE_UI.reservationsModalTitle}
      titleHint={ZD_ESTIMATE_UI.reservationsModalHint}
      description={listSubtitle}
      bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending && !loaded ? ZD_ESTIMATE_UI.reservationsLoading : undefined}
    >
      <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3.5 py-3 sm:px-4">
        {productSymbol ? (
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {productSymbol}
          </div>
        ) : null}
        <div className="mt-0.5 text-sm font-semibold text-slate-900">
          {productName || `Towar #${twId}`}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SummaryChip
          label="Rez. na liście"
          value={formatZdEstimateTableQty(listReservedQty)}
          emphasize
        />
        {loaded && !error ? (
          <>
            <SummaryChip
              label="Stan zarezerwowany"
              value={formatZdEstimateTableQty(stanRez)}
            />
            <SummaryChip
              label="Suma z ZK"
              value={formatZdEstimateTableQty(reservedQtySum)}
            />
            <SummaryChip
              label="Liczba ZK"
              value={String(rows.length)}
            />
          </>
        ) : null}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {truncated ? (
        <Alert tone="warning">{ZD_ESTIMATE_UI.reservationsTruncated}</Alert>
      ) : null}

      {pending && !loaded ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Spinner size="sm" />
          {ZD_ESTIMATE_UI.reservationsLoading}
        </div>
      ) : null}

      {loaded && !error && rows.length === 0 ? (
        <EmptyState
          title={ZD_ESTIMATE_UI.reservationsEmptyTitle}
          description={ZD_ESTIMATE_UI.reservationsEmptyBody}
        />
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-2" aria-label={ZD_ESTIMATE_UI.reservationsListAriaLabel}>
          {rows.map((row) => (
            <ReservationZkCard
              key={`${row.dokId}-${row.lineId ?? "line"}`}
              row={row}
            />
          ))}
        </ul>
      ) : null}
    </ModalShell>
  );
}
