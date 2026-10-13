"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { IconAlertCircle, IconPackage, IconTruck, IconWarehouse } from "@/components/icons/StrokeIcons";
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
  type ProsbaAlreadyOrderedTone,
} from "@/lib/orders/prosba-already-ordered";

type Tone = ReturnType<typeof prosbaAlreadyOrderedStockTone>;

/** Ta sama rodzina co status stanu magazynu przy pozycji + zielony „w drodze i wolne”. */
const SHELL: Record<Tone, string> = {
  amber: "border-amber-200/90 bg-amber-50/70",
  sky: "border-sky-200/90 bg-sky-50/65",
  slate: "border-slate-200/90 bg-slate-50/80",
  emerald: "border-emerald-200/90 bg-emerald-50/70",
};
const TITLE: Record<Tone, string> = {
  amber: "text-amber-950",
  sky: "text-sky-950",
  slate: "text-slate-800",
  emerald: "text-emerald-950",
};
const DETAIL: Record<Tone, string> = {
  amber: "text-amber-900/90",
  sky: "text-sky-900/90",
  slate: "text-slate-600",
  emerald: "text-emerald-900/90",
};
const ICON_TILE: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-100 text-emerald-700",
};

/** Odznaka w zwiniętym wierszu pozycji. */
export const PROSBA_ALREADY_ORDERED_BADGE: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80",
  sky: "bg-sky-100 text-sky-900 ring-1 ring-sky-200/70",
  slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
  emerald: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80",
};

function ToneIcon({ tone }: { tone: ProsbaAlreadyOrderedTone }) {
  const cls = "size-[18px]";
  if (tone === "mine") return <IconAlertCircle className={cls} strokeWidth={2.25} aria-hidden />;
  if (tone === "claimed") return <IconPackage className={cls} strokeWidth={2.25} aria-hidden />;
  return <IconTruck className={cls} strokeWidth={2.25} aria-hidden />;
}

/**
 * Pasek „w drodze”: ile czeka na zamówienia klientów, ile jest wolne. Wolna część rośnie
 * od prawej — oko ląduje na niej, a ona jest odpowiedzią na pytanie „czy zamawiać”.
 */
function IncomingBar({ incoming, free }: { incoming: number; free: number }) {
  if (!(incoming > 0)) return null;
  const freePct = Math.max(0, Math.min(100, (free / incoming) * 100));
  return (
    <div
      className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-300/70"
      role="img"
      aria-label={`W drodze: ${Math.round(freePct)}% wolne`}
    >
      <span className="ml-auto h-full rounded-full bg-emerald-500" style={{ width: `${freePct}%` }} />
    </div>
  );
}

