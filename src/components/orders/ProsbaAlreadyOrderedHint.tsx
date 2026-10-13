"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import { buildProsbaLineStockStatusView } from "@/lib/orders/prosba-line-stock-ui";
import { stockSnapshotFromLineDraft } from "@/lib/orders/prosba-stock-check";
import type { IndividualRequestKind } from "@/types/database";
import { cn } from "@/lib/cn";
import {
  buildProsbaAlreadyOrderedView,
  formatPieces,
  incomingForOwnZk,
  prosbaAlreadyOrderedStockTone,
  prosbaLineRequestedQty,
  type ProsbaAlreadyOrderedInfo,
} from "@/lib/orders/prosba-already-ordered";
import {
  ProsbaLineSupplierMeta,
  useProsbaLineSupplierTiming,
  type ProsbaLineSupplierTimingProps,
} from "@/components/orders/ProsbaSupplierContext";

type Tone = ReturnType<typeof prosbaAlreadyOrderedStockTone>;

/** Odznaka w zwiniętym wierszu — neutralna ramka, kolor tylko w tekście. */
export const PROSBA_ALREADY_ORDERED_BADGE: Record<Tone, string> = {
  amber: "bg-white text-amber-900 ring-1 ring-slate-200/90",
  sky: "bg-white text-sky-900 ring-1 ring-slate-200/90",
  slate: "bg-white text-slate-700 ring-1 ring-slate-200/90",
  emerald: "bg-white text-emerald-900 ring-1 ring-slate-200/90",
};

/**
 * Podpowiedź „w drodze” — tekst + akcja, bez ikonowych kafelków i animacji wejścia.
 */
