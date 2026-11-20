"use client";

import { useEffect, useRef, useState } from "react";
import { IconCircleCheck, IconWarehouse } from "@/components/icons/StrokeIcons";
import {
  prosbaLineOffersStockOutReport,
  type ProsbaStockOutReportResult,
} from "@/lib/orders/prosba-stock-out-report";
import { Button } from "@/components/ui/Button";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import { buildProsbaLineStockStatusView } from "@/lib/orders/prosba-line-stock-ui";
import { stockSnapshotFromLineDraft } from "@/lib/orders/prosba-stock-check";
import type { IndividualRequestKind } from "@/types/database";
import { cn } from "@/lib/cn";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { Badge } from "@/components/ui/Badge";
import { isPastUntil } from "@/components/ui/NewFeatureCallout";

/** Do kiedy przycisk „Zgłoś brak na stanie” ma plakietkę „Nowość” (wcześniej osobne ogłoszenie nad formularzem). */
const STOCK_OUT_NEW_UNTIL = "2026-12-31";
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
  amber: "bg-card text-amber-900 ring-1 ring-slate-200/90",
  sky: "bg-card text-sky-900 ring-1 ring-slate-200/90",
  slate: "bg-card text-slate-700 ring-1 ring-slate-200/90",
  emerald: "bg-card text-emerald-900 ring-1 ring-slate-200/90",
};

/**
 * Podpowiedź „w drodze” — tekst + akcja, bez ikonowych kafelków i animacji wejścia.
 */
