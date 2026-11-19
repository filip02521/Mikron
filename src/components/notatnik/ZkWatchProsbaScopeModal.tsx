"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertCircle,
  IconCheck,
  IconChevronDown,
  IconClipboardList,
  IconHelpCircle,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { actionUpdateZkWatchProsbaScope } from "@/app/actions/sales-notepad";
import { actionAttachZkLinesToIncoming } from "@/app/actions/zk-attach-incoming";
import { selectZkLinesToAttachIncoming } from "@/lib/sales/zk-attach-incoming";
import type { ZkWatchLineCoverage } from "@/lib/sales/zk-watch-order-link";
import type { ZkAttachIncomingNote } from "@/lib/sales/zk-watch-auto-prosba-copy";
import { Badge } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { warsawTodayDateKey } from "@/lib/warehouse/delivery-receipts-shared";
import { Button } from "@/components/ui/Button";
import {
  assessZkLineAvailability,
  countZkLineAvailability,
  type ZkLineAvailability,
  type ZkLineAvailabilityKind,
} from "@/lib/sales/zk-line-availability";
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
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import type { SalesZkWatch } from "@/types/database";
import {
  ZK_PROSBA_MODAL_BODY_CLASS,
  ZkProsbaModalCallout,
} from "@/components/notatnik/ZkProsbaModalCallout";

/**
 * `requestCoveredKeys` — pozycje z prośbą powiązaną z tym ZK: zostają w zakresie (czekają na towar),
 * ale nie są zaznaczone, bo zaznaczenie znaczy „zamów teraz” i dałoby drugą prośbę.
 */
