"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import { actionSuggestProducts } from "@/app/actions/subiekt";
import type { IndividualRequestKind } from "@/types/database";
import { Field, Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import {
  TYPEAHEAD_KEYBOARD_HINT,
  TypeaheadDropdown,
  TypeaheadOption,
  TypeaheadSectionLabel,
} from "@/components/ui/TypeaheadDropdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { getSubiektFeedback } from "@/lib/subiekt/feedback";
import {
  buildProductPickFromSubiekt,
  combinedProductSearchDisplay,
  combinedProductSymbolPreview,
  formatSubiektProductOption,
  inferCombinedProductSearchField,
  minProductSearchLength,
  patchFromCombinedProductInput,
  productSuggestSearchField,
  type ProductSearchField,
} from "@/lib/subiekt/product-pick";
import {
  mergeCombinedProductFieldProps,
  mikranFieldProps,
  quantityFieldProps,
} from "@/lib/subiekt/subiekt-product-line-field-props";
import { cn } from "@/lib/cn";
import {
  ProsbaLineFieldMessages,
  type ProsbaLineMessageItem,
} from "@/components/orders/ProsbaLineFieldMessages";
import { ProsbaProductStockStatus, ProsbaTeethExemptHint } from "@/components/orders/ProsbaProductStockStatus";
import type { ProsbaLineFieldMap } from "@/lib/orders/prosba-line-field-validation";
import {
  MAX_MIKRAN_CODE_LEN,
  MAX_PRODUCT_TEXT_LEN,
  MAX_QUANTITY_LEN,
} from "@/lib/security/text-limits";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import type { SubiektProduct } from "@/lib/subiekt/types";
import {
  mergeStockIntoLinePatch,
  stockSnapshotFromSubiektProduct,
} from "@/lib/orders/prosba-stock-check";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { useTeethProductInfo, useSupportsDualKindBuilder } from "@/components/layout/TeethExemptContext";
import { TeethOrderBuilderCard } from "@/components/teeth/TeethOrderBuilderCard";
import { teethProsbaQuantityInputClass } from "@/lib/teeth/teeth-prosba-ui";
import {
  authoritativeTeethProductLine,
  manufacturerForProductLine,
  resolveTeethCatalogFromDraft,
  shouldClearTeethDetailsOnCatalogSync,
  type TeethLineDetail,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import {
  TeethOrderBuilderModal,
  buildDualKindInitialDetails,
  type TeethOrderBuilderSaveResult,
} from "@/components/teeth/TeethOrderBuilderModal";
import {
  commitDualKindTeethLines,
  findTeethSiblingLineIndex,
  type TeethDualKindCommitSummary,
} from "@/lib/teeth/teeth-dual-kind";
import { teethDualCommitToastMessage } from "@/lib/teeth/teeth-builder-copy";

export type SubiektProductLineValue = Pick<
  ProductLineDraft,
  | "symbol"
  | "mikranCode"
  | "product"
  | "quantity"
  | "subiektTwId"
  | "onHand"
  | "reserved"
  | "available"
  | "stockSource"
  | "source"
  | "teethManufacturer"
  | "teethProductLine"
  | "teethKind"
  | "teethDetails"
  | "teethOcrPending"
  | "teethOcrImagePath"
>;

type ActiveField = Exclude<ProductSearchField, "combined">;

function inputLoadingPadding(loading: boolean): string {
  return loading ? "pr-10" : "";
}

type FieldVisualProps = {
  state?: "default" | "warning" | "error" | "success";
  error?: string;
  hint?: string;
};

/** Po picku z Subiekta — jeden komunikat zamiast haczyków w każdym polu. */
function withoutSuccessWhenLinked(props: FieldVisualProps, linked: boolean): FieldVisualProps {
  if (!linked || props.state !== "success") return props;
  const { state: _omitState, error, ...rest } = props;
  void _omitState;
  return error ? { error, ...rest } : rest;
}

function SubiektInputLoadingSpinner({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <span className="pointer-events-none absolute right-2.5 top-1/2 z-[1] -translate-y-1/2">
      <Spinner size="sm" />
    </span>
  );
}

function SubiektInputShell({
  children,
  loading,
}: {
  children: React.ReactNode;
  loading: boolean;
}) {
  return (
    <div className="relative w-full">
      {children}
      <SubiektInputLoadingSpinner loading={loading} />
    </div>
  );
}

function SubiektLinkedLineBanner({
  symbol,
  fromCatalog,
}: {
  symbol: string | null;
  mikranCode: string;
  fromCatalog?: boolean;
}) {
  const title = fromCatalog ? "Z bazy" : "Powiązano z Subiektem";

  return (
    <div
      role="status"
      aria-label={title}
      className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"
    >
      <IconCircleCheck size={14} strokeWidth={2.5} className="shrink-0 text-emerald-600" aria-hidden />
      <span className="font-semibold">{title}</span>
      {symbol?.trim() ? (
        <span className="text-emerald-600/90">· {symbol.trim()}</span>
      ) : null}
    </div>
  );
}

function activeFieldQuery(value: SubiektProductLineValue, field: ActiveField): string {
  if (field === "plu") return value.mikranCode;
  return combinedProductSearchDisplay(value);
}

function typeaheadSectionLabel(field: ActiveField): string {
  if (field === "plu") return "po kodzie Mikran";
  return "po symbolu i nazwie";
}

function subiektFieldLabel(field: ActiveField): string {
  if (field === "plu") return "Kod mikran";
  if (field === "name") return "Produkt";
  return "Symbol";
}

export function SubiektProductLineFields({
  value,
  onChange,
  requestKind,
  disabled,
  appearance = "default",
  productFieldClassName,
  suppliers,
  onSupplierResolved,
  onSupplierResolveFeedback,
  onSupplierMappingMissing,
  delegateAlerts = false,
  onProductFeedbackChange,
  onConfigFeedbackChange,
  onResolvingSupplierChange,
  deferSupplierResolve = false,
  compactControls = false,
  fieldValidation,
  typeaheadSize = "default",
  lineIndex = 0,
  allLines,
  onAfterTeethListSave,
  onTeethDualKindCommit,
  onTeethListCommitNotice,
  autoOpenTeethList = false,
}: {
  value: SubiektProductLineValue;
  onChange: (patch: Partial<SubiektProductLineValue>) => void;
  requestKind: IndividualRequestKind;
  disabled?: boolean;
  appearance?: "default" | "prosba";
  productFieldClassName?: string;
  suppliers?: AppSupplierRef[];
  onSupplierResolved?: (result: {
    supplierId: string;
    supplierName: string;
    documentNumber: string | null;
  }) => void;
  onSupplierResolveFeedback?: (feedback: SubiektFeedback | null) => void;
  /** Gdy po wyborze z Subiekta nie ma dostawcy w bazie — np. wyczyść pole dostawcy w formularzu zakupów. */
  onSupplierMappingMissing?: () => void;
  delegateAlerts?: boolean;
  onProductFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onConfigFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onResolvingSupplierChange?: (resolving: boolean) => void;
  deferSupplierResolve?: boolean;
  /** Mniejsze pola — panel weryfikacji / wąska kolumna. */
  compactControls?: boolean;
  /** Stany pól (prośba handlowca). */
  fieldValidation?: ProsbaLineFieldMap;
  lineIndex?: number;
  allLines?: ProductLineDraft[];
  typeaheadSize?: "default" | "comfortable";
  onAfterTeethListSave?: (
    teethDetails: TeethLineDetail[],
    totalQuantity: number,
    saveResult?: TeethOrderBuilderSaveResult,
  ) => void;
  onTeethDualKindCommit?: (payload: {
    lineIndex: number;
    lines: ProductLineDraft[];
    summary: TeethDualKindCommitSummary;
    focusLineId: string | null;
  }) => void;
  onTeethListCommitNotice?: (
    message: string | { title: string; text: string },
    tone?: "success" | "error",
  ) => void;
  /** Otwiera modal listy zębów po wejściu w edycję (panel zakupów). */
  autoOpenTeethList?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const searchGenerationRef = useRef(0);
  const typeaheadInstanceId = useId();
  const [enabled, setEnabled] = useState(false);
  const [catalogFallback, setCatalogFallback] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [configFeedback, setConfigFeedback] = useState<SubiektFeedback | null>(null);
  const [activeField, setActiveField] = useState<ActiveField>("name");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SubiektProduct[]>([]);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [supplierFeedback, setSupplierFeedback] = useState<SubiektFeedback | null>(
    null
  );
  const [resolvingSupplier, setResolvingSupplier] = useState(false);
  const pendingTeethModalRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const teethProductInfo = useTeethProductInfo();

  const prosba = appearance === "prosba";
  const linkedTeethTwId =
    value.subiektTwId != null && value.subiektTwId > 0 ? Math.trunc(value.subiektTwId) : null;
  const adminProductLine = linkedTeethTwId != null
    ? (teethProductInfo.productLineByTwId.get(linkedTeethTwId) ?? null)
    : null;
  const isRegistryTeethTw =
    linkedTeethTwId != null && teethProductInfo.twIds.has(Math.trunc(linkedTeethTwId));
  const isTeethOrderLine =
    prosba &&
    requestKind === "zamowienie" &&
    (Boolean(value.teethManufacturer) || isRegistryTeethTw);
  const resolvedTeethCatalog = useMemo(
    () => resolveTeethCatalogFromDraft({
      adminProductLine,
      teethProductLine: value.teethProductLine,
      teethManufacturer: value.teethManufacturer,
      product: value.product,
      subiektTwId: value.subiektTwId,
    }),
    [adminProductLine, value.teethProductLine, value.teethManufacturer, value.product, value.subiektTwId],
  );
  const resolvedTeethProductLine = resolvedTeethCatalog?.productLine ?? null;
  const dualKindMode =
    useSupportsDualKindBuilder(resolvedTeethProductLine) && Boolean(allLines);
  const siblingLineIndex =
    allLines && dualKindMode ? findTeethSiblingLineIndex(allLines, lineIndex) : null;
  const siblingLine =
    siblingLineIndex != null && allLines ? allLines[siblingLineIndex] : null;
  const dualKindInitialDetails = useMemo(() => {
    if (!dualKindMode) return undefined;
    return buildDualKindInitialDetails(
      value.teethDetails,
      siblingLine?.teethDetails,
      value.teethKind,
    );
  }, [dualKindMode, value.teethDetails, value.teethKind, siblingLine?.teethDetails]);
  const combinedDualDetails = useMemo(() => {
    if (!dualKindMode) return value.teethDetails;
    const anterior = dualKindInitialDetails?.anterior ?? [];
    const posterior = dualKindInitialDetails?.posterior ?? [];
    return [...anterior, ...posterior];
  }, [dualKindMode, dualKindInitialDetails, value.teethDetails]);
  const shouldAutoOpenTeethModal =
    autoOpenTeethList && isTeethOrderLine && Boolean(resolvedTeethProductLine) && !disabled;
  const [teethModalOpen, setTeethModalOpen] = useState(shouldAutoOpenTeethModal);
  const [teethModalKey, setTeethModalKey] = useState(() => (shouldAutoOpenTeethModal ? 1 : 0));
  const autoOpenTeethListRequestedRef = useRef(false);
  const dualDetailsFingerprint = dualKindMode
    ? `${dualKindInitialDetails?.anterior?.length ?? 0}-${dualKindInitialDetails?.posterior?.length ?? 0}-${siblingLineIndex ?? "x"}`
    : "";
  const teethModalInstanceKey = `${teethModalKey}-${resolvedTeethProductLine ?? "none"}-${dualKindMode ? "dual" : "single"}-${dualDetailsFingerprint}`;
  const teethQuantityFromList = value.teethDetails?.length ?? 0;
  const querySource = activeFieldQuery(value, activeField);
  const symbolPreview = combinedProductSymbolPreview(value);
  const debounced = useDebouncedValue(querySource.trim(), 320);
  const isInformacja = requestKind === "informacja";
  const linkedFromSubiekt = value.subiektTwId != null;
  const minQueryLen = minProductSearchLength(activeField);
  const typeaheadEnabled = enabled || catalogFallback;
  const searchActive =
    typeaheadEnabled && !linkedFromSubiekt && debounced.length >= minQueryLen;
  const shortQueryFeedback =
    typeaheadEnabled &&
    !linkedFromSubiekt &&
    debounced.length > 0 &&
    debounced.length < minQueryLen
      ? getSubiektFeedback("short_query")
      : null;
  const visibleItems = useMemo(
    () => (searchActive ? items : []),
    [items, searchActive]
  );
  const visibleFeedback = searchActive ? feedback : shortQueryFeedback;
  const visibleStatus = searchActive ? (isPending ? "loading" : status) : "idle";
  const itemsKey = `${activeField}\0${visibleItems.map((item) => item.tw_Id).join("\0")}`;
  const [appliedItemsKey, setAppliedItemsKey] = useState(itemsKey);
  if (itemsKey !== appliedItemsKey) {
    setAppliedItemsKey(itemsKey);
    setHighlightedIndex(0);
  }
  if (linkedFromSubiekt && open) {
    setOpen(false);
  }
  const productDisplay = combinedProductSearchDisplay(value);
  const mikranOnlyHint =
    !productDisplay.trim() && value.mikranCode.trim() && !linkedFromSubiekt
      ? "Kod Mikran wystarczy — opis uzupełni się przy wysłaniu."
      : null;

  useEffect(() => {
    void (async () => {
      const { actionSubiektSuggestionsEnabled } = await import("@/app/actions/subiekt");
      const r = await actionSubiektSuggestionsEnabled();
      setEnabled(r.enabled);
      setCatalogFallback(r.catalogFallback ?? false);
      setConfigFeedback(r.feedback ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!delegateAlerts) return;
    onConfigFeedbackChange?.(configFeedback);
  }, [configFeedback, delegateAlerts, onConfigFeedbackChange]);

  useEffect(() => {
    if (!delegateAlerts) return;
    const productFb =
      feedback && (feedback.tone !== "info" || items.length === 0) ? feedback : null;
    onProductFeedbackChange?.(productFb);
  }, [feedback, items.length, delegateAlerts, onProductFeedbackChange]);

  useEffect(() => {
    onResolvingSupplierChange?.(resolvingSupplier);
  }, [resolvingSupplier, onResolvingSupplierChange]);

  useEffect(() => {
    if (!pendingTeethModalRef.current || !resolvedTeethProductLine) return;
    pendingTeethModalRef.current = false;
    setTeethModalKey((k) => k + 1);
    setTeethModalOpen(true);
  }, [resolvedTeethProductLine, value.subiektTwId]);

  /** Usuwa przekłamanie: katalog zawsze wynika z towaru, nie z ręcznej zmiany linii w UI. */
  useEffect(() => {
    if (!linkedTeethTwId || !resolvedTeethProductLine) return;
    if (!teethProductInfo.twIds.has(linkedTeethTwId)) return;
    const expectedManufacturer = manufacturerForProductLine(resolvedTeethProductLine);
    const catalogLineDrifted = shouldClearTeethDetailsOnCatalogSync(
      value.teethProductLine,
      resolvedTeethProductLine,
    );
    const manufacturerStale = value.teethManufacturer !== expectedManufacturer;
    const productLineStale = value.teethProductLine !== resolvedTeethProductLine;
    if (!productLineStale && !manufacturerStale) return;

    onChange({
      teethProductLine: resolvedTeethProductLine,
      teethManufacturer: expectedManufacturer,
      ...(catalogLineDrifted && value.teethDetails?.length
        ? { teethDetails: undefined, quantity: "" }
        : {}),
    });
    if (catalogLineDrifted && value.teethDetails?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset modala po zmianie linii katalogu
      setTeethModalOpen(false);
      setTeethModalKey((k) => k + 1);
    }
  }, [
    linkedTeethTwId,
    resolvedTeethProductLine,
    value.teethProductLine,
    value.teethManufacturer,
    value.teethDetails?.length,
    onChange,
    teethProductInfo.twIds,
  ]);

  /** Towar spoza rejestru zębów — nie trzymaj metadanych zębowych z heurystyki nazwy. */
  useEffect(() => {
    if (!linkedTeethTwId || teethProductInfo.twIds.has(linkedTeethTwId)) return;
    if (
      !value.teethManufacturer
      && !value.teethProductLine
      && !value.teethKind
      && !value.teethDetails?.length
    ) {
      return;
    }
    onChange({
      teethManufacturer: null,
      teethProductLine: null,
      teethKind: null,
      teethDetails: undefined,
    });
  }, [
    linkedTeethTwId,
    onChange,
    teethProductInfo.twIds,
    value.teethDetails?.length,
    value.teethKind,
    value.teethManufacturer,
    value.teethProductLine,
  ]);

  const openTeethModal = useCallback(() => {
    setTeethModalKey((k) => k + 1);
    setTeethModalOpen(true);
  }, []);

  const handleTeethModalSave = useCallback(
    (result: TeethOrderBuilderSaveResult): boolean => {
      if (result.mode === "single") {
        onChange({
          teethDetails: result.details,
          quantity: String(result.totalQuantity),
          teethOcrPending: result.fromOcr ?? false,
          teethOcrImagePath: result.ocrImagePath ?? null,
        });
        onAfterTeethListSave?.(result.details, result.totalQuantity, result);
        return true;
      }
      if (!allLines) {
        onTeethListCommitNotice?.(
          {
            title: "Nie można zapisać obu typów",
            text: "Użyj formularza prośby z wieloma pozycjami.",
          },
          "error",
        );
        return false;
      }
      const commit = commitDualKindTeethLines(
        allLines,
        lineIndex,
        result.anteriorGroups,
        result.posteriorGroups,
        teethProductInfo.registryIndex,
        result.fromOcr,
        result.ocrImagePath,
      );
      if (!commit.ok) {
        onTeethListCommitNotice?.(commit.error, "error");
        return false;
      }
      const toastMsg = teethDualCommitToastMessage(commit.summary.added, commit.summary.updated);
      if (toastMsg) onTeethListCommitNotice?.(toastMsg, "success");
      onTeethDualKindCommit?.({
        lineIndex,
        lines: commit.lines,
        summary: commit.summary,
        focusLineId: commit.focusLineId,
      });
      const focusLine = commit.focusLineId
        ? commit.lines.find((line) => line.id === commit.focusLineId)
        : commit.lines[lineIndex];
      if (focusLine?.teethDetails) {
        onAfterTeethListSave?.(
          focusLine.teethDetails,
          parseInt(focusLine.quantity, 10) || focusLine.teethDetails.length,
          result,
        );
      }
      return true;
    },
    [
      allLines,
      lineIndex,
      onChange,
      onAfterTeethListSave,
      onTeethDualKindCommit,
      onTeethListCommitNotice,
      teethProductInfo.registryIndex,
    ],
  );

  useEffect(() => {
    if (!autoOpenTeethList) {
      autoOpenTeethListRequestedRef.current = false;
      return;
    }
    if (!isTeethOrderLine || !resolvedTeethProductLine || disabled) return;
    if (autoOpenTeethListRequestedRef.current || teethModalOpen) return;
    autoOpenTeethListRequestedRef.current = true;
    openTeethModal();
  }, [
    autoOpenTeethList,
    isTeethOrderLine,
    resolvedTeethProductLine,
    disabled,
    teethModalOpen,
    openTeethModal,
  ]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!searchActive) return;

    const generation = ++searchGenerationRef.current;
    startTransition(async () => {
      try {
        const res = await actionSuggestProducts(
          debounced,
          productSuggestSearchField(activeField)
        );
        if (generation !== searchGenerationRef.current) return;
        if (!res.ok) {
          setItems([]);
          setFeedback(res.feedback);
          setOpen(false);
          return;
        }
        setItems(res.items);
        setFeedback(res.feedback ?? null);
        setOpen(res.items.length > 0);
        setHighlightedIndex(0);
      } finally {
        if (generation === searchGenerationRef.current) {
          setStatus("idle");
        }
      }
    });
  }, [debounced, searchActive, activeField]);

  const typeaheadListVisible = open && visibleItems.length > 0;
  const typeaheadPanelVisible =
    typeaheadEnabled &&
    !linkedFromSubiekt &&
    (visibleStatus === "loading" || typeaheadListVisible);

  const listboxId = `${typeaheadInstanceId}-${activeField}`;

  const pick = useCallback(
    (p: SubiektProduct) => {
      searchGenerationRef.current++;
      const patch = buildProductPickFromSubiekt(p, requestKind, value.quantity);
      const stockSnap = stockSnapshotFromSubiektProduct(p);
      const twId = Math.trunc(Number(p.tw_Id));
      const detectedManufacturer = twId > 0
        ? (teethProductInfo.manufacturerByTwId.get(twId) ?? null)
        : null;
      const detectedKind = twId > 0
        ? (teethProductInfo.kindByTwId.get(twId) ?? null)
        : null;
      const detectedProductLine = twId > 0
        ? (teethProductInfo.productLineByTwId.get(twId) ?? null)
        : null;
      const productName = p.tw_Nazwa?.trim() || patch.product?.trim() || "";
      const autoLine: TeethProductLine | null = authoritativeTeethProductLine({
        adminProductLine: detectedProductLine,
        teethManufacturer: detectedManufacturer,
        product: productName,
      });
      const finalManufacturer = detectedManufacturer
        ?? (autoLine ? manufacturerForProductLine(autoLine) : null);
      const isTeethProduct = twId > 0 && teethProductInfo.twIds.has(twId);
      const specChanged =
        value.teethManufacturer !== finalManufacturer
        || value.teethKind !== detectedKind
        || value.teethProductLine !== autoLine;
      onChange({
        ...patch,
        subiektTwId: patch.subiektTwId,
        ...mergeStockIntoLinePatch(stockSnap),
        teethManufacturer: isTeethProduct ? finalManufacturer : null,
        teethProductLine: isTeethProduct ? autoLine : null,
        teethKind: isTeethProduct ? detectedKind : null,
        teethDetails: isTeethProduct && finalManufacturer
          ? (specChanged ? undefined : value.teethDetails)
          : undefined,
        quantity:
          isTeethProduct && finalManufacturer && specChanged
            ? ""
            : patch.quantity,
      });
      if (isTeethProduct && finalManufacturer && requestKind === "zamowienie") {
        pendingTeethModalRef.current = true;
      }
      setFeedback(null);
      setOpen(false);
      setItems([]);
      setStatus("idle");
      setHighlightedIndex(0);

      if (!suppliers?.length || !onSupplierResolved) return;

      const catalogSource = (p as { _source?: string; _topSupplier?: AppSupplierRef | null })._source;
      const topSupplier = (p as { _source?: string; _topSupplier?: AppSupplierRef | null })._topSupplier;

      // Dostawca już znany z naszej bazy (product_supplier_links) — użyj natychmiast.
      if (topSupplier) {
        onSupplierResolved({
          supplierId: topSupplier.id,
          supplierName: topSupplier.name,
          documentNumber: null,
        });
        return;
      }

      // Produkt z katalogu bez zmapowanego dostawcy — nie próbuj Subiekta (jest offline).
      if (catalogSource === "catalog") {
        onSupplierMappingMissing?.();
        return;
      }

      // Nowe podejście: dopasowanie dostawcy robimy po naszej bazie (product_supplier_links),
      // więc jest szybkie. Dla prośby handlowca robimy to "po cichu" (bez spinnera),
      // a jeśli nie ma mapowania — pozycja zostaje do weryfikacji.
      const silentResolve = deferSupplierResolve;
      if (!silentResolve) {
        setResolvingSupplier(true);
        setSupplierFeedback(null);
        onSupplierResolveFeedback?.(null);
      }
      onResolvingSupplierChange?.(true);
      startTransition(async () => {
        try {
          const { actionSubiektResolveSupplierForProduct } = await import(
            "@/app/actions/subiekt"
          );
          const res = await actionSubiektResolveSupplierForProduct(p, suppliers);
          if (res.ok) {
            onSupplierResolved({
              supplierId: res.supplierId,
              supplierName: res.supplierName,
              documentNumber: res.documentNumber,
            });
            if (!silentResolve) {
              setSupplierFeedback(null);
              onSupplierResolveFeedback?.(null);
              try {
                const { actionRecordCatalogFromSubiektPick } = await import(
                  "@/app/actions/subiekt"
                );
                const twId = Number((p as { tw_Id?: unknown }).tw_Id);
                if (Number.isFinite(twId) && twId > 0) {
                  await actionRecordCatalogFromSubiektPick({
                    subiektTwId: twId,
                    symbol: patch.symbol,
                    productName: patch.product,
                    mikranCode: patch.mikranCode,
                    supplierId: res.supplierId,
                  });
                }
              } catch {
                /* katalog — best effort */
              }
            }
          } else {
            if (!silentResolve) {
              onSupplierMappingMissing?.();
              if (!delegateAlerts) setSupplierFeedback(res.feedback);
              onSupplierResolveFeedback?.(res.feedback);
            }
          }
        } catch {
          if (!silentResolve) {
            onSupplierMappingMissing?.();
          }
        } finally {
          onResolvingSupplierChange?.(false);
          if (!silentResolve) setResolvingSupplier(false);
        }
      });
    },
    [
      deferSupplierResolve,
      delegateAlerts,
      onChange,
      onResolvingSupplierChange,
      onSupplierMappingMissing,
      onSupplierResolveFeedback,
      onSupplierResolved,
      requestKind,
      suppliers,
      value.quantity,
      value.teethDetails,
      value.teethKind,
      value.teethManufacturer,
      value.teethProductLine,
      teethProductInfo,
    ]
  );

  const manualPatch = (
    patch: Partial<SubiektProductLineValue>,
    clearSubiekt = false
  ) => {
    onChange(
      clearSubiekt
        ? { ...patch, subiektTwId: null, source: null, teethManufacturer: null, teethProductLine: null, teethKind: null, teethDetails: undefined, ...mergeStockIntoLinePatch(null) }
        : patch
    );
  };

  const unlinkSubiektForEdit = () => {
    onChange({ subiektTwId: null, source: null, teethManufacturer: null, teethProductLine: null, teethKind: null, teethDetails: undefined, ...mergeStockIntoLinePatch(null) });
    setOpen(true);
  };

  const handleTypeaheadKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!typeaheadEnabled || linkedFromSubiekt) return;

      const hasList = typeaheadListVisible;

      if (e.key === "ArrowDown" && hasList) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, visibleItems.length - 1));
        return;
      }
      if (e.key === "ArrowUp" && hasList) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && hasList) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = visibleItems[highlightedIndex];
        if (chosen) pick(chosen);
        return;
      }
      if (
        e.key === "Escape" &&
        (hasList || visibleStatus === "loading" || open)
      ) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlightedIndex(0);
      }
    },
    [
      typeaheadEnabled,
      linkedFromSubiekt,
      typeaheadListVisible,
      visibleItems,
      highlightedIndex,
      visibleStatus,
      open,
      pick,
    ]
  );

  const typeaheadInputA11y = (field: ActiveField) => {
    const isActive = activeField === field;
    const fieldPanelOpen = isActive && typeaheadPanelVisible;
    return {
      "aria-autocomplete": "list" as const,
      "aria-expanded": fieldPanelOpen,
      "aria-controls": fieldPanelOpen ? listboxId : undefined,
      "aria-activedescendant":
        isActive && typeaheadListVisible
          ? `${listboxId}-opt-${highlightedIndex}`
          : undefined,
    };
  };

  const renderTypeaheadPanel = (anchorField?: ActiveField) => {
    if (anchorField != null && activeField !== anchorField) return null;
    if (!typeaheadPanelVisible) return null;

    const resultLabel =
      visibleItems.length === 1 ? "1 wynik" : `${visibleItems.length} wyników`;

    return (
      <TypeaheadDropdown
        open
        size={typeaheadSize}
        listboxId={listboxId}
        className="left-0 right-0"
        emptyMessage={visibleStatus === "loading" ? (catalogFallback ? "Szukam w bazie…" : "Szukam w Subiekcie…") : undefined}
        footer={typeaheadListVisible ? TYPEAHEAD_KEYBOARD_HINT : undefined}
      >
        {typeaheadListVisible ? (
          <>
            <TypeaheadSectionLabel>
              {visibleItems[0]?._source === "catalog"
                ? `Lokalna baza — ${typeaheadSectionLabel(activeField)} · ${resultLabel}`
                : `Subiekt (na żywo) — ${typeaheadSectionLabel(activeField)} · ${resultLabel}`}
            </TypeaheadSectionLabel>
            {visibleItems.map((p, index) => {
              const { title, subtitle, badge } = formatSubiektProductOption(p);
              return (
                <TypeaheadOption
                  key={p.tw_Id}
                  optionId={`${listboxId}-opt-${index}`}
                  title={title}
                  subtitle={subtitle}
                  badge={badge ?? "Subiekt"}
                  size={typeaheadSize}
                  highlighted={highlightedIndex === index}
                  onHighlight={() => setHighlightedIndex(index)}
                  onSelect={() => pick(p)}
                />
              );
            })}
          </>
        ) : null}
      </TypeaheadDropdown>
    );
  };

  const showError = visibleFeedback && visibleFeedback.tone !== "info";
  const showInfo = visibleFeedback && visibleFeedback.tone === "info" && visibleItems.length === 0;
  const productFieldFeedback =
    visibleFeedback && (showError || showInfo) && !linkedFromSubiekt
      ? visibleFeedback
      : null;

  const mergedProductField = withoutSuccessWhenLinked(
    mergeCombinedProductFieldProps(fieldValidation),
    linkedFromSubiekt
  );
  const mikranField = withoutSuccessWhenLinked(
    mikranFieldProps(fieldValidation),
    linkedFromSubiekt
  );
  const quantityField = quantityFieldProps(fieldValidation);
  const showQuantityValidation = prosba || Boolean(fieldValidation);
  const productInputLoading = activeField !== "plu" && visibleStatus === "loading";
  const mikranInputLoading = activeField === "plu" && visibleStatus === "loading";

  const prosbaMessageItems: ProsbaLineMessageItem[] = [];
  if (prosba && !delegateAlerts) {
    if (resolvingSupplier) {
      prosbaMessageItems.push({ kind: "resolving" });
    }
    if (supplierFeedback) {
      prosbaMessageItems.push({ kind: "feedback", feedback: supplierFeedback });
    }
    if (productFieldFeedback) {
      prosbaMessageItems.push({
        kind: "feedback",
        feedback: productFieldFeedback,
        fieldLabel: `Subiekt — ${subiektFieldLabel(activeField)}`,
      });
    }
  }

  const productSearchRow = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Field
        label={
          <span>
            {isInformacja
              ? "Produkt (symbol lub nazwa)"
              : "Produkt — symbol lub nazwa"}
          </span>
        }
        className={cn("min-w-0 flex-1", productFieldClassName)}
        {...mergedProductField}
        hint={
          !mergedProductField.error && !mergedProductField.state
            ? mikranOnlyHint ??
              (typeaheadEnabled && !prosba
                ? catalogFallback
                  ? "Wpisz nazwę lub symbol — wyniki z lokalnej bazy"
                  : "Wpisz nazwę lub symbol — wyniki z Subiekta pojawią się poniżej"
                : !typeaheadEnabled
                  ? "Nazwa lub symbol produktu (wpis ręczny)"
                  : undefined)
            : undefined
        }
      >
        <div
          className={cn(
            "relative rounded-md transition-[box-shadow]",
            typeaheadPanelVisible &&
              activeField !== "plu" &&
              "z-30 ring-2 ring-indigo-400/80 ring-offset-2"
          )}
        >
          <SubiektInputShell loading={productInputLoading}>
            <Input
              disabled={disabled}
              placeholder={
                isInformacja
                  ? "np. Śruba M6 lub ABC-12"
                  : typeaheadEnabled
                    ? catalogFallback
                      ? "Szukaj w bazie: nazwa lub symbol…"
                      : "Szukaj w Subiekcie: nazwa lub symbol…"
                    : "Nazwa lub symbol produktu"
              }
              maxLength={MAX_PRODUCT_TEXT_LEN}
              value={combinedProductSearchDisplay(value)}
              autoComplete="off"
              state={mergedProductField.state}
              className={cn(
                compactControls
                  ? "min-h-11 py-2.5 text-base sm:min-h-[2.5rem] sm:text-sm"
                  : "min-h-12 py-3 text-base sm:min-h-[2.75rem]",
                inputLoadingPadding(productInputLoading)
              )}
              onKeyDown={handleTypeaheadKeyDown}
              {...(activeField === "plu"
                ? {}
                : typeaheadInputA11y(activeField))}
              onChange={(e) => {
                const q = e.target.value;
                const field = inferCombinedProductSearchField(q);
                manualPatch(
                  patchFromCombinedProductInput(q, {
                    symbol: value.symbol,
                    product: value.product,
                  }),
                  true
                );
                setActiveField(field);
                setOpen(true);
              }}
              onFocus={() => {
                if (linkedFromSubiekt) return;
                const q = combinedProductSearchDisplay(value);
                setActiveField(
                  q.trim() ? inferCombinedProductSearchField(q) : "name"
                );
                setOpen(true);
              }}
            />
          </SubiektInputShell>
          {renderTypeaheadPanel()}
          {!linkedFromSubiekt && symbolPreview ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Symbol w Subiekcie:{" "}
              <span className="font-medium text-slate-700">{symbolPreview}</span>
            </p>
          ) : null}
          {linkedFromSubiekt ? (
            <div className="mt-1.5">
              <SubiektLinkedLineBanner
                symbol={symbolPreview}
                mikranCode={value.mikranCode}
                fromCatalog={value.source === "catalog"}
              />
            </div>
          ) : null}
        </div>
      </Field>

      <Field
        label="Mikran"
        className="w-full shrink-0 sm:w-[6.75rem]"
        {...mikranField}
        hint={
          !mikranField.error && !mikranField.state
            ? typeaheadEnabled
              ? "PLU (min. 1 cyfra)"
              : "Kod PLU"
            : undefined
        }
      >
        <div
          className={cn(
            "relative rounded-md transition-[box-shadow]",
            typeaheadPanelVisible &&
              activeField === "plu" &&
              "z-30 ring-2 ring-indigo-400/80 ring-offset-2"
          )}
        >
          <SubiektInputShell loading={mikranInputLoading}>
            <Input
              disabled={disabled}
              readOnly={linkedFromSubiekt}
              placeholder="896"
              inputMode="numeric"
              maxLength={MAX_MIKRAN_CODE_LEN}
              value={value.mikranCode}
              autoComplete="off"
              state={mikranField.state}
              className={cn(
                compactControls
                  ? "min-h-11 px-2.5 text-base tabular-nums sm:min-h-[2.5rem] sm:text-sm"
                  : "min-h-12 px-2.5 text-base tabular-nums sm:min-h-[2.75rem] sm:text-sm",
                mikranInputLoading ? "pr-9 text-left" : "text-center",
                linkedFromSubiekt && "bg-slate-50 text-slate-600"
              )}
              onKeyDown={handleTypeaheadKeyDown}
              {...typeaheadInputA11y("plu")}
              onChange={(e) => {
                manualPatch({ mikranCode: e.target.value }, true);
                setActiveField("plu");
                setOpen(true);
              }}
              onFocus={() => {
                if (linkedFromSubiekt) return;
                setActiveField("plu");
                setOpen(true);
              }}
            />
          </SubiektInputShell>
        </div>
      </Field>

      {!isInformacja ? (
        <Field
          label="Ilość"
          className="w-[5.5rem] shrink-0"
          {...(showQuantityValidation && !isTeethOrderLine ? quantityField : {})}
          hint={
            isTeethOrderLine
              ? teethQuantityFromList > 0
                ? "Z listy"
                : "Uzupełnij listę"
              : prosba && !quantityField.error && !quantityField.state
                ? "Sztuk"
                : undefined
          }
        >
          <Input
            type="number"
            min={1}
            step={1}
            required={!isTeethOrderLine}
            disabled={disabled || isTeethOrderLine}
            readOnly={isTeethOrderLine}
            maxLength={MAX_QUANTITY_LEN}
            placeholder={isTeethOrderLine ? "—" : "1"}
            inputMode="numeric"
            aria-label="Ilość sztuk"
            value={
              isTeethOrderLine
                ? teethQuantityFromList > 0
                  ? String(teethQuantityFromList)
                  : ""
                : value.quantity
            }
            state={showQuantityValidation && !isTeethOrderLine ? quantityField.state : undefined}
            className={cn(
              compactControls
                ? "min-h-11 px-2 text-center text-base tabular-nums sm:min-h-[2.5rem] sm:text-sm"
                : "min-h-12 px-2 text-center text-base tabular-nums sm:min-h-[2.75rem] sm:text-sm",
              isTeethOrderLine && teethProsbaQuantityInputClass,
            )}
            onChange={(e) => {
              if (isTeethOrderLine) return;
              onChange({ quantity: e.target.value });
            }}
          />
        </Field>
      ) : null}
    </div>
  );

  return (
    <div ref={ref} className="relative space-y-3">
      {productSearchRow}

      {linkedFromSubiekt ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="text-emerald-800 hover:bg-emerald-50"
            onClick={unlinkSubiektForEdit}
          >
            Zmień towar
          </Button>
        </div>
      ) : null}

      {prosbaMessageItems.length > 0 ? (
        <ProsbaLineFieldMessages items={prosbaMessageItems} />
      ) : null}

      {prosba && requestKind === "zamowienie" ? (
        value.teethManufacturer && resolvedTeethProductLine ? (
          <TeethOrderBuilderCard
            manufacturer={manufacturerForProductLine(resolvedTeethProductLine)}
            productLine={resolvedTeethProductLine}
            productName={value.product}
            defaultKind={value.teethKind ?? null}
            details={dualKindMode ? combinedDualDetails : (value.teethDetails ?? undefined)}
            dualKindMode={dualKindMode}
            disabled={disabled}
            onOpenModal={openTeethModal}
          />
        ) : (
          <>
            <ProsbaTeethExemptHint line={value as ProductLineDraft} />
            <ProsbaProductStockStatus line={value as ProductLineDraft} requestKind={requestKind} />
          </>
        )
      ) : null}

      {value.teethManufacturer && resolvedTeethProductLine && requestKind === "zamowienie" ? (
        <TeethOrderBuilderModal
          key={teethModalInstanceKey}
          open={teethModalOpen}
          onClose={() => setTeethModalOpen(false)}
          productLine={resolvedTeethProductLine}
          manufacturer={manufacturerForProductLine(resolvedTeethProductLine)}
          defaultKind={value.teethKind ?? null}
          productLabel={value.product?.trim() || value.symbol?.trim() || undefined}
          initialDetails={value.teethDetails ?? undefined}
          initialFromOcr={value.teethOcrPending || siblingLine?.teethOcrPending}
          initialOcrImagePath={value.teethOcrImagePath ?? siblingLine?.teethOcrImagePath ?? null}
          dualKindMode={dualKindMode}
          dualKindInitialDetails={dualKindInitialDetails}
          disabled={disabled}
          onSave={handleTeethModalSave}
        />
      ) : null}

      {value.subiektTwId != null && value.subiektTwId > 0
        && teethProductInfo.twIds.has(Math.trunc(value.subiektTwId))
        && !value.teethManufacturer
        && requestKind === "zamowienie" ? (
        <div role="status" aria-live="polite">
          <Badge variant="warning" className="text-[10px]">
            Producent nieustalony — uzupełnij w adminie
          </Badge>
        </div>
      ) : null}

      {!typeaheadEnabled && configFeedback && !delegateAlerts && !prosba ? (
        <SubiektFeedbackAlert feedback={configFeedback} compact />
      ) : null}

      {typeaheadEnabled ? (
        <>
          {!delegateAlerts && !prosba && !visibleFeedback && !resolvingSupplier && !linkedFromSubiekt ? (
            <p className="text-xs text-slate-400">
              {catalogFallback
                ? "Wpisz nazwę lub symbol w dużym polu — wyniki z lokalnej bazy pojawią się pod produktem."
                : "Wpisz nazwę lub symbol w dużym polu, kod Mikran i ilość obok — lista z Subiekta pojawi się pod produktem."}
            </p>
          ) : null}

          {!delegateAlerts && !prosba && supplierFeedback ? (
            <SubiektFeedbackAlert feedback={supplierFeedback} compact />
          ) : null}

          {!delegateAlerts && !prosba && showError ? (
            <SubiektFeedbackAlert feedback={visibleFeedback} compact />
          ) : null}
          {!delegateAlerts && !prosba && showInfo ? (
            <SubiektFeedbackAlert feedback={visibleFeedback} compact />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