/**
 * Podpowiedź pod pozycją prośby — czy towar już jedzie i czy jest wolny, albo czy ta sama
 * osoba już o niego prosi. Dane przychodzą w tle; blok wchodzi bez skoku (200 ms ease-out).
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
  /** Ilość z pozycji — porównanie z wolną częścią dostawy. */
  requestedQty?: number | null;
  /** Tylko gdy prośba ma jedną pozycję — rodzaj prośby jest wspólny dla wszystkich. */
  onSwitchToNotify?: () => void;
  /** Dubel własnej prośby w wielopozycyjnym formularzu. */
  onRemoveLine?: () => void;
  /** Formularz wypełniany w imieniu innego handlowca. */
  forOther?: boolean;
  /** Po „Cofnij” — fokus wraca na przycisk, z którego przełączono. */
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
  const tone = prosbaAlreadyOrderedStockTone(view.tone);
  const showRemove = view.tone === "mine" && onRemoveLine;
  const inc = view.tone !== "mine" ? info?.incoming : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-3",
        // Wejście: dane przychodzą chwilę po wyborze towaru — bez skoku, 200 ms ease-out.
        "transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0",
        SHELL[tone],
        className
      )}
    >
      <span
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", ICON_TILE[tone])}
      >
        <ToneIcon tone={view.tone} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold leading-snug tabular-nums", TITLE[tone])}>
          {view.title}
        </p>
        {inc ? <IncomingBar incoming={inc.incoming} free={inc.freeIncoming} /> : null}
        <ul className={cn("mt-1.5 space-y-0.5 text-xs leading-relaxed tabular-nums", DETAIL[tone])}>
          {view.details.map((line, i) => (
            <li key={`${i}-${line}`} className="break-words">
              {line}
            </li>
          ))}
        </ul>
        <p className={cn("mt-1.5 text-xs font-medium leading-relaxed", TITLE[tone])}>{view.advice}</p>
        {hasNotify || showRemove ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {hasNotify ? (
              <Button
                ref={notifyRef}
                type="button"
                size="sm"
                variant="outline"
                className="min-h-9 w-full bg-white sm:w-auto"
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
                className="min-h-9 w-full bg-white sm:w-auto"
                onClick={onRemoveLine}
              >
                Usuń tę pozycję
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Po „Tylko powiadom, gdy dotrze”: potwierdzenie w miejscu podpowiedzi — przełącznik rodzaju
 * jest wysoko w formularzu, a bez tego jedynym śladem zmiany byłaby etykieta przycisku.
 */
export function ProsbaNotifySwitchedNote({
  onUndo,
  className,
}: {
  onUndo: () => void;
  className?: string;
}) {
  // Kliknięty przycisk zniknął razem z podpowiedzią — fokus na „Cofnij”, nie na <body>.
  const undoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    undoRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-3",
        "transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0",
        SHELL.emerald,
        className
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", ICON_TILE.emerald)}>
        <IconTruck className="size-[18px]" strokeWidth={2.25} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold leading-snug", TITLE.emerald)}>
          Zamiast zamówienia - powiadomienie, gdy towar dotrze
        </p>
        <p className={cn("mt-0.5 text-xs leading-relaxed", DETAIL.emerald)}>
          Prośba nie trafi do zakupów jako nowe zamówienie. Magazyn da znać, gdy towar będzie na stanie.
        </p>
      </div>
      <Button
        ref={undoRef}
        type="button"
        size="sm"
        variant="outline"
        className="min-h-9 shrink-0 bg-white"
        onClick={onUndo}
      >
        Cofnij
      </Button>
    </div>
  );
}

/** Komórka paska liczb: etykieta, wartość, dopisek. */
function AvailabilityStat({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note?: string | null;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0 px-2 py-1.5 first:pl-0 sm:px-2.5">
      <dt className="truncate text-[11px] font-medium leading-tight text-slate-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 whitespace-nowrap text-sm font-semibold leading-tight tabular-nums",
          emphasis ? "text-emerald-800" : "text-slate-900"
        )}
      >
        {value}
      </dd>
      {/* Dopisek pod liczbą — obok niej łamał wartość na telefonie. */}
      {note ? <dd className="mt-0.5 text-[11px] font-medium leading-tight text-slate-500">{note}</dd> : null}
    </div>
  );
}