function useZkProsbaScopeSelection(
  watch: SalesZkWatch,
  open: boolean,
  requestCoveredKeys: ReadonlySet<string>
) {
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
        setOrderMarked(new Set(keys.filter((key) => !requestCoveredKeys.has(key))));
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
    }).filter((key) => !coveredKeys.has(key) && !requestCoveredKeys.has(key));
    queueMicrotask(() => setOrderMarked(new Set(keys)));
  }, [
    incomingLoading,
    coveredKeys,
    requestCoveredKeys,
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

/** Kolejność i kolory stanów w pasku dostępności (nagłówek okna i wiersze). */
const AVAILABILITY_SEGMENTS: { kind: ZkLineAvailabilityKind; label: string; fill: string }[] = [
  { kind: "stock", label: "Na stanie", fill: "bg-emerald-600" },
  { kind: "transit", label: "W drodze", fill: "bg-indigo-600" },
  {
    kind: "ordered",
    label: "Już zamówione",
    fill: "bg-[repeating-linear-gradient(135deg,var(--color-indigo-600)_0_3px,var(--color-indigo-100)_3px_6px)]",
  },
  { kind: "need", label: "Brak lub niepewne", fill: "bg-amber-500" },
  { kind: "unknown", label: "Bez danych", fill: "bg-slate-300" },
];

/** Ikona przy krótkim stanie w wierszu — kolor i kształt czytane bez czytania słowa. */
const CHIP_ICON: Record<ZkLineAvailabilityKind, typeof IconCheck> = {
  stock: IconCheck,
  transit: IconTruck,
  ordered: IconClipboardList,
  need: IconAlertCircle,
  unknown: IconHelpCircle,
};

export type ZkProsbaScopeSavedMeta = {
  autoProsba: boolean;
  selectedScopeCount: number;
  stockByTwId: Record<number, import("@/lib/orders/prosba-stock-check").ProsbaLineStockSnapshot>;
  /** Pozycje podpięte pod towar w drodze (zamiast prośby do zakupów). */
  attachNote?: ZkAttachIncomingNote;
  /** Klucze tych pozycji — auto-prośba nie może ich wziąć, zanim lista próśb się odświeży. */
  attachedKeys?: string[];
};

export function ZkWatchProsbaScopeModal({
  watch,
  open,
  required = false,
  readOnly = false,
  tourPreview = false,
  delegatePreview = false,
  teethRegistry,
  lineCoverageByKey,
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
  /** Pokrycie pozycji prośbami powiązanymi z tym ZK (podpowiedzi notatnika). */
  lineCoverageByKey?: Record<string, ZkWatchLineCoverage>;
  onClose: () => void;
  onSaved: (watch: SalesZkWatch, meta: ZkProsbaScopeSavedMeta) => void;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const requestCoveredKeys = useMemo(
    () =>
      new Set(
        Object.entries(lineCoverageByKey ?? {})
          .filter(([, coverage]) => coverage !== "uncovered")
          .map(([key]) => key)
      ),
    [lineCoverageByKey]
  );
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
  } = useZkProsbaScopeSelection(watch, open, requestCoveredKeys);
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
  // Niezaznaczone pozycje pokryte ZD z terminem i znanym dostawcą — po zapisie trafią do Moje
  // jako zamówione (serwer liczy pokrycie jeszcze raz i może któreś odrzucić).
  const attachCandidates = useMemo(
    () =>
      !canOfferAutoProsba || awaitingAutoMark || incomingLoading
        ? []
        : selectZkLinesToAttachIncoming({
            lines: productLines,
            stockByTwId,
            incomingByTwId,
            excludeKeys: new Set([...orderMarked, ...requestCoveredKeys]),
            stockExemptTwIds: teethExemptTwIds,
            requireSupplier: true,
          }),
    [canOfferAutoProsba, awaitingAutoMark, incomingLoading, productLines, stockByTwId, incomingByTwId, orderMarked, requestCoveredKeys, teethExemptTwIds]
  );
  const attachByKey = new Map(attachCandidates.map((c) => [c.key, c]));
  const awaitingData = stockLoading || incomingLoading;
  const availabilityByKey = useMemo(
    () =>
      new Map<string, ZkLineAvailability>(
        productLines.map((line) => {
          const twId = line.subiektTwId;
          return [
            line.key,
            assessZkLineAvailability({
              quantity: line.quantity,
              stock: twId != null ? stockByTwId[twId] : undefined,
              info: twId != null ? incomingByTwId[twId] : undefined,
              stockExempt: twId != null && teethExemptTwIds.has(twId),
              zkCoverage: lineCoverageByKey?.[line.key],
            }),
          ];
        })
      ),
    [productLines, stockByTwId, incomingByTwId, teethExemptTwIds, lineCoverageByKey]
  );
  const availabilityCounts = countZkLineAvailability([...availabilityByKey.values()]);
  const availabilityBarLabel = AVAILABILITY_SEGMENTS.filter((seg) => availabilityCounts[seg.kind] > 0)
    .map((seg) => `${seg.label}: ${availabilityCounts[seg.kind]}`)
    .join(", ");
  // Najpierw to, co wymaga decyzji; w grupie kolejność z ZK, więc zaznaczenie nie przesuwa wierszy.
  const lineGroups = [
    {
      id: "decide",
      // Przed danymi z Subiekta nic nie wiemy — jedna lista bez obietnicy „do decyzji”.
      title: awaitingData ? "Pozycje z ZK" : "Do decyzji",
      hint: awaitingData ? "" : "brak albo niepewne",
      lines: productLines.filter((line) => {
        const kind = availabilityByKey.get(line.key)?.kind;
        return awaitingData || kind === "need" || kind === "unknown";
      }),
    },
    {
      id: "covered",
      title: "Nie trzeba zamawiać",
      hint: "na stanie, w drodze, już zamówione",
      lines: awaitingData
        ? []
        : productLines.filter((line) => {
            const kind = availabilityByKey.get(line.key)?.kind;
            return kind === "stock" || kind === "transit" || kind === "ordered";
          }),
    },
  ].filter((group) => group.lines.length > 0);
  const todayKey = warsawTodayDateKey();
  const [openDocsKeys, setOpenDocsKeys] = useState<Set<string>>(() => new Set());
  function toggleDocs(key: string) {
    setOpenDocsKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const attachCount = attachCandidates.length;
  // Nic do zamówienia, bo każda pozycja jest na stanie albo pójdzie pod dostawę w drodze.
  const allLinesHandledWithoutOrder =
    attachCount > 0 &&
    !stockLoading &&
    (attachCount === productLines.length ||
      zkProsbaScopeAllLinesSufficient(
        productLines.filter((line) => !attachByKey.has(line.key)),
        stockByTwId,
        teethExemptTwIds
      ));

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
    // Pozycja podpinana pod dostawę też czeka na towar — w zakresie, inaczej ZK wyglądałoby
    // na gotowe do zamknięcia. Prośba „już zamówione” pokrywa ją, więc auto-prośba jej nie zdubluje.
    const scopeKeys = zkProsbaScopeLineKeysToOrder(productLines, [
      ...keysToOrder,
      ...attachCandidates.map((c) => c.key),
      ...requestCoveredKeys,
    ]);
    try {
      const { watch: updated } = await actionUpdateZkWatchProsbaScope(watch.id, scopeKeys);
      let attachNote: ZkAttachIncomingNote | undefined;
      let attachedKeys: string[] = [];
      if (attachCount > 0) {
        const res = await actionAttachZkLinesToIncoming(
          watch.id,
          attachCandidates.map((c) => c.key)
        );
        attachNote = res.ok
          ? { attached: res.attached, notAttached: Math.max(0, attachCount - res.attached) }
          : { attached: 0, error: res.error };
        if (res.ok) attachedKeys = res.attachedKeys;
      }
      onSaved(updated, {
        autoProsba: autoProsbaActive && canOfferAutoProsba,
        selectedScopeCount: keysToOrder.length,
        stockByTwId: { ...stockByTwId },
        attachNote,
        attachedKeys,
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
      size="lg"
      title={`${displayNumber} - co zamawiamy?`}
      description={watch.client_label}
      bodyClassName={ZK_PROSBA_MODAL_BODY_CLASS}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-slate-600">
            {orderCount > 0 ? (
              <span className="font-medium text-slate-900">
                {orderCount} {plPozycja(orderCount)} do prośby
              </span>
            ) : (
              "Bez prośby"
            )}
            {attachCount > 0 ? (
              <span className="text-indigo-800"> · {attachCount} podepniemy pod ZD</span>
            ) : null}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:shrink-0 sm:flex-row sm:justify-end">
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
                  "bg-indigo-600 hover:bg-primary-hover"
              )}
            >
              {saving
                ? "Zapisuję zakres…"
                : awaitingAutoMark
                  ? "Sprawdzam stan…"
                  : autoProsbaActive && orderCount > 0
                    ? `Zapisz i utwórz prośbę (${orderCount})`
                    : orderCount === 0
                      ? attachCount > 0
                        ? `Zapisz i podepnij (${attachCount})`
                        : "Zapisz - bez prośby"
                      : `Zapisz (${orderCount})`}
            </Button>
          </div>
        </div>
      }
    >
      {awaitingData ? (
        <div role="status" className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <BrandLoader size="sm" tile={false} />
          <span>Sprawdzam stan i dostawy w drodze - zwykle 1-3 s.</span>
        </div>
      ) : (
        <section aria-label="Dostępność pozycji" className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium leading-snug text-slate-800">
              {availabilityCounts.need > 0
                ? `${availabilityCounts.need} do decyzji`
                : "Nic nie trzeba zamawiać"}
            </p>
            <p className="text-xs text-slate-500">
              z {totalLines} pozycji · Subiekt na żywo
            </p>
          </div>
          <div
            role="img"
            aria-label={availabilityBarLabel}
            className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-slate-100"
          >
            {AVAILABILITY_SEGMENTS.map((seg) =>
              availabilityCounts[seg.kind] > 0 ? (
                <span
                  key={seg.kind}
                  className={seg.fill}
                  style={{ width: `${(availabilityCounts[seg.kind] / totalLines) * 100}%` }}
                />
              ) : null
            )}
          </div>
        </section>
      )}

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

      <div
        className={cn(
          "overflow-hidden rounded-lg border border-slate-200/80 bg-card",
          awaitingAutoMark && "pointer-events-none opacity-60"
        )}
        aria-busy={awaitingAutoMark || undefined}
      >
        {lineGroups.map((group, groupIndex) => (
          <section key={group.id} aria-label={group.title}>
            <h3
              className={cn(
                "flex items-baseline justify-between gap-3 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700",
                groupIndex > 0 && "border-t border-slate-200/80"
              )}
            >
              {group.title}
              <span className="hidden font-normal text-slate-500 sm:inline">{group.hint}</span>
            </h3>
            <ul className="divide-y divide-slate-100">
              {group.lines.map((line) => {
                const markedForOrder = orderMarked.has(line.key);
                const twId = line.subiektTwId;
                const snap = twId ? stockByTwId[twId] : undefined;
                const sufficient =
                  twId != null &&
                  snap != null &&
                  assessProsbaLineStock({ requestedQty: line.quantity, stock: snap }) === "sufficient";
                const rawSnap = twId ? rawStockByTwId[twId] : undefined;
                const availability = availabilityByKey.get(line.key)!;
                const attach = attachByKey.get(line.key);
                const stockDetail = formatZkProsbaScopeLineStockDetail({
                  sufficient,
                  available: snap?.available ?? null,
                  hasStockData: snap != null,
                  onHand: snap?.onHand ?? null,
                  zkLineQty: line.quantity,
                  rawReserved: rawSnap?.reserved ?? null,
                });
                const note = attach
                  ? `Po zapisie podepniemy pod ${attach.doc.dokNr} jako zamówione, bez prośby do zakupów.`
                  : availability.kind === "transit"
                    ? (availability.note ?? "Pokryje to dostawa z ZD z terminem - nie trzeba zamawiać.")
                    : availability.note;
                // Zaznaczone do prośby, choć towar już jest (półka, dostawa, własna prośba).
                const duplicateWarning =
                  markedForOrder && availability.kind === "ordered"
                    ? "Masz już prośbę na ten towar - druga byłaby dublem."
                    : markedForOrder && (availability.kind === "stock" || availability.kind === "transit")
                      ? "Już pokryte - zamawiaj tylko, jeśli klient potrzebuje więcej."
                      : null;
                const open = openDocsKeys.has(line.key);
                const ChipIcon = CHIP_ICON[availability.kind];

                return (
                  <li key={line.key} className={markedForOrder ? "bg-indigo-50" : undefined}>
                    <div className="flex items-start gap-1 pr-1.5">
                      <label
                        className={cn(
                          "flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 pl-3.5 transition-colors duration-150 motion-reduce:transition-none",
                          !markedForOrder && "hover:bg-slate-50"
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
                          className="size-4 shrink-0 rounded-md border-slate-300 text-indigo-700 transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-0"
                        />
                        <span className="min-w-0 flex-[1_1_12rem]">
                          <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                            {line.product}
                            {twId != null && teethExemptTwIds.has(twId) ? (
                              <Badge variant="info" className="ml-1.5 align-middle">
                                Zęby
                              </Badge>
                            ) : null}
                          </span>
                          {line.symbol ? (
                            <span className="block font-mono text-[0.6875rem] text-slate-500">{line.symbol}</span>
                          ) : null}
                          {duplicateWarning ? (
                            <span className="mt-0.5 block text-xs leading-snug text-amber-900">
                              {duplicateWarning}
                            </span>
                          ) : null}
                        </span>
                        <span className="ml-7 flex shrink-0 items-center gap-2.5 sm:ml-auto">
                          {line.quantityLabel ? (
                            <span className="text-[0.8125rem] tabular-nums text-slate-700">{line.quantityLabel}</span>
                          ) : null}
                          {awaitingData ? null : (
                            <Badge variant={availability.tone} className="gap-1 whitespace-nowrap py-1">
                              <ChipIcon size={13} strokeWidth={2.2} aria-hidden />
                              {availability.chip}
                            </Badge>
                          )}
                        </span>
                      </label>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${open ? "Ukryj" : "Pokaż"} szczegóły: ${line.product}`}
                        onClick={() => toggleDocs(line.key)}
                        className="mt-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <IconChevronDown
                          size={16}
                          className={cn("transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
                          aria-hidden
                        />
                      </button>
                    </div>
                    {open ? (
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-3.5 pb-3 pl-[2.625rem] text-xs leading-snug">
                        {stockDetail ? (
                          <>
                            <dt className="text-slate-500">Magazyn</dt>
                            <dd className="text-slate-700">{stockDetail}</dd>
                          </>
                        ) : null}
                        {availability.incomingFact ? (
                          <>
                            <dt className="text-slate-500">W drodze</dt>
                            <dd className="text-slate-700">{availability.incomingFact}</dd>
                          </>
                        ) : null}
                        {availability.docs.map((doc) => (
                          <Fragment key={doc.dokNr}>
                            <dt className="font-mono text-slate-500">{doc.dokNr}</dt>
                            <dd className={doc.deadline && doc.deadline < todayKey ? "text-amber-900" : "text-slate-700"}>
                              {doc.deadline
                                ? doc.deadline < todayKey
                                  ? `termin minął ${shortDayLabel(doc.deadline)}`
                                  : `termin ${shortDayLabel(doc.deadline)}`
                                : "bez terminu"}
                              {doc.qty != null ? ` · ${formatPieces(doc.qty)}` : ""}
                            </dd>
                          </Fragment>
                        ))}
                        {availability.otherZkWaiting > 0 ? (
                          <>
                            <dt className="text-slate-500">Inne ZK</dt>
                            <dd className="text-slate-700">czekają na {formatPieces(availability.otherZkWaiting)}</dd>
                          </>
                        ) : null}
                        {availability.requestFact ? (
                          <>
                            <dt className="text-slate-500">Twoja prośba</dt>
                            <dd className="text-slate-700">{availability.requestFact}</dd>
                          </>
                        ) : null}
                        {note ? (
                          <dd
                            className={cn(
                              "col-span-2",
                              // Ostrzeżenie (brak, prośba spoza ZK) bursztynem; informacja o pokryciu Petrolem.
                              !attach && (availability.kind === "need" || (availability.kind === "transit" && availability.note))
                                ? "text-amber-900"
                                : "text-indigo-800"
                            )}
                          >
                            {note}
                          </dd>
                        ) : null}
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {noneMarkedForOrder && !stockLoading ? (
        allLinesHandledWithoutOrder ? (
          <ZkProsbaModalCallout tone="emerald">
            Nic nie trzeba zamawiać - pozycje są na stanie albo podepniemy je pod dostawę w drodze.
          </ZkProsbaModalCallout>
        ) : allLinesSufficient ? (
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
              className="mt-0.5 size-4 shrink-0 rounded-md border-slate-300 text-indigo-700 focus:ring-2 focus:ring-indigo-500/40"
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
