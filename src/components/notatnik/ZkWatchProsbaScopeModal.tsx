"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { actionUpdateZkWatchProsbaScope } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { useProsbaLineStockBatchFetch } from "@/hooks/useProsbaLineStockBatchFetch";
import { useProsbaAlreadyOrdered } from "@/hooks/useProsbaAlreadyOrdered";
import {
  formatPieces,
  shortDayLabel,
  zkLineIncomingCover,
  type ProsbaAlreadyOrderedMap,
} from "@/lib/orders/prosba-already-ordered";
import { cn } from "@/lib/cn";
import {
  adjustStockMapForZkLines,
  assessProsbaLineStock,
  buildZkProsbaScopeInitialOrderMarked,
  collectZkProsbaScopeLineTwIds,
  deriveZkProsbaScopeSuggestedOrderKeys,
  formatZkProsbaAutoMarkedHint,
  formatZkProsbaScopeLineBadge,
  formatZkProsbaScopeLineStockDetail,
  zkProsbaScopeAllLinesSufficient,
  zkProsbaScopeLineKeysToOrder,
  zkProsbaScopeStockFetchFailed,
} from "@/lib/orders/prosba-stock-check";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { buildZkWatchLineViews, parseZkWatchLineChecks } from "@/lib/sales/zk-watch-lines";
import {
  deriveZkProsbaScopeAutoProsbaGate,
  getZkWatchProsbaScopeLineKeys,
  needsProsbaByKeyFromChecks,
} from "@/lib/sales/zk-watch-prosba-scope";
import {
  collectZkTeethLineCandidates,
  zkWatchTeethDraftsReady,
  type TeethDraftRegistryLookup,
} from "@/lib/sales/zk-watch-teeth-draft";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import type { SalesZkWatch } from "@/types/database";
import { IconClipboardList } from "@/components/icons/StrokeIcons";
import {
  ZK_PROSBA_MODAL_BODY_CLASS,
  ZkProsbaModalCallout,
} from "@/components/notatnik/ZkProsbaModalCallout";

function useZkProsbaScopeSelection(watch: SalesZkWatch, open: boolean) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const productLines = useMemo(
    () => lineViews.filter((line) => line.key !== "summary"),
    [lineViews]
  );
  const existingScope = useMemo(
    () => getZkWatchProsbaScopeLineKeys(watch, lineViews),
    [watch, lineViews]
  );
  const needsProsbaByKey = useMemo(
    () => needsProsbaByKeyFromChecks(parseZkWatchLineChecks(watch.line_checks)),
    [watch.line_checks]
  );
  const twIds = useMemo(() => collectZkProsbaScopeLineTwIds(productLines), [productLines]);

  const {
    stockByTwId: rawStockByTwId,
    loading: stockLoading,
    timedOut: stockFetchTimedOut,
  } = useProsbaLineStockBatchFetch(twIds, open);

  const stockByTwId = useMemo(
    () => adjustStockMapForZkLines(productLines, rawStockByTwId),
    [productLines, rawStockByTwId]
  );

  // Towar w drodze (Subiekt na żywo) — pozycję, którą pokryje dostawa z terminem w przód,
  // nie zaznaczamy do zamówienia: druga prośba byłaby dublem.
  const prosbaLinesForCheck = useMemo(
    () => productLines.map((l) => ({ subiektTwId: l.subiektTwId })),
    [productLines]
  );
  const { map: incomingByTwId, checkingTwIds } = useProsbaAlreadyOrdered(
    prosbaLinesForCheck,
    "zamowienie",
    open,
    watch.sales_person_id
  );
  const incomingLoading = checkingTwIds.size > 0;
  const coveredKeys = useMemo(
    () => zkLinesCoveredByIncoming(productLines, incomingByTwId, stockByTwId),
    [productLines, incomingByTwId, stockByTwId]
  );

  /** Zaznaczone = do zamówienia (prośba). */
  const [orderMarked, setOrderMarked] = useState<Set<string>>(() => new Set());
  const [scopeInitDone, setScopeInitDone] = useState(false);
  const [userTouchedSelection, setUserTouchedSelection] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (userTouchedSelection) return;

    // Zapisany zakres nie zależy od stanu ani dostaw — przywróć od razu.
    if (existingScope !== null) {
      if (scopeInitDone) return;
      const keys = buildZkProsbaScopeInitialOrderMarked({
        lines: productLines,
        stockByTwId: {},
        existingScope,
        needsProsbaByKey,
        stockExemptTwIds: teethExemptTwIds,
      });
      queueMicrotask(() => {
        setOrderMarked(new Set(keys));
        setScopeInitDone(true);
      });
      return;
    }
    if (stockLoading || incomingLoading) return;

    const hasStockData = Object.keys(stockByTwId).length > 0;
    if (!hasStockData && !stockFetchTimedOut) return;

    const keys = buildZkProsbaScopeInitialOrderMarked({
      lines: productLines,
      stockByTwId,
      existingScope,
      needsProsbaByKey,
      stockExemptTwIds: teethExemptTwIds,
    }).filter((key) => !coveredKeys.has(key));
    queueMicrotask(() => setOrderMarked(new Set(keys)));
  }, [
    incomingLoading,
    coveredKeys,
    open,
    existingScope,
    needsProsbaByKey,
    productLines,
    stockByTwId,
    stockLoading,
    stockFetchTimedOut,
    scopeInitDone,
    userTouchedSelection,
    teethExemptTwIds,
  ]);

  function setOrderMarkedWithTouch(value: Set<string> | ((prev: Set<string>) => Set<string>)) {
    setUserTouchedSelection(true);
    setOrderMarked(value);
  }

  return {
    productLines,
    orderMarked,
    setOrderMarked: setOrderMarkedWithTouch,
    stockByTwId,
    rawStockByTwId,
    stockLoading,
    stockFetchTimedOut,
    hasExistingScope: existingScope !== null,
    incomingByTwId,
    incomingLoading,
    coveredKeys,
  };
}