/**
 * Karta „Dostępność” pod pozycją prośby — jedna odpowiedź zamiast dwóch bloków:
 * werdykt (dubel → wystarczy z półki → wolne w drodze → częściowo → zajęte → brak),
 * pasek liczb (na stanie · w drodze · wolne z dostawy), ZD z terminem i jedna akcja.
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
  className,
}: {
  line: ProductLineDraft;
  requestKind: IndividualRequestKind;
  info: ProsbaAlreadyOrderedInfo | null | undefined;
  /** Zapytanie o dostawę w toku (pierwsze dla tego towaru). */
  checking?: boolean;
  forOther?: boolean;
  onSwitchToNotify?: () => void;
  onRemoveLine?: () => void;
  focusNotifyOnMount?: boolean;
  onNotifyFocused?: () => void;
  className?: string;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const requested = prosbaLineRequestedQty(line);
  const stockView = buildProsbaLineStockStatusView(line, requestKind, teethExemptTwIds);
  const stock = stockSnapshotFromLineDraft(line);
  // Pozycja z ZK: ZK tego klienta nie „zabiera” dostawy samemu sobie.
  const ownZkQty = line.zkQuantity ?? null;
  const incView = buildProsbaAlreadyOrderedView(info, { forOther, requestedQty: requested, ownZkQty });
  const inc = info?.incoming ? incomingForOwnZk(info.incoming, ownZkQty) : null;

  const notifyRef = useRef<HTMLButtonElement>(null);
  // Werdykt: własny dubel > wystarczy z półki > dostawa > sam stan.
  const useInc =
    incView != null && (incView.tone === "mine" || stockView?.assessment !== "sufficient");
  const canNotify = Boolean(useInc && incView?.suggestNotify && onSwitchToNotify);
  useEffect(() => {
    if (!focusNotifyOnMount || !canNotify) return;
    notifyRef.current?.focus({ preventScroll: true });
    onNotifyFocused?.();
  }, [focusNotifyOnMount, canNotify, onNotifyFocused]);

  if (requestKind !== "zamowienie" || line.subiektTwId == null) return null;
  if (!stockView && !incView && !inc && !checking) return null;

  const tone: Tone = useInc
    ? prosbaAlreadyOrderedStockTone(incView!.tone)
    : stockView
      ? stockView.tone
      : "slate";
  const title = useInc
    ? incView!.title
    : stockView
      ? stockView.title
      : checking
        ? "Sprawdzam dostępność…"
        : inc && inc.incoming <= 0
          ? "Nic nie jest w drodze"
          : "Brak danych o stanie";
  const details = useInc ? incView!.details.slice(1) : [];
  const advice = useInc ? incView!.advice : stockView?.detail ?? null;
  // Kilka pozycji: rodzaj prośby jest wspólny, więc „Tylko powiadom” zmieniłby wszystkie.
  const notifyNeedsSplit = Boolean(useInc && incView?.suggestNotify && !onSwitchToNotify);
  const showRemove = Boolean(
    onRemoveLine && useInc && (incView!.tone === "mine" || notifyNeedsSplit)
  );
  const available = stock?.available ?? inc?.available ?? null;
  const reserved = stock?.reserved ?? 0;

  return (
    <section
      aria-label="Dostępność towaru"
      aria-live="polite"
      className={cn(
        "rounded-md border px-3 py-3",
        "transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0",
        SHELL[tone],
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Telefon: bez kafelka ikony — pasek liczb potrzebuje pełnej szerokości. */}
        <span className={cn("hidden size-8 shrink-0 items-center justify-center rounded-md sm:flex", ICON_TILE[tone])}>
          {useInc ? (
            <ToneIcon tone={incView!.tone} />
          ) : (
            <IconWarehouse className="size-[18px]" strokeWidth={2.25} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p role="status" className={cn("text-sm font-semibold leading-snug tabular-nums", TITLE[tone])}>
            {title}
          </p>

          <dl className="mt-2 grid grid-cols-3 divide-x divide-slate-900/10 rounded-md">
            <AvailabilityStat
              label="Na stanie"
              value={available != null ? formatPieces(Math.max(0, available)) : "-"}
              note={reserved > 0 ? `rez. ${reserved}` : available != null && available < 0 ? `brak ${-available}` : null}
            />
            <AvailabilityStat
              label="W drodze"
              value={inc ? formatPieces(inc.incoming) : checking ? "…" : "-"}
              note={
                inc && inc.zkWaiting > 0
                  ? ownZkQty
                    ? `inne ZK ${inc.zkWaiting}`
                    : `ZK ${inc.zkWaiting}`
                  : null
              }
            />
            <AvailabilityStat
              label="Wolne"
              value={inc ? formatPieces(inc.freeIncoming) : checking ? "…" : "-"}
              emphasis={Boolean(inc && inc.freeIncoming > 0)}
            />
          </dl>
          {useInc && inc && incView!.tone !== "mine" ? (
            <IncomingBar incoming={inc.incoming} free={inc.freeIncoming} />
          ) : null}

          {useInc && incView!.tone === "mine" ? (
            <ul className={cn("mt-2 space-y-0.5 text-xs leading-relaxed tabular-nums", DETAIL[tone])}>
              {incView!.details.map((d, i) => (
                <li key={`${i}-${d}`}>{d}</li>
              ))}
            </ul>
          ) : details.length > 0 ? (
            <ul className={cn("mt-2 space-y-0.5 text-xs leading-relaxed tabular-nums", DETAIL[tone])}>
              {details.map((d, i) => (
                <li key={`${i}-${d}`} className="break-words">
                  {d}
                </li>
              ))}
            </ul>
          ) : null}

          {advice ? (
            <p className={cn("mt-2 text-xs font-medium leading-relaxed", TITLE[tone])}>{advice}</p>
          ) : null}
          {notifyNeedsSplit ? (
            <p className={cn("mt-1 text-xs leading-relaxed", DETAIL[tone])}>
              W prośbie jest kilka pozycji - usuń tę i dodaj ją osobno jako „Informacja o towarze”.
            </p>
          ) : null}

          {canNotify || showRemove ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {canNotify ? (
                <Button
                  ref={notifyRef}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-9 w-full bg-white sm:w-auto"
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
                  className="min-h-9 w-full bg-white sm:w-auto"
                  onClick={onRemoveLine}
                >
                  Usuń tę pozycję
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
