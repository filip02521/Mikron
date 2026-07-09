"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import {
  collectZkWatchPendingAckOrderIdsFromItems,
  zkWatchPendingAckKindBadgeLabel,
  type ZkWatchPendingAckKind,
  type ZkWatchPendingAckItem,
} from "@/lib/sales/zk-watch-close-pending";
import { salesTypography } from "@/lib/ui/ontime-theme";
import type { SalesZkWatch } from "@/types/database";
import { IconCircleCheck, IconClock } from "@/components/icons/StrokeIcons";

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

const PENDING_ACK_BADGE_CLASS: Record<ZkWatchPendingAckKind, string> = {
  pickup: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/80",
  teeth_handover: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/80",
  availability: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200/80",
  cancel_notice: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/80",
  cancelled: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200/80",
  zd_deadline: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/80",
};

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
}: {
  watch: SalesZkWatch;
  items: ZkWatchPendingAckItem[];
  readOnly?: boolean;
  tourPreview?: boolean;
  open: boolean;
  refreshing?: boolean;
  confirming?: boolean;
  actionError?: string | null;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
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
      return;
    }
    queueMicrotask(() => setError(null));
  }, [open]);

  const busy = confirming || refreshing;
  const displayError = actionError ?? error;
  const phase: "confirming" | "done" | "error" = displayError
    ? "error"
    : confirming
      ? "confirming"
      : "done";

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
      title={`${displayNumber} — zamykanie`}
      description={watch.client_label}
      bodyClassName="space-y-3 px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Link
            href={previewHref}
            onClick={busy ? (event) => event.preventDefault() : onClose}
            className={cn(
              "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900",
              busy && "pointer-events-none opacity-50"
            )}
            aria-disabled={busy || undefined}
            tabIndex={busy ? -1 : undefined}
          >
            Podgląd w Moje
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            className="shrink-0"
            onClick={onClose}
          >
            Zamknij
          </Button>
        </div>
      }
    >
      {/* Status banner */}
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-medium",
          phase === "confirming" && "bg-sky-50 text-sky-900",
          phase === "done" && "bg-emerald-50 text-emerald-900",
          phase === "error" && "bg-rose-50 text-rose-900"
        )}
      >
        {phase === "confirming" ? (
          <IconClock size={18} className="shrink-0 animate-spin text-sky-600" />
        ) : phase === "done" ? (
          <IconCircleCheck size={18} className="shrink-0 text-emerald-600" />
        ) : null}
        <span>
          {phase === "confirming"
            ? `Potwierdzam ${polishCountLabel(uniqueCount, ["prośbę", "prośby", "prośb"])} i zamykam ZK…`
            : phase === "done"
              ? `Potwierdzono ${polishCountLabel(uniqueCount, ["prośbę", "prośby", "prośb"])} — ZK zostało zamknięte.`
              : "Wystąpił błąd — sprawdź szczegóły poniżej."}
        </span>
      </div>

      {displayError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5 text-sm text-rose-800" role="alert">
          {displayError}
        </div>
      ) : null}

      {/* Items list */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Pozycje ({items.length})
        </p>
        <ul
          className={cn(
            "divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white",
            refreshing && "opacity-60"
          )}
          aria-busy={refreshing || undefined}
        >
          {items.map((item) => (
            <li
              key={`${item.orderId}:${item.kind}`}
              className="flex items-start gap-3 px-3.5 py-3 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {item.productLabel}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[item.symbol, item.quantityLabel].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.statusLabel}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none",
                  PENDING_ACK_BADGE_CLASS[item.kind]
                )}
              >
                {zkWatchPendingAckKindBadgeLabel(item.kind)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ModalShell>
  );
}