/** Klucze pozycji ZK, które pokryje dostawa z ZD z terminem w przód. */
function zkLinesCoveredByIncoming(
  lines: readonly { key: string; subiektTwId: number | null; quantity: number | null }[],
  incomingByTwId: ProsbaAlreadyOrderedMap,
  stockByTwId: Record<number, import("@/lib/orders/prosba-stock-check").ProsbaLineStockSnapshot>
): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    if (line.subiektTwId == null) continue;
    // Pokryte półką — wiersz nie pokazuje „W drodze”, więc nie liczy się do tej grupy.
    const snap = stockByTwId[line.subiektTwId];
    if (snap && assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) === "sufficient") continue;
    const cover = zkLineIncomingCover(incomingByTwId[line.subiektTwId]?.incoming, line.quantity);
    if (cover?.covered && cover.certain) out.add(line.key);
  }
  return out;
}

export type ZkProsbaScopeSavedMeta = {
  autoProsba: boolean;
  selectedScopeCount: number;
  stockByTwId: Record<number, import("@/lib/orders/prosba-stock-check").ProsbaLineStockSnapshot>;
};

export function ZkWatchProsbaScopeModal({
  watch,
  open,
  required = false,
  readOnly = false,
  tourPreview = false,
  delegatePreview = false,
  teethRegistry,
  onClose,
  onSaved,
}: {
  watch: SalesZkWatch;
  open: boolean;
  /** Gdy true — nie można zamknąć bez zapisu (pierwsze dodanie ZK). */
  required?: boolean;
  readOnly?: boolean;
  tourPreview?: boolean;
  delegatePreview?: boolean;
  teethRegistry?: TeethDraftRegistryLookup;
  onClose: () => void;
  onSaved: (watch: SalesZkWatch, meta: ZkProsbaScopeSavedMeta) => void;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const {
    productLines,
    orderMarked,
    setOrderMarked,
    stockByTwId,
    rawStockByTwId,
    stockLoading,
    stockFetchTimedOut,
    hasExistingScope,
    incomingByTwId,
    incomingLoading,
    coveredKeys,
  } = useZkProsbaScopeSelection(watch, open);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoProsba, setAutoProsba] = useState(false);
  const canOfferAutoProsba = !readOnly && !tourPreview;
  // delegatePreview: AUTO jest dozwolone (serwer też), jak manual /prosba.
  void delegatePreview;
  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const lineKeysToOrder = zkProsbaScopeLineKeysToOrder(productLines, orderMarked);
  const allLinesSufficient =
    !stockLoading && zkProsbaScopeAllLinesSufficient(productLines, stockByTwId, teethExemptTwIds);
  const noneMarkedForOrder = orderMarked.size === 0 && productLines.length > 0;
  const stockUnavailable =
    !stockLoading &&
    (stockFetchTimedOut || zkProsbaScopeStockFetchFailed(productLines, rawStockByTwId));
  const awaitingAutoMark =
    (stockLoading || incomingLoading) && !hasExistingScope && !stockFetchTimedOut;
  const autoMarkedCount =
    !stockLoading && !hasExistingScope
      ? deriveZkProsbaScopeSuggestedOrderKeys(productLines, stockByTwId, teethExemptTwIds).filter(
          (key) => !coveredKeys.has(key)
        ).length
      : 0;
  const coveredUnmarkedCount = [...coveredKeys].filter((key) => !orderMarked.has(key)).length;

  function toggleLine(key: string) {
    setOrderMarked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const keysToOrder = zkProsbaScopeLineKeysToOrder(productLines, orderMarked);
    try {
      const { watch: updated } = await actionUpdateZkWatchProsbaScope(watch.id, keysToOrder);
      onSaved(updated, {
        autoProsba: autoProsbaActive && canOfferAutoProsba,
        selectedScopeCount: keysToOrder.length,
        stockByTwId: { ...stockByTwId },
      });
      setAutoProsba(false);
      onClose();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się zapisać zakresu."));
    } finally {
      setSaving(false);
    }
  }

  const orderCount = lineKeysToOrder.length;
  const totalLines = productLines.length;
  const teethCandidates =
    teethRegistry && orderCount > 0
      ? collectZkTeethLineCandidates(watch, teethRegistry).filter((c) =>
          lineKeysToOrder.includes(c.lineKey)
        )
      : [];
  const teethIncomplete =
    teethRegistry != null &&
    teethCandidates.length > 0 &&
    !zkWatchTeethDraftsReady(watch, teethRegistry, {
      lineKeys: lineKeysToOrder,
      requestKind: "zamowienie",
    });
  const teethCatalogUnavailable = teethRegistry?.catalogAvailable === false;
  const overBatchLimit = orderCount > MAX_BATCH_ORDER_LINES;
  const { disabled: autoProsbaDisabled, hint: autoProsbaHint } = deriveZkProsbaScopeAutoProsbaGate({
    stockUnavailable,
    teethCatalogUnavailable,
    overBatchLimit,
    stockLoading,
    teethIncomplete,
  });
  const autoProsbaActive = autoProsba && !autoProsbaDisabled;

  const handleClose = useCallback(() => {
    setAutoProsba(false);
    onClose();
  }, [onClose]);

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      disableBackdropClose={required}
      size="md"
      title={`${displayNumber} - co zamawiamy?`}
      description={watch.client_label}
      bodyClassName={ZK_PROSBA_MODAL_BODY_CLASS}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {orderCount > 0 ? (
              <>
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-indigo-100 text-[0.625rem] font-bold text-indigo-700">
                  {orderCount}
                </span>
                <span className="font-medium text-slate-700">
                  {orderCount} {plPozycja(orderCount)} do zamówienia
                </span>
              </>
            ) : (
              <span className="text-slate-400">Brak pozycji do zamówienia</span>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {required ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
                Skonfiguruj później
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
                Anuluj
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={saving || awaitingAutoMark}
              onClick={() => void save()}
              className={cn(
                orderCount > 0 && !saving &&
                  "bg-indigo-600 hover:bg-indigo-700"
              )}
            >
              {saving
                ? "Zapisuję zakres…"
                : awaitingAutoMark
                  ? "Sprawdzam stan…"
                  : autoProsbaActive && orderCount > 0
                    ? `Zapisz i utwórz prośbę (${orderCount})`
                    : orderCount === 0
                      ? "Zapisz - bez prośby"
                      : `Zapisz (${orderCount})`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border border-indigo-200/60 bg-indigo-50/80 px-3.5 py-2.5">
        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-indigo-100/80 text-indigo-600">
            <IconClipboardList size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-indigo-950">Zaznacz pozycje do zamówienia</p>
            <p className="mt-0.5 text-xs leading-relaxed text-indigo-900/70">
              Zaznaczone trafią do prośby u zakupów. Odznacz towar na stanie w Subiekcie
              (uwzględniamy rezerwacje z tego ZK). Status &bdquo;na magazynie&rdquo; pojawi się po
              dostawie z prośby.
            </p>
          </div>
        </div>
      </div>

      {stockLoading ? (
        <ZkProsbaModalCallout tone="sky" icon="spinner" role="status">
          <span className="font-medium">Sprawdzam stan magazynowy w Subiekcie…</span>
        </ZkProsbaModalCallout>
      ) : null}

      {stockFetchTimedOut ? (
        <ZkProsbaModalCallout tone="amber" role="status">
          Sprawdzanie stanu trwa zbyt długo - zaznacz pozycje ręcznie lub zapisz bez
          automatycznego podpowiadania.
        </ZkProsbaModalCallout>
      ) : null}

      {stockUnavailable && !stockFetchTimedOut ? (
        <ZkProsbaModalCallout tone="amber" role="status">
          Nie udało się pobrać stanu z Subiekta - zaznacz ręcznie pozycje do zamówienia.
        </ZkProsbaModalCallout>
      ) : null}

      {!awaitingAutoMark && coveredUnmarkedCount > 0 ? (
        <ZkProsbaModalCallout tone="info" role="status">
          {coveredUnmarkedCount === 1
            ? "1 pozycja jest już w drodze od dostawcy (ZD z terminem) - nie zaznaczono jej do zamówienia."
            : `${coveredUnmarkedCount} ${plPozycja(coveredUnmarkedCount)} ${polishPluralWord(coveredUnmarkedCount, "jest", "są", "jest")} już w drodze od dostawcy (ZD z terminem) - nie zaznaczono ich do zamówienia.`}
        </ZkProsbaModalCallout>
      ) : null}

      {!stockLoading && autoMarkedCount > 0 && !noneMarkedForOrder ? (
        <ZkProsbaModalCallout tone="info">
          {formatZkProsbaAutoMarkedHint(autoMarkedCount)}
        </ZkProsbaModalCallout>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <span className={salesTypography.sectionLabel}>Pozycje z ZK</span>
          <span className="text-[0.6875rem] font-medium text-slate-400">
            {totalLines} {plPozycja(totalLines)}
          </span>
        </div>
        <ul
          className={cn(
            "divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm",
            awaitingAutoMark && "pointer-events-none opacity-60"
          )}
          aria-busy={awaitingAutoMark || undefined}
        >
          {productLines.map((line) => {
            const markedForOrder = orderMarked.has(line.key);
            const twId = line.subiektTwId;
            const snap = twId ? stockByTwId[twId] : undefined;
            const sufficient =
              twId != null &&
              snap != null &&
              assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) === "sufficient";
            const rawSnap = twId ? rawStockByTwId[twId] : undefined;
            const incomingInfo = twId != null ? incomingByTwId[twId] : undefined;
            const cover = sufficient ? null : zkLineIncomingCover(incomingInfo?.incoming, line.quantity);
            // Pokryte pewną dostawą (ZD z terminem w przód) i nie zaznaczone — jak „na stanie”.
            const coveredByIncoming = Boolean(cover?.covered && cover.certain && !markedForOrder);
            const ownOpen = (incomingInfo?.own.length ?? 0) > 0;
            const incomingDetail = ownOpen
              ? "Masz już otwartą prośbę na ten towar - druga byłaby dublem."
              : cover
                ? cover.covered
                  ? cover.certain
                    ? `W drodze: ${cover.doc ? `${cover.doc.dokNr} · termin ${shortDayLabel(cover.doc.deadline)} · ` : ""}wolne dla tego ZK ${formatPieces(cover.freeForLine)} - nie trzeba zamawiać.`
                    : `W drodze wolne ${formatPieces(cover.freeForLine)}, ale bez pewnego terminu ZD - zapytaj zakupy albo zamów.`
                  : `W drodze ${formatPieces(incomingInfo!.incoming!.incoming)}, ale czekają na to inne zamówienia klientów.`
                : null;
            const stockBadgeLabel = coveredByIncoming && cover
              ? cover.doc?.deadline
                ? `W drodze · do ${shortDayLabel(cover.doc.deadline)}`
                : "W drodze"
              : formatZkProsbaScopeLineBadge({
              sufficient,
              markedForOrder,
              available: snap?.available ?? null,
              hasStockData: snap != null,
            });
            const stockDetail = formatZkProsbaScopeLineStockDetail({
              sufficient,
              available: snap?.available ?? null,
              hasStockData: snap != null,
              onHand: snap?.onHand ?? null,
              zkLineQty: line.quantity,
              rawReserved: rawSnap?.reserved ?? null,
            });

            return (
              <li key={line.key}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3.5 py-3 transition-colors duration-150",
                    (sufficient || coveredByIncoming) && !markedForOrder
                      ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                      : "bg-amber-50/40 hover:bg-amber-50/60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={markedForOrder}
                    disabled={saving || awaitingAutoMark}
                    onChange={() => toggleLine(line.key)}
                    aria-label={
                      markedForOrder
                        ? `${line.product} - do zamówienia, odznacz aby pominąć`
                        : `${line.product} - pominięte, zaznacz aby zamówić`
                    }
                    className="mt-0.5 size-4 shrink-0 rounded-md border-slate-300 text-indigo-600 transition-colors focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn(salesTypography.rowTitle, "block text-slate-900")}>
                      {line.product}
                      {twId != null && teethExemptTwIds.has(twId) ? (
                        <span className="ml-1.5 inline-flex rounded-md bg-violet-50 px-1.5 py-0.5 text-[0.625rem] font-medium text-violet-800 ring-1 ring-inset ring-violet-200/70">
                          Zęby
                        </span>
                      ) : null}
                    </span>
                    {(line.symbol || line.quantityLabel) && (
                      <span className={cn(salesTypography.rowMeta, "mt-0.5 block text-slate-500")}>
                        {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {stockDetail && (
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                        {stockDetail}
                      </span>
                    )}
                    {incomingDetail ? (
                      <span
                        className={cn(
                          "mt-0.5 block text-xs leading-snug",
                          ownOpen ? "font-medium text-amber-900" : coveredByIncoming ? "text-emerald-900" : "text-slate-600"
                        )}
                      >
                        {incomingDetail}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      salesTypography.kindTag,
                      "shrink-0 rounded-md px-2 py-0.5 leading-none",
                      (sufficient || coveredByIncoming) && !markedForOrder
                        ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80"
                        : "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80"
                    )}
                  >
                    {stockBadgeLabel}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {noneMarkedForOrder && !stockLoading ? (
        allLinesSufficient ? (
          <ZkProsbaModalCallout tone="emerald">
            Wszystkie pozycje są na stanie i zarezerwowane w tym ZK - zapisz, jeśli nic nie trzeba
            zamawiać u dostawcy.
          </ZkProsbaModalCallout>
        ) : (
          <ZkProsbaModalCallout tone="amber">
            Nic nie zaznaczono do zamówienia - zaznacz pozycje, które chcesz wysłać w prośbie.
          </ZkProsbaModalCallout>
        )
      ) : null}

      {canOfferAutoProsba && orderCount > 0 ? (
        <div
          className={cn(
            "space-y-2.5 rounded-lg border px-3.5 py-2.5",
            autoProsbaActive
              ? "border-indigo-200/70 bg-indigo-50/40"
              : "border-slate-200/80 bg-slate-50/50"
          )}
        >
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={autoProsbaActive}
              disabled={saving || autoProsbaDisabled}
              onChange={(e) => setAutoProsba(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded-md border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/40"
            />
            <span className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-900">
                Zgłoś prośbę od razu ({orderCount})
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                {autoProsbaActive
                  ? "Po zapisie utworzymy prośbę bez formularza. Brak dostawcy uzupełnią zakupy; towar na stanie wymaga potwierdzenia. Pominiemy pozycje już w otwartej prośbie."
                  : "Po zapisie zakresu od razu utworzymy prośbę z zaznaczonych pozycji."}
              </span>
            </span>
          </label>
          {autoProsbaHint ? (
            <ZkProsbaModalCallout tone="amber" className="bg-amber-50/90">
              {autoProsbaHint}
            </ZkProsbaModalCallout>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <ZkProsbaModalCallout tone="rose" role="alert">
          {error}
        </ZkProsbaModalCallout>
      ) : null}
    </ModalShell>
  );
}
