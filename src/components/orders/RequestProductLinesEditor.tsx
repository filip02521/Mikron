"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IndividualRequestKind, DeliveryStats } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  IconChevronDown,
  IconPlusCircle,
  IconTrash2,
} from "@/components/icons/StrokeIcons";
import { SubiektClientNameField } from "@/components/subiekt/SubiektClientNameField";
import { SubiektProductLineFields } from "@/components/subiekt/SubiektProductLineFields";
import { ProsbaProductLineCollapsedRow } from "@/components/orders/ProsbaProductLineCollapsedRow";
import { ProsbaProductLineNoteField } from "@/components/orders/ProsbaProductLineNoteField";
import { ProsbaSupplierLeadTimeMeta } from "@/components/orders/ProsbaSupplierLeadTimeMeta";
import { cn } from "@/lib/cn";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import {
  appendProductLine,
  newProductLine,
  removeProductLineAt,
  updateProductLine,
  type ProductLineDraft,
} from "@/components/orders/request-product-lines";
import {
  canCollapseProsbaLine,
  focusLineIdAfterTeethSave,
  shouldCollapseProsbaLine,
} from "@/lib/orders/prosba-product-line-ui";
import type { TeethDualKindCommitSummary } from "@/lib/teeth/teeth-dual-kind";
import { ProsbaProductStockSummary } from "@/components/orders/ProsbaProductStockStatus";
import { ProsbaZkQuantityHint } from "@/components/orders/ProsbaProductStockStatus";
import { filterProsbaLinesWithSufficientStock, isProsbaLineStockSufficient } from "@/lib/orders/prosba-stock-check";
import { useProsbaLinesStockSync } from "@/hooks/useProsbaLinesStockSync";
import { useProsbaAlreadyOrdered } from "@/hooks/useProsbaAlreadyOrdered";
import {
  ProsbaAvailabilityCard,
  ProsbaNotifySwitchedNote,
} from "@/components/orders/ProsbaAlreadyOrderedHint";
import type { SupplierScheduleSnapshot } from "@/lib/orders/my-order-presenter";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { SupplierOnVacationWindow } from "@/lib/orders/procurement-supplier-vacation";
import {
  buildProsbaSupplierVacationNoticeModel,
  type ProsbaVacationHit,
} from "@/lib/orders/prosba-supplier-vacation-copy";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  buildProsbaAlreadyOrderedView,
  prosbaAlreadyOrderedStockTone,
  prosbaLineRequestedQty,
} from "@/lib/orders/prosba-already-ordered";
import { useTeethExemptTwIds, useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import {
  assessProsbaLineFields,
  assessProsbaLineFieldsLive,
  prosbaLineHasSubmitBlockers,
  shouldShowProsbaLineFieldValidation,
} from "@/lib/orders/prosba-line-field-validation";
import {
  applyInformacjaQuantityClear,
  applyZamowienieQuantityRestore,
  pruneQuantityStash,
  updateStashOnInformacjaEnter,
} from "@/lib/orders/request-kind-quantity";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import { MAX_CLIENT_NAME_LEN } from "@/lib/orders/sales-client-label";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { ProsbaOptionalSection } from "@/components/orders/ProsbaOptionalSection";
import { PROSBA_OPTIONAL_SECTION_COPY } from "@/lib/orders/prosba-optional-section-copy";
import { SubiektOfflineHint } from "@/components/subiekt/SubiektOfflineHint";
import { SubiektOfflineNotice } from "@/components/subiekt/SubiektOfflineNotice";
import { subiektOfflineDisplay } from "@/lib/orders/consolidate-form-status";
import {
  copyProsbaLineNoteToAllLines,
} from "@/lib/orders/prosba-line-note-copy";
import {
  TeethProgressBadge,
  useTeethLinesStatus,
} from "@/components/teeth/TeethWizardProgress";
import type { TeethLineDetail } from "@/lib/teeth/teeth-catalog";

export function RequestProductLinesEditor({
  lines,
  onChange,
  requestKind,
  minLines = 1,
  addLabel = "Dodaj pozycję",
  showClientField = false,
  appearance = "default",
  suppliers,
  onSupplierResolved,
  onSupplierResolveFeedback,
  onSupplierMappingMissing,
  unifiedFeedback = false,
  onProductFeedbackChange,
  onConfigFeedbackChange,
  onResolvingSupplierChange,
  deferSupplierResolve = false,
  validationAttempted = false,
  liveValidation = false,
  showLineNotes,
  noteAudience = "sales",
  salesProsbaForm = false,
  typeaheadSize = "default",
  onAfterTeethListSave,
  onTeethListCommitNotice,
  onTeethDualKindCommit,
  autoOpenTeethList = false,
  allowedTwIds,
  allowedTwIdsHint,
  lockSubiektLink = false,
  groupSupplierId,
  formSuppliers,
  statsBySupplierId,
  etaUseP50 = false,
  etaQuantilesBySupplierId = {},
  showLinkedLeadTime = false,
  linkedLeadTimeOmitSupplierIds,
  alreadyOrderedCheck = false,
  alreadyOrderedForSalesPersonId = null,
  alreadyOrderedForOther = false,
  onRequestKindChange,
  supplierScheduleById = {},
  plannedOrderWeekDays = [],
  suppliersOnVacationNow = {},
  showLineSupplierTiming = false,
}: {
  lines: ProductLineDraft[];
  onChange: (lines: ProductLineDraft[]) => void;
  requestKind: IndividualRequestKind;
  minLines?: number;
  addLabel?: string;
  showClientField?: boolean;
  /** Układ handlowca (/prosba) — zwijanie linii, checklista; używany też w modalach panelu dziennego. */
  appearance?: "default" | "prosba";
  suppliers?: AppSupplierRef[];
  /** `lineId` — id pozycji, której dotyczy dopasowanie dostawcy. */
  onSupplierResolved?: (
    result: {
      supplierId: string;
      supplierName: string;
      documentNumber: string | null;
    },
    lineId: string
  ) => void;
  onSupplierResolveFeedback?: (feedback: SubiektFeedback | null) => void;
  onSupplierMappingMissing?: (lineId: string) => void;
  unifiedFeedback?: boolean;
  onProductFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onConfigFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onResolvingSupplierChange?: (resolving: boolean) => void;
  deferSupplierResolve?: boolean;
  /** Po nieudanej próbie wysyłania — podświetlenie braków we wszystkich pozycjach. */
  validationAttempted?: boolean;
  /** Walidacja na żywo — pola z brakami bez czekania na klik „Wyślij”. */
  liveValidation?: boolean;
  /** Notatka per pozycja (panel dzienny) — domyślnie przy `appearance=prosba`. */
  showLineNotes?: boolean;
  /** Podpowiedź przy notatce — zakupy vs handlowiec. */
  noteAudience?: "sales" | "procurement";
  /** Formularz handlowca /prosba — teksty o Subiekcie pisane dla handlowca. */
  salesProsbaForm?: boolean;
  /** Wyższa lista podpowiedzi Subiekta / dostawcy w modalach. */
  typeaheadSize?: "default" | "comfortable";
  onAfterTeethListSave?: (
    lineIndex: number,
    teethDetails: TeethLineDetail[],
    totalQuantity: number,
    saveResult?: import("@/components/teeth/TeethOrderBuilderModal").TeethOrderBuilderSaveResult,
  ) => void;
  onTeethListCommitNotice?: (
    message: string | { title: string; text: string },
    tone?: "success" | "error",
  ) => void;
  onTeethDualKindCommit?: (payload: {
    lineIndex: number;
    lines: ProductLineDraft[];
    summary: import("@/lib/teeth/teeth-dual-kind").TeethDualKindCommitSummary;
    focusLineId: string | null;
  }) => void;
  /** Otwiera modal listy zębów dla pierwszej linii (panel zakupów). */
  autoOpenTeethList?: boolean;
  /** Ogranicza typeahead do podanych tw_Id. */
  allowedTwIds?: ReadonlySet<number>;
  allowedTwIdsHint?: string;
  lockSubiektLink?: boolean;
  /** Dostawca z nagłówka grupy — do dopasowania braków przy liście zębów. */
  groupSupplierId?: string | null;
  /** Pełna lista dostawców z stats_mode — meta czasu dostawy pod powiązaniem produktu. */
  formSuppliers?: OrderFormSupplierOption[];
  statsBySupplierId?: Record<string, DeliveryStats>;
  etaUseP50?: boolean;
  etaQuantilesBySupplierId?: Record<
    string,
    import("@/lib/orders/delivery-eta-quantiles-load").DeliveryEtaSupplierQuantiles
  >;
  /** Meta dostawy pod „Powiązano z Subiektem” / „Z bazy” (tylko zamowienie). */
  showLinkedLeadTime?: boolean;
  /** Nie powtarzaj mety dla tych dostawców (np. już w banerze harmonogramu). */
  linkedLeadTimeOmitSupplierIds?: readonly string[];
  /**
   * Nowa prośba: sprawdza w tle, czy towar jest już zamówiony / ktoś już o niego prosi.
   * Wyłączone w edycji istniejącej prośby (znalazłaby samą siebie).
   */
  alreadyOrderedCheck?: boolean;
  /** Handlowiec, dla którego jest prośba — „ma już prośbę” liczone względem niego. */
  alreadyOrderedForSalesPersonId?: string | null;
  /** Prośba w imieniu innego handlowca — teksty bez „Twoja”. */
  alreadyOrderedForOther?: boolean;
  /** Harmonogram dostawców — Planowe zamówienie przy pozycji (nie całej prośbie). */
  supplierScheduleById?: Record<string, SupplierScheduleSnapshot>;
  plannedOrderWeekDays?: WeekDayPlan[];
  suppliersOnVacationNow?: Record<string, SupplierOnVacationWindow>;
  /** Sales `/prosba`: meta dostawcy per linia (po resolucji Subiekta). */
  showLineSupplierTiming?: boolean;
  /**
   * „Tylko powiadom, gdy dotrze” / „Cofnij” — zmiana rodzaju całej prośby
   * (informacja ↔ zamówienie). Formularz ustawia ścieżkę „Powiadom, gdy będzie na magazynie”.
   */
  onRequestKindChange?: (kind: IndividualRequestKind) => void;
}) {
  const canRemove = lines.length > minLines;
  const prosba = appearance === "prosba";

  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  const lineNotes = showLineNotes ?? prosba;
  const copyNoteLines = prosba ? copyProsbaLineNoteToAllLines(lines) : null;
  const showLineLabel = !prosba || lines.length > 1;
  // Zawsze karta wokół pozycji — spójne zwinięcie/rozwinięcie także przy 1 linii.
  const wrapLine = true;

  const teethExemptTwIds = useTeethExemptTwIds();
  const { catalogAvailable: teethCatalogAvailable } = useTeethProductInfo();
  const collapseOptions = useMemo(
    () => ({
      exemptTwIds: teethExemptTwIds,
      catalogAvailable: teethCatalogAvailable,
    }),
    [teethExemptTwIds, teethCatalogAvailable],
  );
  const [focusedLineId, setFocusedLineId] = useState<string | null>(
    () => lines[lines.length - 1]?.id ?? null,
  );
  const activeLineId =
    focusedLineId != null && lines.some((line) => line.id === focusedLineId)
      ? focusedLineId
      : focusedLineId === null
        ? ""
        : (lines[lines.length - 1]?.id ?? "");
  const prevLineIdsRef = useRef<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!prosba) return;
    const currentIds = new Set(lines.map((l) => l.id));
    const prevIds = prevLineIdsRef.current;
    const sameIds =
      prevIds != null &&
      prevIds.size === currentIds.size &&
      [...currentIds].every((id) => prevIds.has(id));
    if (sameIds) return;
    prevLineIdsRef.current = currentIds;
    if (prevIds === null) return;
    const allCollapsible = lines.every((l) =>
      canCollapseProsbaLine(l, requestKind, collapseOptions),
    );
    const allNew = lines.every((l) => !prevIds.has(l.id));
    if (allNew && allCollapsible) {
      setFocusedLineId(null);
    }
  }, [lines, prosba, requestKind, collapseOptions]);
  const [subiektOfflineFeedback, setSubiektOfflineFeedback] =
    useState<SubiektFeedback | null>(null);
  const subiektOfflineMode = subiektOfflineDisplay({
    feedback: subiektOfflineFeedback,
    prosba,
    salesProsbaForm,
    allLinesLinked: lines.every((l) => (l.subiektTwId ?? 0) > 0),
  });
  const stockChecksEnabled = requestKind === "zamowienie";
  const sufficientStockCount = stockChecksEnabled
    ? filterProsbaLinesWithSufficientStock(lines, requestKind, teethExemptTwIds).length
    : 0;

  useProsbaLinesStockSync(lines, onChange, requestKind, stockChecksEnabled, teethExemptTwIds);
  const { map: alreadyOrdered, checkingTwIds: alreadyOrderedChecking } = useProsbaAlreadyOrdered(
    lines,
    requestKind,
    prosba && Boolean(alreadyOrderedCheck),
    alreadyOrderedForSalesPersonId
  );
  /** Pozycja, z której przełączono na powiadomienie — tam pokazujemy potwierdzenie z „Cofnij”. */
  const [notifySwitchLineId, setNotifySwitchLineId] = useState<string | null>(null);
  // Powrót do zamówienia innym sposobem niż „Cofnij” (1, przełącznik) zamyka notkę — inaczej
  // wróciłaby przy kolejnym „2” i zabrała fokus.
  const [notifyKindSeen, setNotifyKindSeen] = useState(requestKind);
  if (notifyKindSeen !== requestKind) {
    setNotifyKindSeen(requestKind);
    if (requestKind !== "informacja") setNotifySwitchLineId(null);
  }
  const [refocusNotifyLineId, setRefocusNotifyLineId] = useState<string | null>(null);
  const alreadyOrderedBadge = (line: ProductLineDraft) => {
    const twId = line.subiektTwId;
    const view =
      twId != null
        ? buildProsbaAlreadyOrderedView(alreadyOrdered[twId], {
            forOther: alreadyOrderedForOther,
            requestedQty: prosbaLineRequestedQty(line),
            ownZkQty: line.zkQuantity ?? null,
          })
        : null;
    if (!view) return null;
    // Jak karta: wystarczający stan z półki wygrywa z dostawą (poza własnym dublem).
    if (view.tone !== "mine" && isProsbaLineStockSufficient(line, requestKind, teethExemptTwIds)) return null;
    return { badge: view.badge, tone: prosbaAlreadyOrderedStockTone(view.tone) };
  };

  useEffect(() => {
    if (!prosba) return;
    void (async () => {
      const { actionSubiektSuggestionsEnabled } = await import("@/app/actions/subiekt");
      const r = await actionSubiektSuggestionsEnabled();
      setSubiektOfflineFeedback(r.enabled ? null : (r.feedback ?? null));
    })();
  }, [prosba]);

  const validationFocusKey =
    validationAttempted && prosba
      ? `${requestKind}\0${lines.map((line) => line.id).join("\0")}`
      : "";
  const [appliedValidationFocusKey, setAppliedValidationFocusKey] = useState("");
  if (validationFocusKey && validationFocusKey !== appliedValidationFocusKey) {
    const idx = lines.findIndex((line) =>
      prosbaLineHasSubmitBlockers(line, requestKind, {
        exemptTwIds: teethExemptTwIds,
      }),
    );
    if (idx >= 0) {
      setAppliedValidationFocusKey(validationFocusKey);
      setFocusedLineId(lines[idx]!.id);
    }
  }

  const quantityStashRef = useRef<Record<string, string>>({});
  const prevRequestKindRef = useRef<IndividualRequestKind>(requestKind);

  useEffect(() => {
    const prevKind = prevRequestKindRef.current;
    const lineIds = lines.map((l) => l.id);
    quantityStashRef.current = pruneQuantityStash(quantityStashRef.current, lineIds);

    if (prevKind !== requestKind) {
      prevRequestKindRef.current = requestKind;

      if (requestKind === "informacja" && prevKind === "zamowienie") {
        quantityStashRef.current = updateStashOnInformacjaEnter(
          quantityStashRef.current,
          lines
        );
        const cleared = applyInformacjaQuantityClear(lines);
        if (cleared) onChange(cleared);
        return;
      }

      if (requestKind === "zamowienie" && prevKind === "informacja") {
        const restored = applyZamowienieQuantityRestore(lines, quantityStashRef.current);
        if (restored) onChange(restored);
        return;
      }
    }

    // Ten sam rodzaj: utrzymuj regułę „informacja bez ilości” (np. po picku produktu).
    if (requestKind === "informacja") {
      const cleared = applyInformacjaQuantityClear(lines);
      if (cleared) onChange(cleared);
    }
  }, [requestKind, lines, onChange]);

  const addLine = () => {
    const next = appendProductLine(lines);
    onChange(next);
    setFocusedLineId(next[next.length - 1]!.id);
  };

  const removeLine = (index: number) => {
    const removedId = lines[index]?.id;
    const next = removeProductLineAt(lines, index, minLines);
    onChange(next);
    if (removedId === activeLineId || removedId === focusedLineId) {
      const remainingAllCollapsible =
        next.length > 0 &&
        next.every((l) => canCollapseProsbaLine(l, requestKind, collapseOptions));
      setFocusedLineId(
        remainingAllCollapsible ? null : (next[next.length - 1]?.id ?? null),
      );
    }
  };

  type Segment =
    | { kind: "collapsed"; indexes: number[] }
    | { kind: "expanded"; index: number };

  const segments: Segment[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const collapsed =
      prosba &&
      shouldCollapseProsbaLine(line, requestKind, lines.length, activeLineId, collapseOptions);
    if (collapsed) {
      const last = segments[segments.length - 1];
      if (last?.kind === "collapsed") {
        last.indexes.push(index);
      } else {
        segments.push({ kind: "collapsed", indexes: [index] });
      }
    } else {
      segments.push({ kind: "expanded", index });
    }
  }

  return (
    <div className="space-y-3">
      {subiektOfflineFeedback && subiektOfflineMode === "notice" ? (
        <SubiektOfflineNotice feedback={subiektOfflineFeedback} />
      ) : null}
      {subiektOfflineFeedback && subiektOfflineMode === "badge" ? (
        <div className="flex justify-end">
          <SubiektOfflineHint feedback={subiektOfflineFeedback} />
        </div>
      ) : null}

      {prosba && requestKind === "zamowienie" ? (
        <TeethProgressLine lines={lines} />
      ) : null}

      {/* Karta „Dostępność” przy każdej pozycji mówi to samo — bez zbiorczego powtórzenia. */}
      {sufficientStockCount > 1 && !alreadyOrderedCheck ? (
        <ProsbaProductStockSummary count={sufficientStockCount} />
      ) : null}

      {segments.map((segment) => {
        if (segment.kind === "collapsed") {
          return (
            <div
              key={segment.indexes.map((i) => lines[i]!.id).join("|")}
              className="space-y-2"
            >
              {segment.indexes.map((index) => {
                const line = lines[index]!;
                return (
                  <div
                    key={line.id}
                    className="overflow-hidden rounded-md border border-slate-200 bg-card shadow-sm"
                  >
                    <ProsbaProductLineCollapsedRow
                      index={index}
                      line={line}
                      requestKind={requestKind}
                      canRemove={canRemove}
                      hasFieldIssues={
                        (validationAttempted || liveValidation) &&
                        prosbaLineHasSubmitBlockers(line, requestKind, {
                          exemptTwIds: teethExemptTwIds,
                        })
                      }
                      alreadyOrdered={alreadyOrderedBadge(line)}
                      onEdit={() => setFocusedLineId(line.id)}
                      onRemove={() => removeLine(index)}
                    />
                  </div>
                );
              })}
            </div>
          );
        }

        const index = segment.index;
        const line = lines[index]!;
        const isActive = line.id === activeLineId;
        const showFieldValidation =
          prosba &&
          shouldShowProsbaLineFieldValidation(line, {
            active: isActive,
            validationAttempted,
            liveValidation,
            lineCount: lines.length,
            requestKind,
          });
        const fieldValidation = !showFieldValidation
          ? undefined
          : salesProsbaForm
            ? assessProsbaLineFieldsLive(line, requestKind, validationAttempted)
            : assessProsbaLineFields(line, requestKind, validationAttempted ? "strict" : "soft");

        const lineSupplierId =
          (
            line as ProductLineDraft & {
              supplierId?: string;
            }
          ).supplierId?.trim() ||
          groupSupplierId?.trim() ||
          "";
        const omitLeadTime =
          Boolean(lineSupplierId) &&
          (linkedLeadTimeOmitSupplierIds?.includes(lineSupplierId) ?? false);
        const linkedLeadTime =
          showLinkedLeadTime &&
          requestKind === "zamowienie" &&
          formSuppliers &&
          statsBySupplierId &&
          lineSupplierId &&
          !omitLeadTime ? (
            <ProsbaSupplierLeadTimeMeta
              variant="underLink"
              supplierIds={[lineSupplierId]}
              suppliers={formSuppliers}
              statsBySupplierId={statsBySupplierId}
              etaUseP50={etaUseP50}
              etaQuantilesBySupplierId={etaQuantilesBySupplierId}
            />
          ) : null;

        const canCollapseActive =
          prosba && canCollapseProsbaLine(line, requestKind, collapseOptions);

        return (
          <div
            key={line.id}
            className={cn(
              wrapLine
                ? prosba
                  ? cn(
                      "relative overflow-hidden rounded-lg border bg-card",
                      isActive
                        ? "border-indigo-300 shadow-sm ring-1 ring-indigo-200/70"
                        : "border-slate-200/90"
                    )
                  : "rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-3"
                : "space-y-3"
            )}
          >
            <div className={cn(prosba && wrapLine && "p-3 sm:p-3.5")}>
            {/* Numer w przepływie, nie na sztywno: przy sm:p-3.5 pozycja absolutna wchodziła pod etykietę pola. */}
            {prosba && showLineLabel ? (
              <p className="mb-1.5 text-[0.6875rem] font-semibold tabular-nums text-slate-500">
                Pozycja {index + 1}
              </p>
            ) : null}
            <SubiektProductLineFields
              appearance={appearance}
              salesProsbaForm={salesProsbaForm}
              compactControls={prosba}
              requestKind={requestKind}
              productFieldClassName={prosba ? undefined : "sm:col-span-2"}
              suppliers={suppliers}
              onSupplierResolved={
                onSupplierResolved
                  ? (result) => {
                      if (deferSupplierResolve) {
                        onChange(
                          linesRef.current.map((line, i) =>
                            i === index
                              ? { ...line, supplierId: result.supplierId }
                              : line
                          )
                        );
                      }
                      onSupplierResolved(result, line.id);
                    }
                  : undefined
              }
              onSupplierResolveFeedback={onSupplierResolveFeedback}
              onSupplierMappingMissing={
                onSupplierMappingMissing
                  ? () => onSupplierMappingMissing(line.id)
                  : undefined
              }
              delegateAlerts={unifiedFeedback}
              onProductFeedbackChange={
                isActive ? onProductFeedbackChange : undefined
              }
              onConfigFeedbackChange={index === 0 ? onConfigFeedbackChange : undefined}
              onResolvingSupplierChange={
                isActive ? onResolvingSupplierChange : undefined
              }
              deferSupplierResolve={deferSupplierResolve}
              typeaheadSize={typeaheadSize}
              fieldValidation={fieldValidation}
              lineIndex={index}
              allLines={lines}
              value={{
                symbol: line.symbol,
                mikranCode: line.mikranCode,
                product: line.product,
                quantity: line.quantity,
                subiektTwId: line.subiektTwId,
                onHand: line.onHand,
                reserved: line.reserved,
                available: line.available,
                stockSource: line.stockSource,
                source: line.source,
                teethManufacturer: line.teethManufacturer,
                teethProductLine: line.teethProductLine,
                teethKind: line.teethKind,
                teethDetails: line.teethDetails,
                teethOcrPending: line.teethOcrPending,
                teethOcrImagePath: line.teethOcrImagePath,
              }}
              onChange={(patch) => {
                const next = updateProductLine(lines, index, patch);
                linesRef.current = next;
                onChange(next);
              }}
              onTeethDualKindCommit={(payload) => {
                onChange(payload.lines);
                setFocusedLineId(
                  focusLineIdAfterTeethSave(
                    payload.lines,
                    collectDualTeethCommitLineIds(
                      payload.lines,
                      payload.summary,
                      payload.lineIndex,
                    ),
                    requestKind,
                    collapseOptions,
                  ),
                );
                onTeethDualKindCommit?.(payload);
              }}
              onTeethListCommitNotice={onTeethListCommitNotice}
              onAfterTeethListSave={(teethDetails, totalQuantity, saveResult) => {
                if (saveResult?.mode !== "dual") {
                  const lineId = lines[index]!.id;
                  const nextLines = updateProductLine(lines, index, {
                    teethDetails,
                    quantity: String(totalQuantity),
                    teethOcrPending: saveResult?.fromOcr ?? false,
                    teethOcrImagePath: saveResult?.ocrImagePath ?? null,
                  });
                  setFocusedLineId(
                    focusLineIdAfterTeethSave(
                      nextLines,
                      [lineId],
                      requestKind,
                      collapseOptions,
                    ),
                  );
                }
                onAfterTeethListSave?.(index, teethDetails, totalQuantity, saveResult);
              }}
              autoOpenTeethList={autoOpenTeethList && index === 0}
              allowedTwIds={allowedTwIds}
              allowedTwIdsHint={allowedTwIdsHint}
              lockSubiektLink={lockSubiektLink}
              groupSupplierId={groupSupplierId}
              linkedLeadTime={linkedLeadTime}
              hideStockStatus={prosba && alreadyOrderedCheck}
              autoFocusProduct={Boolean(salesProsbaForm) && index === 0 && lines.length === 1}
            />

            {prosba ? (
              <ProsbaZkQuantityHint line={line} requestKind={requestKind} className="mt-2" />
            ) : null}

            {prosba &&
            alreadyOrderedCheck &&
            onRequestKindChange &&
            requestKind === "informacja" &&
            notifySwitchLineId === line.id ? (
              <ProsbaNotifySwitchedNote
                onUndo={() => {
                  setNotifySwitchLineId(null);
                  setRefocusNotifyLineId(line.id);
                  onRequestKindChange("zamowienie");
                }}
                className="mt-2"
              />
            ) : null}

            {prosba &&
            ((alreadyOrderedCheck && line.subiektTwId != null) ||
              (showLineSupplierTiming && Boolean(line.supplierId?.trim()))) ? (
              <ProsbaAvailabilityCard
                line={line}
                requestKind={requestKind}
                info={
                  line.subiektTwId != null
                    ? alreadyOrdered[line.subiektTwId]
                    : undefined
                }
                checking={
                  line.subiektTwId != null &&
                  alreadyOrderedChecking.has(line.subiektTwId)
                }
                onSwitchToNotify={
                  alreadyOrderedCheck &&
                  lines.length === 1 &&
                  onRequestKindChange
                    ? () => {
                        setNotifySwitchLineId(line.id);
                        onRequestKindChange("informacja");
                      }
                    : undefined
                }
                onRemoveLine={
                  alreadyOrderedCheck && canRemove
                    ? () => removeLine(index)
                    : undefined
                }
                forOther={alreadyOrderedForOther}
                focusNotifyOnMount={refocusNotifyLineId === line.id}
                onNotifyFocused={() => setRefocusNotifyLineId(null)}
                supplierTiming={
                  showLineSupplierTiming && line.supplierId?.trim()
                    ? {
                        supplierId: line.supplierId,
                        suppliers: formSuppliers ?? [],
                        supplierScheduleById,
                        plannedOrderWeekDays,
                        todayDateKey: formatDateString(todayInWarsaw()),
                        statsBySupplierId: statsBySupplierId ?? {},
                        etaUseP50,
                        etaQuantilesBySupplierId,
                        showLeadTime: requestKind === "zamowienie",
                        vacationNoticeModel: (() => {
                          const id = line.supplierId!.trim();
                          const window = suppliersOnVacationNow[id];
                          if (!window) return null;
                          const hit: ProsbaVacationHit = {
                            supplierId: id,
                            supplierName:
                              formSuppliers?.find((s) => s.id === id)?.name?.trim() ||
                              id,
                            window,
                          };
                          return buildProsbaSupplierVacationNoticeModel([hit]);
                        })(),
                      }
                    : null
                }
                className="mt-2"
              />
            ) : null}

            {showClientField ? (
              prosba ? (
                <ProsbaOptionalSection
                  kind="client"
                  title={PROSBA_OPTIONAL_SECTION_COPY.client.title}
                  description={PROSBA_OPTIONAL_SECTION_COPY.client.description}
                  defaultOpen={Boolean(line.clientName?.trim() || line.clientKhId)}
                  teaser={line.clientName?.trim() || null}
                  className="mt-2"
                >
                  <SubiektClientNameField
                    prosba={salesProsbaForm}
                    maxLength={MAX_CLIENT_NAME_LEN}
                    value={line.clientName ?? ""}
                    clientKhId={line.clientKhId ?? null}
                    onChange={({ clientName, clientKhId }) =>
                      onChange(updateProductLine(lines, index, { clientName, clientKhId }))
                    }
                  />
                </ProsbaOptionalSection>
              ) : (
                <Field label="Klient (opcjonalnie)" className={wrapLine ? "mt-2" : undefined}>
                  <SubiektClientNameField
                    maxLength={MAX_CLIENT_NAME_LEN}
                    value={line.clientName ?? ""}
                    clientKhId={line.clientKhId ?? null}
                    onChange={({ clientName, clientKhId }) =>
                      onChange(updateProductLine(lines, index, { clientName, clientKhId }))
                    }
                  />
                </Field>
              )
            ) : null}

            {lineNotes ? (
              <ProsbaProductLineNoteField
                value={line.requestNote ?? ""}
                onChange={(requestNote) =>
                  onChange(updateProductLine(lines, index, { requestNote }))
                }
                audience={noteAudience}
                className={showClientField || wrapLine ? "mt-2" : undefined}
              />
            ) : null}

            {!prosba && canRemove ? (
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-9 text-red-700 hover:bg-red-50"
                  onClick={() => removeLine(index)}
                >
                  Usuń
                </Button>
              </div>
            ) : null}
            </div>

            {/* Uchwyt zwijania — na dole karty, zero rzędu nad inputami. */}
            {prosba && wrapLine && (canCollapseActive || canRemove) ? (
              <div className="flex items-stretch border-t border-slate-200/80 bg-slate-50/80">
                {canRemove ? (
                  <button
                    type="button"
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 active:scale-[0.98]"
                    onClick={() => removeLine(index)}
                    aria-label="Usuń pozycję"
                  >
                    <IconTrash2 size={14} className="shrink-0" />
                    Usuń
                  </button>
                ) : null}
                {canCollapseActive ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 transition-colors",
                      "hover:bg-slate-100/90 hover:text-slate-900 active:scale-[0.99]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600"
                    )}
                    onClick={() => setFocusedLineId(null)}
                    aria-label="Zwiń pozycję"
                  >
                    <IconChevronDown open size={15} className="text-slate-500" />
                    Zwiń
                  </button>
                ) : (
                  <span className="flex-1" aria-hidden />
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {copyNoteLines ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-1 text-xs font-medium text-indigo-700 hover:bg-transparent hover:text-indigo-900"
          onClick={() => onChange(copyNoteLines)}
        >
          {PROSBA_OPTIONAL_SECTION_COPY.lineNote.copyToAllLines}
        </Button>
      ) : null}

      <Button
        type="button"
        variant={prosba ? "outline" : "ghost"}
        size="md"
        className={cn(
          prosba && "w-full border-dashed",
        )}
        disabled={lines.length >= MAX_BATCH_ORDER_LINES}
        onClick={addLine}
      >
        <IconPlusCircle size={18} className="shrink-0" />
        {prosba ? "Dodaj kolejny produkt" : addLabel}
        {lines.length >= MAX_BATCH_ORDER_LINES
          ? ` (maks. ${MAX_BATCH_ORDER_LINES})`
          : ""}
      </Button>
    </div>
  );
}

function TeethProgressLine({ lines }: { lines: ProductLineDraft[] }) {
  const { completedCount, totalCount } = useTeethLinesStatus(lines);
  if (totalCount < 2 || completedCount === totalCount) return null;
  return <TeethProgressBadge incompleteCount={totalCount - completedCount} />;
}

function collectDualTeethCommitLineIds(
  lines: ProductLineDraft[],
  summary: TeethDualKindCommitSummary,
  anchorIndex: number,
): string[] {
  const anchor = lines[anchorIndex];
  const productLine = anchor?.teethProductLine;
  const clientName = anchor?.clientName ?? "";
  if (!productLine) return [];

  const kinds = new Set(
    [...summary.added, ...summary.updated].map((item) => item.kind),
  );
  if (kinds.size === 0) return [];

  return lines
    .filter(
      (line) =>
        line.teethProductLine === productLine
        && (line.clientName ?? "") === clientName
        && line.teethKind != null
        && kinds.has(line.teethKind)
        && (line.teethDetails?.length ?? 0) > 0,
    )
    .map((line) => line.id);
}

export function initialProductLines(count = 1): ProductLineDraft[] {
  return Array.from({ length: count }, () => newProductLine());
}
