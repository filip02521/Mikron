"use client";

import { useEffect, useId, useRef, useState } from "react";
import { actionFetchZdEstimateProductHistory } from "@/app/actions/zd-estimate";
import { IconChevronLeft, IconChevronRight, IconX } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ZdSalesProfileCardContent, type ZdSalesChartOrderMark } from "@/components/zakupy/ZdSalesSparkline";
import {
  ZdProductPurchasesSection,
  ZdProductSalesSections,
  type ZdProductHistoryState,
} from "@/components/zakupy/ZdProductHistorySections";
import { formatDatePlKey, type ZdProductPurchaseRow } from "@/lib/orders/zd-product-history";
import { cn } from "@/lib/cn";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import { explainZdOrderQty } from "@/lib/orders/zd-estimate-explain";
import { formatQty, type ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  formatZdPackDialogPreview,
  isPackagingPackagesMode,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";
import { zdEstimateDaysOfCover } from "@/lib/orders/zd-estimate-sort";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { sidePanelBackdropClass, sidePanelCloseButtonClass, sidePanelHeaderClass } from "@/lib/ui/surfaces";
import { useAnimatedClose } from "@/lib/ui/use-animated-close";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sprzedaż (Subiekt) i nasze zakupy towaru — dociągane przy otwarciu karty i przy ←/→. */
function useProductHistory(
  twId: number,
  pair: { twinTwId: number; unitsPerPack: number } | null
): ZdProductHistoryState & { nowMs?: number } {
  const twinTwId = pair?.twinTwId ?? 0;
  const unitsPerPack = pair?.unitsPerPack ?? 0;
  const key = `${twId}:${twinTwId}:${unitsPerPack}`;
  const [state, setState] = useState<ZdProductHistoryState & { key: string; nowMs?: number }>({ status: "loading", key });
  useEffect(() => {
    let cancelled = false;
    actionFetchZdEstimateProductHistory({ twId, pair: twinTwId > 0 ? { twinTwId, unitsPerPack } : null })
      .then((r) => {
        if (!cancelled) setState({ status: "ok", ...r, key, nowMs: Date.now() });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Nie udało się wczytać historii.", key });
      });
    return () => {
      cancelled = true;
    };
  }, [twId, twinTwId, unitsPerPack, key]);
  // Po ←/→ do czasu odpowiedzi pokazujemy „wczytuję”, nie dane poprzedniego towaru.
  return state.key === key ? state : { status: "loading" };
}

function isTypingTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
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
  compareZdUnits = null,
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
  /** Strategia testowa: jednostki ZD wg „jak dotąd” (null = bez porównania). */
  compareZdUnits?: number | null;
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
  const history = useProductHistory(
    line.tw_Id,
    activePair ? { twinTwId: activePair.twinTwId, unitsPerPack: activePair.unitsPerPack } : null
  );
  const packLabel = qty.packageLabel.trim() || "op.";
  const purchaseUnit = (r: ZdProductPurchaseRow): { label: string; piecesPerUnit: number | null } => {
    if (activePair && r.twId !== line.tw_Id) return { label: "szt", piecesPerUnit: null };
    if (activePair) return { label: packLabel, piecesPerUnit: activePair.unitsPerPack };
    return qty.hasPackaging && isPackagingPackagesMode(qty.documentUnitMode)
      ? { label: packLabel, piecesPerUnit: qty.unitsPerPackage }
      : { label: "szt", piecesPerUnit: null };
  };
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
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === "Tab") {
        // Pułapka fokusu — karta jest modalna.
        const panel = panelRef.current;
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
  }, [onPrev, onNext, requestClose, panelRef]);

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
      ? "Nic do zamówienia"
      : shownUnits !== qty.zdUnits
        ? `Na ZD: ${formatQty(shownUnits)} ${qty.hasPackaging && isPackagingPackagesMode(qty.documentUnitMode) ? `× ${label}` : "szt"} (wpisane ręcznie)`
        : (preview?.orderLine ?? `Na ZD: ${formatQty(shownUnits)} szt`);
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
        className="panel-slide-enter fixed inset-y-0 right-0 z-[49] flex w-full max-w-xl flex-col border-l border-slate-200/80 bg-white shadow-2xl"
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5" {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}>
          <section className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-3" aria-label="Decyzja">
            <p className="text-sm font-semibold tabular-nums text-slate-900">{decision}</p>
            <p className={cn("mt-0.5 text-xs", lead != null && days != null && days < lead ? "text-red-700" : "text-slate-600")}>
              {coverLine}
            </p>
            {compareZdUnits != null && compareZdUnits !== shownUnits ? (
              <p className="mt-1 text-xs tabular-nums text-slate-600">
                Strategia „jak dotąd”: {formatQty(compareZdUnits)}{" "}
                {qty.hasPackaging && isPackagingPackagesMode(qty.documentUnitMode) ? label : "szt"}
              </p>
            ) : null}
          </section>

          <ZdProductPurchasesSection state={history} titleId={titleId} unitFor={purchaseUnit} />

          {line.salesProfile && line.salesProfile.windows.length > 0 ? (
            <section aria-labelledby={`${titleId}-sales`}>
              <h3 id={`${titleId}-sales`} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Sprzedaż i nasze ZD
              </h3>
              <div className="mt-1.5 text-xs leading-relaxed text-slate-800">
                <ZdSalesProfileCardContent profile={line.salesProfile} orders={orderMarks} />
              </div>
            </section>
          ) : null}

          <ZdProductSalesSections state={history} titleId={titleId} />

          {pairStockRows.length > 0 ? (
            <section aria-labelledby={`${titleId}-stock`}>
              <h3 id={`${titleId}-stock`} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Stan pary
              </h3>
              <dl className="mt-1.5 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 text-sm">
                {pairStockRows.map(([label, value]) => (
                  <div key={label} className="bg-white px-2.5 py-1.5">
                    <dt className="text-xs text-slate-600">{label}</dt>
                    <dd className="tabular-nums font-medium text-slate-900">{formatQty(Number(value) || 0)} szt</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section aria-labelledby={`${titleId}-why`}>
            <h3 id={`${titleId}-why`} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Dlaczego tyle
            </h3>
            <ol className="mt-1.5 divide-y divide-slate-100 rounded-md border border-slate-200">
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
          </section>
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-3">
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
