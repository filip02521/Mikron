"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import {
  collectZkWatchPendingAckOrderIdsFromItems,
  zkWatchPendingAckKindBadgeLabel,
  zkWatchPendingAckKindBadgeVariant,
  type ZkWatchPendingAckItem,
} from "@/lib/sales/zk-watch-close-pending";
import { salesTypography } from "@/lib/ui/ontime-theme";
import type { SalesZkWatch } from "@/types/database";

function polishCountLabel(
  n: number,
  forms: [string, string, string]
): string {
  if (n === 1) return `${n} ${forms[0]}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} ${forms[1]}`;
  }
  return `${n} ${forms[2]}`;
}

export function ZkWatchClosePendingModal({
  watch,
  items,
  readOnly,
  tourPreview,
  open,
  refreshing,
  confirming,
  actionError,
  onClose,
  onConfirmAll,
}: {
  watch: SalesZkWatch;
  items: ZkWatchPendingAckItem[];
  readOnly?: boolean;
  tourPreview?: boolean;
  open: boolean;
  refreshing?: boolean;
  confirming?: boolean;
  /** Błąd z karty (np. po dialogu półki) — wyświetlany w modalu zamiast na karcie. */
  actionError?: string | null;
  onClose: () => void;
  onConfirmAll: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [listUpdatedHint, setListUpdatedHint] = useState(false);
  const previousItemCountRef = useRef<number | null>(null);
  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const focusOrderIds = useMemo(
    () => collectZkWatchPendingAckOrderIdsFromItems(items),
    [items]
  );
  const uniqueCount = focusOrderIds.length;
  const pendingNoticeCount = items.length;
  const previewHref = useMemo(
    () =>
      appendMojeFocusOrderIds(
        buildMojeClientLink(watch.sales_person_id, watch.client_label, {
          preview: readOnly || tourPreview,
          clientKhId: watch.client_kh_id,
          zkWatchId: watch.id,
          zkNumber: watch.zk_number,
        }),
        focusOrderIds
      ),
    [watch, readOnly, tourPreview, focusOrderIds]
  );

  useEffect(() => {
    if (!open) {
      previousItemCountRef.current = null;
      queueMicrotask(() => setListUpdatedHint(false));
      return;
    }
    queueMicrotask(() => setError(null));
  }, [open]);

  useEffect(() => {
    if (!open || refreshing) return;
    const previousCount = previousItemCountRef.current;
    if (previousCount != null && previousCount !== items.length) {
      queueMicrotask(() => setListUpdatedHint(true));
    }
    previousItemCountRef.current = items.length;
  }, [open, items.length, refreshing]);

  async function handleConfirmAll() {
    if (confirming || refreshing) return;
    setError(null);
    try {
      await onConfirmAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się potwierdzić pozycji.");
    }
  }

  const busy = confirming || refreshing;
  const displayError = actionError ?? error;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="md"
      tier="top"
      role="alertdialog"
      disableBackdropClose={busy}
      loadingMessage={
        refreshing ? "Odświeżam listę…" : confirming ? "Potwierdzanie pozycji…" : null
      }
      title={`${displayNumber} — niepotwierdzone pozycje`}
      description={watch.client_label}
      bodyClassName="space-y-4 px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Anuluj
          </Button>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <Link
              href={previewHref}
              onClick={busy ? (event) => event.preventDefault() : onClose}
              className={cn(
                "inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50",
                "w-full sm:w-auto",
                busy && "pointer-events-none opacity-50"
              )}
              aria-disabled={busy || undefined}
              tabIndex={busy ? -1 : undefined}
            >
              Podgląd w Moje
            </Link>
            <Button
              type="button"
              size="sm"
              disabled={busy || items.length === 0}
              className="w-full sm:w-auto"
              onClick={() => void handleConfirmAll()}
            >
              {confirming ? "Potwierdzanie…" : "Potwierdź wszystkie i zamknij"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-3 text-sm text-amber-950">
        <p className="font-medium">
          Zanim zamkniesz sprawę, w /moje czeka{" "}
          {polishCountLabel(uniqueCount, ["prośba", "prośby", "prośb"])} do potwierdzenia
          {pendingNoticeCount > uniqueCount
            ? ` (${polishCountLabel(pendingNoticeCount, [
                "powiadomienie",
                "powiadomienia",
                "powiadomień",
              ])})`
            : ""}
          .
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-amber-900/90">
          Możesz je przejrzeć w panelu Moje, potwierdzić od razu albo anulować — wtedy ZK
          pozostanie otwarte.
        </p>
      </div>

      {listUpdatedHint ? (
        <p
          className={cn(
            salesTypography.rowMeta,
            "rounded-md border border-sky-200/90 bg-sky-50/80 px-3 py-2 text-sky-900"
          )}
          role="status"
        >
          Lista została zaktualizowana — sprawdź pozycje przed potwierdzeniem.
        </p>
      ) : null}

      {displayError ? (
        <p className={cn(salesTypography.rowMeta, "text-rose-700")} role="alert">
          {displayError}
        </p>
      ) : null}

      <div>
        <p className={cn(salesTypography.kindTag, "mb-2 text-slate-500")}>
          Pozycje oczekujące na potwierdzenie
        </p>
        <ul
          className={cn(
            "divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white",
            refreshing && "opacity-60"
          )}
          aria-busy={refreshing || undefined}
        >
          {items.map((item) => (
            <li
              key={`${item.orderId}:${item.kind}`}
              className="flex items-start gap-3 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className={cn(salesTypography.rowTitle, "text-slate-900")}>
                  {item.productLabel}
                </p>
                <p className={cn(salesTypography.rowMeta, "mt-0.5 text-slate-600")}>
                  {[item.symbol, item.quantityLabel].filter(Boolean).join(" · ")}
                </p>
                <p className={cn(salesTypography.rowMeta, "mt-1 text-slate-500")}>
                  {item.statusLabel}
                </p>
              </div>
              <Badge
                variant={zkWatchPendingAckKindBadgeVariant(item.kind)}
                className="shrink-0 text-[9px]"
              >
                {zkWatchPendingAckKindBadgeLabel(item.kind)}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </ModalShell>
  );
}
