"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { actionFetchZdEstimateProductHistory, actionFetchZdProductOlderPurchases } from "@/app/actions/zd-estimate";
import { ZdProductNote } from "@/components/zakupy/ZdProductNote";
import {
  detectOnRequestPattern,
  isOnRequestDeliveryArrived,
  onRequestCustomerKey,
  onRequestDeliveryDate,
  onRequestPatternSummary,
} from "@/lib/orders/zd-on-request-detect";
import { warsawDateKeyDaysAgo } from "@/lib/time/warsaw";
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconLayoutPanel, IconX } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ZdSalesProfileCardContent, type ZdSalesChartOrderMark } from "@/components/zakupy/ZdSalesSparkline";
import {
  ZdHistoryRangeBar,
  ZdProductMovementSection,
  ZdProductPurchasesSection,
  ZdProductSalesSections,
  type ZdProductHistoryState,
  type ZdProductOlderPurchases,
} from "@/components/zakupy/ZdProductHistorySections";
import { formatDatePlKey, type ZdProductPurchaseRow } from "@/lib/orders/zd-product-history";
import { cn } from "@/lib/cn";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import { explainZdOrderQty } from "@/lib/orders/zd-estimate-explain";
import { formatQty, type ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  formatZdPackDialogPreview,
  isPackagingPackagesMode,
  piecesArrivingForZdUnitsFromQty,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";
import { zdEstimateDaysOfCover } from "@/lib/orders/zd-estimate-sort";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { sidePanelBackdropClass, sidePanelCloseButtonClass, sidePanelHeaderClass } from "@/lib/ui/surfaces";
import { useAnimatedClose } from "@/lib/ui/use-animated-close";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { resolveZdHistoryRange, type ZdHistoryRangeState } from "@/lib/orders/zd-product-range";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sprzedaż (Subiekt) i nasze zakupy towaru — dociągane przy otwarciu karty i przy ←/→. */
export function useProductHistory(
  twId: number,
  pair: { twinTwId: number; unitsPerPack: number } | null
): ZdProductHistoryState & { nowMs?: number } {
  const twinTwId = pair?.twinTwId ?? 0;
  const unitsPerPack = pair?.unitsPerPack ?? 0;
  const key = `${twId}:${twinTwId}:${unitsPerPack}`;
  const [state, setState] = useState<ZdProductHistoryState & { key: string; nowMs?: number }>({ status: "loading", key });
  useEffect(() => {
    let cancelled = false;
    // Szybkie ←/→ przez kilka towarów: pytamy Subiekta dopiero o ten, na którym się zatrzymano.
    const timer = window.setTimeout(() => {
      actionFetchZdEstimateProductHistory({ twId, pair: twinTwId > 0 ? { twinTwId, unitsPerPack } : null })
        .then((r) => {
          if (!cancelled) setState({ status: "ok", ...r, key, nowMs: Date.now() });
        })
        .catch(() => {
          if (!cancelled) setState({ status: "error", message: "Nie udało się wczytać historii.", key });
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [twId, twinTwId, unitsPerPack, key]);
  // Po ←/→ do czasu odpowiedzi pokazujemy „wczytuję”, nie dane poprzedniego towaru.
  return state.key === key ? state : { status: "loading" };
}

/** „Starsze zakupy”: cała historia ZD z kopii, dociągana na żądanie i wstawiana w miejsce 12 miesięcy. */
export function useOlderPurchases(
  twId: number,
  pair: { twinTwId: number; unitsPerPack: number } | null,
  base: ZdProductHistoryState & { nowMs?: number }
): { history: ZdProductHistoryState & { nowMs?: number }; older: ZdProductOlderPurchases; loadOlder: () => void } {
  const key = `${twId}:${pair?.twinTwId ?? 0}`;
  const [older, setOlder] = useState<{ key: string; state: ZdProductOlderPurchases; rows: ZdProductPurchaseRow[] }>({
    key,
    state: { status: "idle" },
    rows: [],
  });
  const current = older.key === key ? older : { key, state: { status: "idle" as const }, rows: [] };
  const loadOlder = () => {
    if (current.state.status === "loading" || current.state.status === "ok") return;
    setOlder({ key, state: { status: "loading" }, rows: [] });
    actionFetchZdProductOlderPurchases({ twId, pair })
      .then((r) =>
        setOlder((prev) =>
          prev.key !== key
            ? prev
            : r.ok
              ? { key, state: { status: "ok", since: r.since, truncated: r.truncated }, rows: r.rows }
              : { key, state: { status: "error", message: r.message }, rows: [] }
        )
      )
      .catch(() => setOlder((prev) => (prev.key !== key ? prev : { key, state: { status: "error", message: "Nie udało się wczytać starszych zakupów." }, rows: [] })));
  };
  const history: ZdProductHistoryState & { nowMs?: number } =
    current.state.status === "ok" && base.status === "ok" ? { ...base, purchases: { ok: true, rows: current.rows } } : base;
  return { history, older: current.state, loadOlder };
}

function isTypingTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

type CardSectionId = "why" | "note" | "movement" | "sales" | "buy" | "profile" | "pair";
const HISTORY_SECTIONS: Partial<Record<CardSectionId, string>> = { movement: "Ruch towaru", sales: "Sprzedaż", buy: "Nasze zakupy" };
const PREF_WIDE = "ontime.zdProductCard.wide";
const PREF_COLLAPSED = "ontime.zdProductCard.collapsed";

/** Wygoda jednego użytkownika (szerokość, zwinięte sekcje): brak dostępu do pamięci przeglądarki niczego nie psuje. */
function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* tryb prywatny / zablokowane dane strony */
  }
}

/** Sekcja karty: nagłówek zwija i rozwija, „Pełny widok” otwiera ją na całą szerokość panelu. */
function CardSection({
  id,
  titleId,
  title,
  summary,
  collapsed,
  onToggle,
  onFocus,
  children,
}: {
  id: CardSectionId;
  titleId: string;
  title: string;
  summary?: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onFocus?: () => void;
  children: React.ReactNode;
}) {
  const bodyId = `${titleId}-body-${id}`;
  return (
    <section aria-labelledby={`${titleId}-h-${id}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
          className="-mx-1.5 flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <IconChevronDown size={15} open={!collapsed} className="shrink-0 text-slate-500" aria-hidden />
          <h3 id={`${titleId}-h-${id}`} className={cn(panelTypography.sectionTitle, "shrink-0")}>
            {title}
          </h3>
          {summary ? <span className="min-w-0 truncate text-xs tabular-nums text-slate-500">{summary}</span> : null}
        </button>
        {onFocus ? (
          <button
            type="button"
            id={`${titleId}-full-${id}`}
            onClick={onFocus}
            className="inline-flex min-h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-indigo-700 transition-colors duration-150 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:min-h-10"
          >
            Pełny widok
          </button>
        ) : null}
      </div>
      {!collapsed ? (
        <div id={bodyId} className="mt-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export type ZdEstimateProductCardActions = {
  onEditPackaging?: () => void;
  onEditMinStock?: () => void;
  onMarkOnRequest?: () => void;
  onClearOnRequest?: () => void;
  onExclude?: () => void;
  onRestore?: () => void;
};

/**
 * Karta produktu w Kreatorze ZD: decyzja, historia sprzedaży i „dlaczego tyle” w jednym miejscu.
 * Panel boczny (wzorzec SupplierEditSheet): Esc zamyka, ←/→ następny / poprzedni towar listy.
 */
export function ZdEstimateProductCard({
  line,
  qty,
  openZdPieces,
  extraPieces,
  extraOnly,
  extrasPolicy,
  minStockSzt,
  overrideZdUnits,
  leadDays,
  salesWindow = null,
  comparePieces = null,
  supplierName,
  status,
  position,
  onPrev,
  onNext,
  onClose,
  actions,
  canMutate,
}: {
  line: ManualZdEstimateLine;
  qty: ZdPackOrderQty;
  openZdPieces: number;
  extraPieces: number;
  extraOnly: boolean;
  extrasPolicy: ZdEstimateExtrasPolicy;
  minStockSzt?: number | null;
  overrideZdUnits?: number | null;
  leadDays?: number | null;
  /** Okno sprzedaży tego Policz (domyślny zakres osi „Ruch towaru”). */
  salesWindow?: { dataOd: string; dataDo: string } | null;
  /** Strategia testowa: sztuki wg „jak dotąd” (null = bez porównania). */
  comparePieces?: number | null;
  supplierName?: string | null;
  status: { excluded: boolean; onRequest: boolean };
  /** Pozycja na bieżącej (przefiltrowanej) liście. */
  position: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  actions: ZdEstimateProductCardActions;
  canMutate: boolean;
}) {
  const titleId = useId();
  const activePair = line.pair?.role === "pack" && !line.pair.partnerMissing ? line.pair : null;
  // Para: stan obu stron osobno (w tabeli jest tylko pokrycie pary).
  const pairStockRows: Array<[string, number]> = activePair
    ? [
        ["Dostępne - sztuki", activePair.pieceDostepne],
        [`Dostępne - ${qty.packageLabel.trim() || "op."} (×${activePair.unitsPerPack})`, activePair.packDostepne * activePair.unitsPerPack],
        ["Pokrycie pary (z ZD)", activePair.coverSzt],
      ]
    : [];
  const pairKey = activePair ? { twinTwId: activePair.twinTwId, unitsPerPack: activePair.unitsPerPack } : null;
  const baseHistory = useProductHistory(line.tw_Id, pairKey);
  const { history, older, loadOlder } = useOlderPurchases(line.tw_Id, pairKey, baseHistory);
  // Zakres historii (tylko widok): wspólny dla ruchu, sprzedaży i zakupów, zostaje przy ←/→ między towarami.
  const [rangeState, setRangeState] = useState<ZdHistoryRangeState>({ preset: "12m" });
  const range = useMemo(() => resolveZdHistoryRange(rangeState, salesWindow, warsawDateKeyDaysAgo(0)), [rangeState, salesWindow]);
  const wantsOlder = range.from == null || range.from < warsawDateKeyDaysAgo(365);
  useEffect(() => {
    // Zakres sprzed 12 miesięcy nocnego odczytu ZD: zakupy dociągamy z kopii ZD sami, bez dodatkowego kliknięcia.
    if (wantsOlder && history.status === "ok") loadOlder();
  }, [wantsOlder, history.status, line.tw_Id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [wide, setWide] = useState(() => readPref(PREF_WIDE, false));
  const [collapsed, setCollapsed] = useState<Partial<Record<CardSectionId, boolean>>>(() => readPref(PREF_COLLAPSED, {}));
  const [focus, setFocus] = useState<CardSectionId | null>(null);
  // Klawiatura: wejście w pełny widok stawia fokus na „Cała karta”, wyjście wraca na „Pełny widok” tej sekcji.
  const backRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<CardSectionId | null>(null);
  useEffect(() => {
    if (focus) {
      lastFocusRef.current = focus;
      backRef.current?.focus();
    } else if (lastFocusRef.current) {
      document.getElementById(`${titleId}-full-${lastFocusRef.current}`)?.focus();
      lastFocusRef.current = null;
    }
  }, [focus, titleId]);
  const toggleWide = () =>
    setWide((v) => {
      writePref(PREF_WIDE, !v);
      return !v;
    });
  const toggleSection = (id: CardSectionId) =>
    setCollapsed((cur) => {
      const next = { ...cur, [id]: !cur[id] };
      writePref(PREF_COLLAPSED, next);
      return next;
    });
  const packLabel = qty.packageLabel.trim() || "op.";
  const purchaseUnit = (r: ZdProductPurchaseRow): { label: string; piecesPerUnit: number | null } => {
    if (activePair && r.twId !== line.tw_Id) return { label: "szt", piecesPerUnit: null };
    if (activePair) return { label: packLabel, piecesPerUnit: activePair.unitsPerPack };
    return qty.hasPackaging && isPackagingPackagesMode(qty.documentUnitMode)
      ? { label: packLabel, piecesPerUnit: qty.unitsPerPackage }
      : { label: "szt", piecesPerUnit: null };
  };
  // Wygląda na „na prośbę”: po fakturze jeden klient bierze całą dostawę — z danych, które karta już ma.
  const onRequestPattern =
    history.status === "ok" && history.purchases.ok && history.sales.ok && history.purchases.rows.length > 0
      ? detectOnRequestPattern(
          history.purchases.rows.filter(isOnRequestDeliveryArrived).map((r) => ({
            date: onRequestDeliveryDate({ fzDate: r.fzDate, zdDate: r.date }) ?? "",
            pieces: r.qty * (purchaseUnit(r).piecesPerUnit ?? 1),
          })),
          history.sales.rows.map((s, i) => ({
            date: s.date,
            khKey: onRequestCustomerKey(s, s.dokNr || i),
            khName: s.khName || s.khSymbol || null,
            pieces: s.pieces,
          })),
          warsawDateKeyDaysAgo(0)
        )
      : null;
  const orderMarks: ZdSalesChartOrderMark[] =
    history.status === "ok" && history.purchases.ok && history.nowMs != null
      ? history.purchases.rows
          .filter((r) => r.date)
          .map((r) => ({
            daysAgo: Math.floor((history.nowMs! - Date.parse(`${r.date}T12:00:00Z`)) / DAY_MS),
            qty: r.qty,
            label: `${formatDatePlKey(r.date)} · ${r.dokNr || "ZD"} · ${formatQty(r.qty)} ${purchaseUnit(r).label}`,
          }))
      : [];
  useBodyScrollLock(true);
  const { panelRef, backdropRef, requestClose } = useAnimatedClose(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Fokus: na otwarciu przycisk zamknięcia, po zamknięciu wraca do elementu, z którego otwarto kartę.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Okno otwarte z karty (opakowanie, minimum) obsługuje swoje klawisze — karta nie reaguje.
      const panel = panelRef.current;
      if (panel && e.target instanceof Node && e.target !== document.body && !panel.contains(e.target)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        // Z pełnego widoku sekcji Esc wraca do całej karty, dopiero potem ją zamyka.
        if (focus) setFocus(null);
        else requestClose();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && e.repeat) {
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === "Tab") {
        // Pułapka fokusu — karta jest modalna.
        if (!panel) return;
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext, requestClose, panelRef, focus]);

  const label = qty.packageLabel.trim() || "op.";
  const pallets = isPackagingPackagesMode(qty.documentUnitMode) && qty.orderMultiple >= 2 ? qty.orderMultiple : null;
  const pair = line.pair?.role === "pack" && !line.pair.partnerMissing ? line.pair : null;
  const days = zdEstimateDaysOfCover(line);
  const lead = leadDays != null && leadDays > 0 ? leadDays : null;
  const preview = qty.piecesNeeded > 0 ? formatZdPackDialogPreview(qty) : null;
  const shownUnits = overrideZdUnits != null && Number.isFinite(overrideZdUnits) ? Math.trunc(overrideZdUnits) : qty.zdUnits;
  const steps = explainZdOrderQty({
    line,
    qty,
    openZdPieces,
    extraPieces,
    extraOnly,
    extrasPolicy,
    minStockSzt,
    overrideZdUnits,
  });

  const decision = status.excluded
    ? "Wykluczony z ZD"
    : shownUnits <= 0
      ? (qty.prosbaFromSupplyPieces ?? 0) > 0
        ? "Nic do zamówienia — prośbę wydaj z magazynu"
        : "Nic do zamówienia"
      : shownUnits !== qty.zdUnits
        ? `Na ZD: ${formatQty(shownUnits)} ${qty.hasPackaging && isPackagingPackagesMode(qty.documentUnitMode) ? `× ${label}` : "szt"} (wpisane ręcznie)`
        : (preview?.orderLine ?? `Na ZD: ${formatQty(shownUnits)} szt`);
  const result = [...steps].reverse().find((s) => s.kind === "result" && s.unit);
  const whySummary = result ? `= ${formatQty(result.value)} ${result.unit}` : null;
  const coverLine = [
    days == null ? "nie sprzedaje się w oknie" : days <= 0 ? "brak dostępnego towaru" : `starczy na ${formatQty(Math.round(days * 10) / 10)} d`,
    lead != null ? `dostawa ~${lead} d` : null,
    lead != null && days != null && days < lead ? "zabraknie przed dostawą" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <button
        ref={(el) => {
          backdropRef.current = el;
        }}
        type="button"
        tabIndex={-1}
        // Pod wszystkimi oknami (standard z-50): okna otwierane z karty (opakowanie, minimum) są nad nią.
        className={cn(sidePanelBackdropClass, "z-[48]", "panel-slide-backdrop-enter")}
        aria-label="Zamknij kartę produktu"
        onClick={requestClose}
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        className={cn(
          "panel-slide-enter fixed inset-y-0 right-0 z-[49] flex w-full flex-col transition-[max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          wide || focus ? "max-w-[min(100vw,72rem)]" : "max-w-xl",
          " border-l border-slate-200/80 bg-raised shadow-[var(--shadow-card-elevated)]"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={sidePanelHeaderClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-slate-600">
                {line.tw_Symbol}
                {supplierName ? <span className="font-sans"> · {supplierName}</span> : null}
              </p>
              <h2 id={titleId} className="mt-0.5 text-lg font-semibold leading-snug text-slate-900">
                {line.tw_Nazwa}
              </h2>
              <p className="mt-2 flex flex-wrap gap-1.5">
                {pair ? <Badge variant="info">para: 1 {label} = {pair.unitsPerPack} szt</Badge> : null}
                {!pair && qty.hasPackaging ? (
                  <Badge variant="info">
                    {isPackagingPackagesMode(qty.documentUnitMode)
                      ? `1 ${label} = ${qty.unitsPerPackage} szt`
                      : `po ${qty.unitsPerPackage} szt`}
                  </Badge>
                ) : null}
                {pallets ? <Badge variant="info">paleta {pallets} × {label}</Badge> : null}
                {status.onRequest ? <Badge variant="warning">tylko na prośbę</Badge> : null}
                {status.excluded ? <Badge variant="default">wykluczony</Badge> : null}
                {minStockSzt != null && minStockSzt > 0 ? <Badge variant="default">minimum {formatQty(minStockSzt)} szt</Badge> : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggleWide}
                aria-pressed={wide}
                title={wide ? "Węższy panel: jedna kolumna" : "Szerszy panel: decyzja obok historii"}
                className="mr-1 hidden min-h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-card px-2.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:inline-flex"
              >
                <IconLayoutPanel size={14} aria-hidden />
                {wide ? "Zwęź" : "Poszerz"}
              </button>
              <span className="mr-1 text-xs tabular-nums text-slate-500" aria-live="polite">
                {position.index + 1} / {position.total}
              </span>
              <button
                type="button"
                className={sidePanelCloseButtonClass}
                onClick={onPrev}
                disabled={!onPrev}
                aria-label="Poprzedni towar (←)"
              >
                <IconChevronLeft size={18} />
              </button>
              <button
                type="button"
                className={sidePanelCloseButtonClass}
                onClick={onNext}
                disabled={!onNext}
                aria-label="Następny towar (→)"
              >
                <IconChevronRight size={18} />
              </button>
              <button
                ref={closeRef}
                type="button"
                className={sidePanelCloseButtonClass}
                onClick={requestClose}
                aria-label="Zamknij (Esc)"
              >
                <IconX size={18} />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5" {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}>
          {/* key={line.tw_Id} w sekcjach historii: filtry (klient, tydzień, rozwinięte listy) nie przechodzą na kolejny towar po ←/→. */}
          {focus ? (
            <div className="space-y-4">
              <button
                ref={backRef}
                type="button"
                onClick={() => setFocus(null)}
                className="-ml-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-indigo-700 transition-colors duration-150 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <IconChevronLeft size={15} aria-hidden /> Cała karta (Esc)
              </button>
              <h3 className={panelTypography.sectionTitle}>{HISTORY_SECTIONS[focus]}</h3>
              <ZdHistoryRangeBar value={rangeState} onChange={setRangeState} range={range} salesWindow={salesWindow} />
              {focus === "movement" ? (
                <ZdProductMovementSection key={line.tw_Id} state={history} titleId={titleId} unitFor={purchaseUnit} range={range} expanded />
              ) : focus === "sales" ? (
                <ZdProductSalesSections key={line.tw_Id} state={history} titleId={titleId} range={range} expanded />
              ) : (
                <ZdProductPurchasesSection key={line.tw_Id} state={history} titleId={titleId} unitFor={purchaseUnit} range={range} older={older} onLoadOlder={loadOlder} expanded />
              )}
            </div>
          ) : (
            <div className={cn("space-y-6", wide && "lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0")}>
              <div className="min-w-0 space-y-5">
                <section className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-3" aria-label="Decyzja">
                  <p className="text-sm font-semibold tabular-nums text-slate-900">{decision}</p>
                  <p className={cn("mt-0.5 text-xs", lead != null && days != null && days < lead ? "text-red-700" : "text-slate-600")}>
                    {coverLine}
                  </p>
                  {comparePieces != null && Math.round(comparePieces) !== piecesArrivingForZdUnitsFromQty(shownUnits, qty) ? (
                    <p className="mt-1 text-xs tabular-nums text-slate-600">Strategia „jak dotąd”: {formatQty(comparePieces)} szt</p>
                  ) : null}
                </section>

                {onRequestPattern?.likely && !status.onRequest && !status.excluded ? (
                  <section className="rounded-md border border-slate-200 bg-card px-3.5 py-3" aria-label="Podpowiedź: towar na prośbę">
                    <p className="text-sm font-medium text-slate-900">Wygląda na towar na prośbę</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{onRequestPatternSummary(onRequestPattern)}</p>
                    {actions.onMarkOnRequest ? (
                      <Button type="button" size="sm" variant="outline" className="mt-2 max-sm:min-h-10" disabled={!canMutate} onClick={actions.onMarkOnRequest}>
                        Oznacz „tylko na prośbę”
                      </Button>
                    ) : null}
                  </section>
                ) : onRequestPattern?.stockLike && !onRequestPattern.likely && status.onRequest ? (
                  <section className="rounded-md border border-slate-200 bg-card px-3.5 py-3" aria-label="Podpowiedź: sprzedaje się jak magazynowy">
                    <p className="text-sm font-medium text-slate-900">Oznaczony „na prośbę”, a sprzedaje się jak magazynowy</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                      Kupuje go {onRequestPattern.customers} klientów w roku, dostaw nie bierze w całości jeden klient.
                    </p>
                    {actions.onClearOnRequest ? (
                      <Button type="button" size="sm" variant="ghost" className="mt-2 max-sm:min-h-10" disabled={!canMutate} onClick={actions.onClearOnRequest}>
                        Zdejmij „na prośbę”
                      </Button>
                    ) : null}
                  </section>
                ) : null}

                <CardSection
                  id="why"
                  titleId={titleId}
                  title="Dlaczego tyle"
                  summary={whySummary}
                  collapsed={!!collapsed.why}
                  onToggle={() => toggleSection("why")}
                >
                  <ol className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {steps.map((s) => (
                      <li key={s.key} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
                        <span className={cn(s.kind === "result" ? "font-medium text-slate-900" : "text-slate-700", s.kind === "note" && "italic")}>
                          {s.kind === "minus" ? "− " : s.kind === "plus" ? "+ " : s.kind === "result" ? "= " : ""}
                          {s.label}
                        </span>
                        {s.unit ? (
                          <span className={cn("shrink-0 tabular-nums", s.kind === "result" ? "font-semibold text-slate-900" : "text-slate-700")}>
                            {formatQty(s.value)} {s.unit}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </CardSection>

                {pairStockRows.length > 0 ? (
                  <CardSection id="pair" titleId={titleId} title="Stan pary" collapsed={!!collapsed.pair} onToggle={() => toggleSection("pair")}>
                    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 text-sm">
                      {pairStockRows.map(([label, value]) => (
                        <div key={label} className="bg-card px-2.5 py-1.5">
                          <dt className="text-xs text-slate-600">{label}</dt>
                          <dd className="tabular-nums font-medium text-slate-900">{formatQty(Number(value) || 0)} szt</dd>
                        </div>
                      ))}
                    </dl>
                  </CardSection>
                ) : null}

                {line.salesProfile && line.salesProfile.windows.length > 0 ? (
                  <CardSection
                    id="profile"
                    titleId={titleId}
                    title="Sprzedaż i nasze ZD"
                    summary="12 okien po 30 dni"
                    collapsed={!!collapsed.profile}
                    onToggle={() => toggleSection("profile")}
                  >
                    <div className="text-xs leading-relaxed text-slate-800">
                      <ZdSalesProfileCardContent profile={line.salesProfile} orders={orderMarks} />
                    </div>
                  </CardSection>
                ) : null}

                <ZdProductNote
                  twId={line.tw_Id}
                  symbol={line.tw_Symbol ?? null}
                  name={line.tw_Nazwa ?? null}
                  canEdit={canMutate}
                  titleId={titleId}
                />
              </div>

              <div className="min-w-0 space-y-5">
                <div className={cn("sticky -top-5 z-[2] -mx-5 border-b border-slate-100 bg-raised/95 px-5 py-2.5 backdrop-blur-sm", wide && "lg:mx-0 lg:px-0")}>
                  <p className="mb-1.5 text-xs font-semibold text-slate-600">Historia towaru</p>
                  <ZdHistoryRangeBar value={rangeState} onChange={setRangeState} range={range} salesWindow={salesWindow} />
                </div>
                <CardSection
                  id="movement"
                  titleId={titleId}
                  title="Ruch towaru"
                  summary="dostawy i rozchód"
                  collapsed={!!collapsed.movement}
                  onToggle={() => toggleSection("movement")}
                  onFocus={() => setFocus("movement")}
                >
                  <ZdProductMovementSection key={line.tw_Id} state={history} titleId={titleId} unitFor={purchaseUnit} range={range} />
                </CardSection>
                <CardSection
                  id="sales"
                  titleId={titleId}
                  title="Sprzedaż"
                  summary="kto kupuje i dokumenty"
                  collapsed={!!collapsed.sales}
                  onToggle={() => toggleSection("sales")}
                  onFocus={() => setFocus("sales")}
                >
                  <ZdProductSalesSections key={line.tw_Id} state={history} titleId={titleId} range={range} />
                </CardSection>
                <CardSection
                  id="buy"
                  titleId={titleId}
                  title="Nasze zakupy"
                  summary="ZD, faktury i ceny"
                  collapsed={!!collapsed.buy}
                  onToggle={() => toggleSection("buy")}
                  onFocus={() => setFocus("buy")}
                >
                  <ZdProductPurchasesSection key={line.tw_Id} state={history} titleId={titleId} unitFor={purchaseUnit} range={range} older={older} onLoadOlder={loadOlder} />
                </CardSection>
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-card px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {actions.onEditPackaging ? (
              <Button type="button" size="sm" variant="secondary" disabled={!canMutate} onClick={actions.onEditPackaging}>
                Opakowanie i palety
              </Button>
            ) : null}
            {actions.onEditMinStock ? (
              <Button type="button" size="sm" variant="secondary" disabled={!canMutate} onClick={actions.onEditMinStock}>
                Minimum stanów
              </Button>
            ) : null}
            {status.onRequest && actions.onClearOnRequest ? (
              <Button type="button" size="sm" variant="secondary" disabled={!canMutate} onClick={actions.onClearOnRequest}>
                Zdejmij „na prośbę”
              </Button>
            ) : !status.onRequest && actions.onMarkOnRequest ? (
              <Button type="button" size="sm" variant="secondary" disabled={!canMutate} onClick={actions.onMarkOnRequest}>
                Tylko na prośbę
              </Button>
            ) : null}
            {status.excluded && actions.onRestore ? (
              <Button type="button" size="sm" variant="secondary" disabled={!canMutate} onClick={actions.onRestore}>
                Przywróć do ZD
              </Button>
            ) : !status.excluded && actions.onExclude ? (
              <Button type="button" size="sm" variant="ghost" disabled={!canMutate} onClick={actions.onExclude}>
                Wyklucz
              </Button>
            ) : null}
          </div>
        </footer>
      </aside>
    </>
  );
}