export function ProsbaAlreadyOrderedHint({
  info,
  requestedQty,
  onSwitchToNotify,
  onRemoveLine,
  forOther = false,
  focusNotifyOnMount = false,
  onNotifyFocused,
  className,
}: {
  info: ProsbaAlreadyOrderedInfo | null | undefined;
  requestedQty?: number | null;
  onSwitchToNotify?: () => void;
  onRemoveLine?: () => void;
  forOther?: boolean;
  focusNotifyOnMount?: boolean;
  onNotifyFocused?: () => void;
  className?: string;
}) {
  const view = buildProsbaAlreadyOrderedView(info, { forOther, requestedQty });
  const notifyRef = useRef<HTMLButtonElement>(null);
  const hasNotify = Boolean(view?.suggestNotify && onSwitchToNotify);
  useEffect(() => {
    if (!focusNotifyOnMount || !hasNotify) return;
    notifyRef.current?.focus({ preventScroll: true });
    onNotifyFocused?.();
  }, [focusNotifyOnMount, hasNotify, onNotifyFocused]);

  if (!view) return null;
  const showRemove = view.tone === "mine" && onRemoveLine;

  return (
    <div role="status" aria-live="polite" className={cn("space-y-1.5", className)}>
      <p className="text-[13px] font-semibold leading-snug tracking-tight tabular-nums text-slate-900">
        {view.title}
      </p>
      <ul className="space-y-0.5 text-[12px] leading-snug text-slate-600 tabular-nums">
        {view.details.map((line, i) => (
          <li key={`${i}-${line}`} className="break-words">
            {line}
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-snug text-slate-500">{view.advice}</p>
      {hasNotify || showRemove ? (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {hasNotify ? (
            <Button
              ref={notifyRef}
              type="button"
              size="sm"
              variant="outline"
              className="min-h-9"
              onClick={onSwitchToNotify}
            >
              Tylko powiadom, gdy dotrze
            </Button>
          ) : null}
          {showRemove ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-9"
              onClick={onRemoveLine}
            >
              Usuń tę pozycję
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProsbaNotifySwitchedNote({
  onUndo,
  className,
}: {
  onUndo: () => void;
  className?: string;
}) {
  const undoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    undoRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 text-sm",
        className
      )}
    >
      <div className="min-w-0">
        <p className="font-medium text-slate-900">
          Powiadomienie zamiast zamówienia
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          Magazyn da znać, gdy towar będzie na stanie.
        </p>
      </div>
      <Button
        ref={undoRef}
        type="button"
        size="sm"
        variant="outline"
        className="min-h-9 shrink-0"
        onClick={onUndo}
      >
        Cofnij
      </Button>
    </div>
  );
}

/** Komórka metryki — kompaktowa (czytelna, nie „dashboard”). */
function AvailabilityStat({
  label,
  value,
  note,
  quiet,
  emphasis,
  hint,
}: {
  label: string;
  value: string;
  note?: string | null;
  quiet?: boolean;
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <div
      title={hint}
      className={cn(
        "-m-px flex min-w-0 flex-col items-center justify-center border border-slate-200/90 px-1.5 py-1.5 text-center sm:px-2 sm:py-2",
        emphasis ? "bg-indigo-50/70" : "bg-white",
        quiet && "opacity-65"
      )}
    >
      <dd
        className={cn(
          "text-[13px] font-semibold leading-none tabular-nums sm:text-sm",
          quiet
            ? "text-slate-400"
            : emphasis
              ? "text-indigo-900"
              : "text-slate-900"
        )}
      >
        {value}
      </dd>
      <dt
        className={cn(
          "mt-1 text-[10px] font-medium leading-none",
          emphasis ? "text-indigo-800" : "text-slate-500"
        )}
      >
        {label}
      </dt>
      {note ? (
        <p className="mt-0.5 text-[10px] leading-none text-slate-500">{note}</p>
      ) : null}
    </div>
  );
}

/**
 * Werdykt + 3 panele (stan / w drodze / wolne) w skali formularza + meta dostawcy.
 */
export function ProsbaAvailabilityCard({
  line,
  requestKind,
  info,
  checking = false,
  forOther = false,
  onSwitchToNotify,
  onRemoveLine,
  focusNotifyOnMount = false,
  onNotifyFocused,
  supplierTiming = null,
  className,
}: {
  line: ProductLineDraft;
  requestKind: IndividualRequestKind;
  info: ProsbaAlreadyOrderedInfo | null | undefined;
  checking?: boolean;
  forOther?: boolean;
  onSwitchToNotify?: () => void;
  onRemoveLine?: () => void;
  focusNotifyOnMount?: boolean;
  onNotifyFocused?: () => void;
  /** Meta dostawcy tej pozycji — w tej samej sekcji co dostępność. */
  supplierTiming?: ProsbaLineSupplierTimingProps | null;
  className?: string;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const timing = useProsbaLineSupplierTiming(
    supplierTiming ?? {
      supplierId: "",
      suppliers: [],
      supplierScheduleById: {},
      statsBySupplierId: {},
    }
  );

  const requested = prosbaLineRequestedQty(line);
  const stockView =
    requestKind === "zamowienie"
      ? buildProsbaLineStockStatusView(line, requestKind, teethExemptTwIds)
      : null;
  const stock = stockSnapshotFromLineDraft(line);
  const ownZkQty = line.zkQuantity ?? null;
  const incView =
    requestKind === "zamowienie"
      ? buildProsbaAlreadyOrderedView(info, {
          forOther,
          requestedQty: requested,
          ownZkQty,
        })
      : null;
  const inc =
    requestKind === "zamowienie" && info?.incoming
      ? incomingForOwnZk(info.incoming, ownZkQty)
      : null;

  const showAvailability =
    requestKind === "zamowienie" &&
    line.subiektTwId != null &&
    Boolean(stockView || incView || checking);

  const notifyRef = useRef<HTMLButtonElement>(null);
  const useInc =
    showAvailability &&
    incView != null &&
    (incView.tone === "mine" || stockView?.assessment !== "sufficient");
  const canNotify = Boolean(useInc && incView?.suggestNotify && onSwitchToNotify);
  useEffect(() => {
    if (!focusNotifyOnMount || !canNotify) return;
    notifyRef.current?.focus({ preventScroll: true });
    onNotifyFocused?.();
  }, [focusNotifyOnMount, canNotify, onNotifyFocused]);

  if (!showAvailability && !timing) return null;

  const title = showAvailability
    ? useInc
      ? incView!.title
      : stockView
        ? stockView.title
        : checking
          ? "Sprawdzam dostępność…"
          : "Brak danych o stanie"
    : timing?.supplierName ?? null;

  const details = useInc
    ? incView!.tone === "mine"
      ? incView!.details
      : incView!.details.slice(1)
    : [];
  const advice = useInc ? incView!.advice : null;
  const notifyNeedsSplit = Boolean(useInc && incView?.suggestNotify && !onSwitchToNotify);
  const showRemove = Boolean(
    onRemoveLine && useInc && (incView!.tone === "mine" || notifyNeedsSplit)
  );
  const available = stock?.available ?? inc?.available ?? null;
  const reserved = stock?.reserved ?? 0;
  const sufficient = showAvailability && !useInc && stockView?.assessment === "sufficient";
  const freeCoversRequest =
    Boolean(useInc && inc && requested != null && inc.freeIncoming >= requested);
  const emphasizeStock = sufficient;
  const emphasizeFree = !sufficient && freeCoversRequest;
  const nameInTitle = Boolean(!showAvailability && timing?.supplierName);

  const hasFollowUp =
    showAvailability &&
    Boolean(
      details.length > 0 ||
        advice ||
        notifyNeedsSplit ||
        canNotify ||
        showRemove
    );

  const header = (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-x-3 sm:gap-y-1">
      {title ? (
        <p
          role="status"
          className="min-w-0 shrink text-[13px] font-semibold leading-snug tracking-tight tabular-nums text-slate-900"
        >
          {title}
        </p>
      ) : null}
      {timing ? (
        <ProsbaLineSupplierMeta
          timing={timing}
          omitSupplierName={nameInTitle}
          className={cn(
            "min-w-0 sm:max-w-[min(100%,22rem)]",
            showAvailability && "sm:text-right [&_div]:sm:justify-end"
          )}
        />
      ) : null}
    </div>
  );

  if (!showAvailability) {
    return (
      <section
        aria-label="Dostawca pozycji"
        aria-live="polite"
        className={cn("border-t border-slate-200/80 pt-2.5", className)}
      >
        {header}
      </section>
    );
  }

  return (
    <section
      aria-label="Dostępność towaru"
      aria-live="polite"
      aria-busy={checking || undefined}
      className={cn("pt-2.5", className)}
    >
      <div className="overflow-hidden rounded-md border border-slate-200/90">
        <div className="border-b border-slate-200/80 bg-slate-50/60 px-2.5 py-1.5 sm:px-3">
          {header}
        </div>

        <dl className="grid grid-cols-3 overflow-hidden">
          <AvailabilityStat
            label="Na stanie"
            value={available != null ? formatPieces(Math.max(0, available)) : "—"}
            emphasis={emphasizeStock}
            note={
              reserved > 0
                ? `rez. ${reserved}`
                : available != null && available < 0
                  ? `brak ${-available}`
                  : null
            }
          />
          <AvailabilityStat
            label="W drodze"
            value={inc ? formatPieces(inc.incoming) : checking ? "…" : "—"}
            quiet={checking && !inc}
            note={
              inc && inc.zkWaiting > 0
                ? ownZkQty
                  ? `inne ZK ${inc.zkWaiting}`
                  : `ZK ${inc.zkWaiting}`
                : null
            }
          />
          <AvailabilityStat
            label="Wolne z dostawy"
            hint="Część towaru w ZD, której nie zabierają czekające ZK — nie to samo co stan na półce."
            value={
              checking && !inc
                ? "…"
                : inc && inc.incoming > 0
                  ? formatPieces(inc.freeIncoming)
                  : "—"
            }
            quiet={!inc || inc.incoming <= 0}
            emphasis={emphasizeFree}
          />
        </dl>

        {hasFollowUp ? (
          <div className="space-y-1.5 border-t border-slate-200/80 px-2.5 py-2 sm:px-3">
            {details.length > 0 ? (
              <ul className="space-y-0.5 text-[12px] leading-snug text-slate-600 tabular-nums">
                {details.map((d, i) => (
                  <li key={`${i}-${d}`} className="break-words">
                    {d}
                  </li>
                ))}
              </ul>
            ) : null}

            {advice ? (
              <p className="text-[12px] leading-snug text-slate-500">{advice}</p>
            ) : null}
            {notifyNeedsSplit ? (
              <p className="text-[12px] leading-snug text-slate-500">
                Kilka pozycji w prośbie — usuń tę i złóż osobno jako „Informacja o towarze”.
              </p>
            ) : null}

            {canNotify || showRemove ? (
              <div className="flex flex-wrap items-center gap-2">
                {canNotify ? (
                  <Button
                    ref={notifyRef}
                    type="button"
                    size="sm"
                    className="min-h-9"
                    onClick={onSwitchToNotify}
                  >
                    Tylko powiadom, gdy dotrze
                  </Button>
                ) : null}
                {showRemove ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-9 text-slate-600"
                    onClick={onRemoveLine}
                  >
                    Usuń tę pozycję
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