export function ProsbaAlreadyOrderedHint({
  info,
  requestedQty,
  ownZkQty = null,
  onSwitchToNotify,
  onRemoveLine,
  forOther = false,
  focusNotifyOnMount = false,
  onNotifyFocused,
  className,
}: {
  info: ProsbaAlreadyOrderedInfo | null | undefined;
  requestedQty?: number | null;
  ownZkQty?: number | null;
  onSwitchToNotify?: () => void;
  onRemoveLine?: () => void;
  forOther?: boolean;
  focusNotifyOnMount?: boolean;
  onNotifyFocused?: () => void;
  className?: string;
}) {
  const view = buildProsbaAlreadyOrderedView(info, {
    forOther,
    requestedQty,
    ownZkQty,
  });
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
      <p className="text-[0.8125rem] font-semibold leading-snug tracking-tight tabular-nums text-slate-900">
        {view.title}
      </p>
      <ul className="space-y-0.5 text-[0.75rem] leading-snug text-slate-600 tabular-nums">
        {view.details.map((line, i) => (
          <li key={`${i}-${line}`} className="break-words">
            {line}
          </li>
        ))}
      </ul>
      <p className="text-[0.75rem] leading-snug text-slate-500">{view.advice}</p>
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
      className={cn(
        "-m-px flex min-w-0 flex-col items-center justify-center border border-slate-200/90 px-1.5 py-1.5 text-center sm:px-2 sm:py-2",
        emphasis ? "bg-indigo-50/70" : "bg-card",
        quiet && "opacity-65"
      )}
    >
      <dt
        className={cn(
          "order-2 mt-1 inline-flex items-center gap-0.5 text-[0.625rem] font-medium leading-none",
          emphasis ? "text-indigo-800" : "text-slate-500"
        )}
      >
        {label}
        {/* Wyjaśnienie na klik (też na dotyku) — sam title nie działał, a kafelki zbierały martwe kliknięcia. */}
        {hint ? <HelpHintBubble message={hint} ariaLabel={`Co znaczy „${label}”`} className="-my-1" /> : null}
      </dt>
      <dd
        className={cn(
          "order-1 text-[0.8125rem] font-semibold leading-none tabular-nums sm:text-sm",
          quiet
            ? "text-slate-400"
            : emphasis
              ? "text-indigo-900"
              : "text-slate-900"
        )}
      >
        {value}
      </dd>
      {note ? (
        <p className="order-3 mt-0.5 text-[0.625rem] leading-none text-slate-500">{note}</p>
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
  onReportStockOut,
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
  /** Prośba handlowca: przy pustej półce osobny sygnał „brak na stanie” dla zakupów. */
  onReportStockOut?: () => Promise<ProsbaStockOutReportResult>;
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

  const stockOutStrip =
    onReportStockOut && prosbaLineOffersStockOutReport(line) ? (
      <ProsbaStockOutReportStrip key={line.subiektTwId ?? "none"} onReport={onReportStockOut} />
    ) : null;

  if (!showAvailability && !timing && !stockOutStrip) return null;

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
  // Przy wystarczającym stanie liczby są w panelach — tu tylko wyjątki (np. cover pary).
  const advice = useInc
    ? incView!.advice
    : stockView?.assessment === "sufficient"
      ? line.pairStockCover
        ? stockView.detail.trim() || null
        : null
      : stockView?.detail?.trim() || null;
  const notifyNeedsSplit = Boolean(useInc && incView?.suggestNotify && !onSwitchToNotify);
  const showRemove = Boolean(
    onRemoveLine && useInc && (incView!.tone === "mine" || notifyNeedsSplit)
  );
  const available = stock?.available ?? inc?.available ?? null;
  const reserved = stock?.reserved ?? 0;
  const sufficient = showAvailability && !useInc && stockView?.assessment === "sufficient";
  const shelfFree = inc
    ? Math.max(0, inc.available - inc.zkWaiting)
    : 0;
  const freeCoversRequest = Boolean(
    useInc &&
      inc &&
      requested != null &&
      inc.freeIncoming + shelfFree >= requested
  );
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
          className="min-w-0 shrink text-[0.8125rem] font-semibold leading-snug tracking-tight tabular-nums text-slate-900"
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
        {timing ? header : null}
        {stockOutStrip ? (
          <div className={cn("overflow-hidden rounded-md border border-slate-200/90", timing && "mt-2")}>
            {stockOutStrip}
          </div>
        ) : null}
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
            value={
              checking && !inc
                ? "…"
                : inc && inc.incoming > 0
                  ? formatPieces(inc.incoming)
                  : "—"
            }
            quiet={!inc || inc.incoming <= 0}
            note={
              inc && inc.incoming > 0 && inc.zkWaiting > 0
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
              <ul className="space-y-0.5 text-[0.75rem] leading-snug text-slate-600 tabular-nums">
                {details.map((d, i) => (
                  <li key={`${i}-${d}`} className="break-words">
                    {d}
                  </li>
                ))}
              </ul>
            ) : null}

            {advice ? (
              <p className="text-[0.75rem] leading-snug text-slate-500">{advice}</p>
            ) : null}
            {notifyNeedsSplit ? (
              <p className="text-[0.75rem] leading-snug text-slate-500">
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
        {stockOutStrip}
      </div>
    </section>
  );
}

type StockOutReportState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done" }
  | { kind: "already" }
  | { kind: "error"; message: string };

/**
 * Pasek w karcie „Dostępność”: jedno kliknięcie zgłasza zakupom pustą półkę.
 * Zgłoszenie idzie osobno — prośba, którą handlowiec składa, zostaje bez zmian.
 */
export function ProsbaStockOutReportStrip({
  onReport,
}: {
  onReport: () => Promise<ProsbaStockOutReportResult>;
}) {
  const [state, setState] = useState<StockOutReportState>({ kind: "idle" });
  // Stan z useState zmienia się dopiero po renderze — dwa kliknięcia w jednym takcie wysłałyby dwa zgłoszenia.
  const sendingRef = useRef(false);

  async function report() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setState({ kind: "sending" });
    try {
      const result = await onReport();
      if (result.ok) setState({ kind: "done" });
      else if (result.alreadyReported) setState({ kind: "already" });
      else setState({ kind: "error", message: result.message });
    } finally {
      sendingRef.current = false;
    }
  }

  if (state.kind === "done" || state.kind === "already") {
    return (
      <p
        role="status"
        className="flex items-center gap-2.5 border-t border-emerald-200/70 bg-emerald-50/60 px-2.5 py-2.5 text-xs leading-snug text-emerald-900 sm:px-3"
      >
        {/* Ten sam układ co pasek przed zgłoszeniem: ikona w kółku i zdanie. */}
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden>
          <IconCircleCheck size={15} />
        </span>
        <span>
          {state.kind === "done"
            ? "Brak zgłoszony - zakupy zamówią przy najbliższym zamówieniu. Prośbę możesz wysłać dalej."
            : "Ten brak jest już zgłoszony - zakupy go widzą."}
        </span>
      </p>
    );
  }

  // Trzy warstwy: pytanie (z „Nowość”) mówi, kiedy klikać, zdanie pod nim — co się stanie, przycisk — akcja.
  // Wcześniej plakietka siedziała w środku zdania, a całość czytała się jak jeden długi przypis.
  return (
    <div className="flex flex-col gap-2.5 border-t border-amber-200/70 bg-amber-50/60 px-2.5 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className="mt-px inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800"
          aria-hidden
        >
          <IconWarehouse size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] font-semibold leading-snug text-slate-900">
            Brakuje też dla innych klientów?
            {!isPastUntil(STOCK_OUT_NEW_UNTIL) ? (
              <Badge variant="info" className="bg-card ring-1 ring-indigo-200">
                Nowość
              </Badge>
            ) : null}
          </p>
          <p className="mt-0.5 text-pretty text-xs leading-snug text-slate-600">
            Zakupy uzupełnią stan magazynu przy najbliższym zamówieniu. Ta prośba zostaje bez zmian.
          </p>
          {state.kind === "error" ? <p className="mt-1 text-xs text-red-700">{state.message}</p> : null}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="min-h-9 shrink-0 max-sm:w-full"
        disabled={state.kind === "sending"}
        onClick={() => void report()}
      >
        {state.kind === "sending" ? "Zgłaszam…" : state.kind === "error" ? "Spróbuj ponownie" : "Zgłoś brak na stanie"}
      </Button>
    </div>
  );
}
