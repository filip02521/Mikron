"use client";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { ADMIN_PREVIEW_NOTICE, REQUEST_EDIT_FORM } from "@/lib/ui/notice-copy";

import { useState, useTransition, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { ACTION_PENDING_SAFETY_FORM_MS } from "@/lib/timing";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NoticeToast } from "@/components/ui/NoticeToast";
import type { FormMessage, TransientNotice } from "@/lib/ui/notice-content";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { ProsbaSupplierLeadTimeMeta } from "@/components/orders/ProsbaSupplierLeadTimeMeta";
import type { DeliveryStats, IndividualRequestKind } from "@/types/database";
import type { TeethManufacturer, TeethLineDetail, TeethProductLine, TeethKind } from "@/lib/teeth/teeth-catalog";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { prosbaHref } from "@/lib/orders/prosba-url";
import { IconLayers, IconPlusCircle, IconUserCog, IconUserGroup } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { ProsbaFormMetaStrip } from "@/components/orders/ProsbaFormMetaStrip";
import { ProsbaPageToolbar } from "@/components/orders/ProsbaPageToolbar";
import type { ProductZdLookupStockOutPrefill } from "@/lib/orders/product-zd-lookup-session";
import { hasAnyProductHint, hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import { buildProcurementFormReadiness } from "@/lib/orders/procurement-form-readiness";
import {
  DEFAULT_INFORMACJA_FLOW_PATH,
  informacjaProductsFormHint,
  informacjaSalesFooterNote,
} from "@/lib/orders/informacja-flow-ui";
import {
  flagsFromInformacjaFlowPath,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import { assessSalesGroupSubmittable } from "@/lib/orders/sales-request-submit";
import { prosbaLineHasTeethBlockers } from "@/lib/orders/prosba-line-field-validation";
import { buildProsbaFormReadiness, buildProsbaFormReadinessWithSupplier } from "@/lib/orders/prosba-form-readiness";
import { PROSBA_FORM_SECTION_COPY } from "@/lib/orders/prosba-form-section-copy";
import { PROSBA_PAGE_HEADER_HINTS } from "@/lib/orders/prosba-optional-section-copy";
import { ProsbaFormReadiness } from "@/components/orders/ProsbaFormReadiness";
import {
  ProsbaFormInformacjaSection,
  ProsbaFormKeyboardStrip,
  ProsbaFormProductsSection,
  ProsbaFormRequestKindSection,
} from "@/components/orders/ProsbaFormSharedSections";
import { RequestProductLinesEditor } from "@/components/orders/RequestProductLinesEditor";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { newProductLine, appendProductLine } from "@/components/orders/request-product-lines";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import {
  handleSalesProsbaKeyboardEvent,
  SALES_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/sales-prosba-keyboard";
import {
  handleProcurementProsbaKeyboardEvent,
  PROCUREMENT_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/procurement-prosba-keyboard";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import { buildOnboardingProsbaLines } from "@/lib/sales/sales-onboarding-demo-data";
import {
  actionGetZkProsbaPrefill,
  actionGetZkProsbaPrefillByWatchId,
} from "@/app/actions/sales-notepad";
import { ProsbaVsBoardHint } from "@/components/department-board/ProsbaVsBoardHint";
import { ZkProsbaLinkBanner } from "@/components/orders/ZkProsbaLinkBanner";
import { ProsbaSupplierVacationNotice } from "@/components/orders/ProsbaSupplierVacationNotice";
import {
  buildProsbaSupplierVacationNoticeModel,
  collectProsbaVacationHits,
} from "@/lib/orders/prosba-supplier-vacation-copy";
import type { SupplierOnVacationWindow } from "@/lib/orders/procurement-supplier-vacation";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import {
  buildProsbaPrefillFromUrlParams,
  clearZkProsbaPrefill,
  parseProsbaZkLineKeysParam,
  readZkProsbaPrefill,
  zkProsbaCatalogLocked,
  type ZkProsbaPrefill,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { ZK_PROSBA_LINK_BANNER_COPY } from "@/lib/orders/zk-prosba-link-banner-copy";
import { assertProsbaLinesBelongToZk } from "@/lib/orders/zk-prosba-catalog-guard";
import {
  clearBoardQuestionProsbaPrefill,
  readBoardQuestionProsbaPrefill,
} from "@/lib/orders/board-question-prosba-prefill";
import { DEPARTMENT_BOARD_QUESTIONS_FORM } from "@/lib/department-board/copy";
import { readTeethOcrProsbaPrefill, clearTeethOcrProsbaPrefill, resolveSupplierForTeethPrefill } from "@/lib/orders/teeth-ocr-prosba-prefill";
import { clearUnseenNewZkLineKeys, removeUnseenNewZkLineKeys } from "@/lib/client/zk-watch-new-lines-snapshot";
import { ProsbaStockConfirmDialog } from "@/components/orders/ProsbaStockConfirmDialog";
import { buildProsbaSubmitStockConfirm, buildProsbaSubmitZkQuantityConfirm, formatProsbaZkQuantityFormBanner, applyProsbaLineStockMap, collectProsbaLineTwIdsMissingStock } from "@/lib/orders/prosba-stock-check";
import { handleProsbaStockSubmitError } from "@/lib/orders/prosba-stock-submit-error";
import { useTeethExemptTwIds, useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { prosbaLinesIncludeTeethProduct } from "@/lib/orders/teeth-stock-exempt";
import {
  classifyProsbaLinesByLane,
  procurementSubmitSuccessMessage,
} from "@/lib/teeth/teeth-procurement-flow-copy";
import { resolveTeethCatalogProduct } from "@/lib/teeth/teeth-dual-kind";
import { formatSubmitResult } from "@/lib/orders/prosba-submit-result-copy";

interface Entry {
  id: string;
  supplierId: string;
  salesPersonId: string;
  symbol: string;
  mikranCode: string;
  product: string;
  quantity: string;
  clientName?: string;
  clientKhId?: number | null;
  subiektTwId?: number | null;
  onHand?: number | null;
  reserved?: number | null;
  available?: number | null;
  stockSource?: "subiekt" | null;
  source?: "subiekt" | "catalog" | null;
  zkQuantity?: number | null;
  requestNote?: string;
  teethManufacturer?: TeethManufacturer | null;
  teethProductLine?: TeethProductLine | null;
  teethKind?: TeethKind | null;
  teethDetails?: TeethLineDetail[];
  teethOcrPending?: boolean;
  teethOcrImagePath?: string | null;
}

function emptyEntry(salesPersonId = ""): Entry {
  const line = newProductLine();
  return {
    ...line,
    supplierId: "",
    salesPersonId,
  };
}

function emptyGroup(salesPersonId = "", supplierId = ""): Entry[] {
  const row = emptyEntry(salesPersonId);
  if (supplierId) row.supplierId = supplierId;
  return [row];
}

function buildInitialGroups(
  lockedId: string,
  initialSupplierId?: string | null
): Entry[][] {
  return [emptyGroup(lockedId, initialSupplierId ?? "")];
}

export function OrderFormClient({
  suppliers,
  salesPeople,
  lockedSalesPerson,
  singleGroup = false,
  submitForOther = false,
  initialSupplierId,
  delegatePeople,
  managerSelfId,
  forceReadOnly = false,
  suppliersOnVacationNow = {},
  statsBySupplierId = {},
}: {
  suppliers: OrderFormSupplierOption[];
  salesPeople: { id: string; name: string }[];
  /** Zalogowany handlowiec — bez wyboru „dla kogo”. */
  lockedSalesPerson?: { id: string; name: string } | null;
  /** Uproszczony formularz dla handlowca (jedna grupa produktów) */
  singleGroup?: boolean;
  /** Kierownik składa prośbę w imieniu innego handlowca */
  submitForOther?: boolean;
  /** Z harmonogramu / linku — wstępnie wybrany dostawca */
  initialSupplierId?: string | null;
  /** Kierownik — lista do przełączenia „w czyim imieniu” (formularz /prosba) */
  delegatePeople?: { id: string; name: string }[];
  managerSelfId?: string;
  /** Wymusza tryb podglądu (np. admin z ?dla= bez cookie panelu). */
  forceReadOnly?: boolean;
  /** Dostawcy z aktywnym urlopem obejmującym dziś (kalendarz). */
  suppliersOnVacationNow?: Record<string, SupplierOnVacationWindow>;
  /** Średnie czasy dostawy (`delivery_stats`) — meta przy znanym dostawcy. */
  statsBySupplierId?: Record<string, DeliveryStats>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { readOnly: panelReadOnly } = useAdminPanelPreview();
  const readOnly = forceReadOnly || panelReadOnly;
  const tourDemo = useSalesOnboardingDemo("prosba");
  const teethExemptTwIds = useTeethExemptTwIds();
  const teethProductInfo = useTeethProductInfo();
  const lockedId = lockedSalesPerson?.id ?? "";
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [informacjaPath, setInformacjaPath] = useState<InformacjaFlowPath>(
    DEFAULT_INFORMACJA_FLOW_PATH
  );
  const [groups, setGroups] = useState<Entry[][]>(() =>
    buildInitialGroups(lockedId, initialSupplierId)
  );
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const pendingSafetyRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingSafetyRef.current) window.clearTimeout(pendingSafetyRef.current);
    };
  }, []);

  const [msg, setMsg] = useState<
    (TransientNotice & { actionHref?: string; actionLabel?: string }) | null
  >(null);
  const dismissToast = useCallback(() => setMsg(null), [setMsg]);
  const [resolvingSupplier, setResolvingSupplier] = useState(false);
  const deferSupplierResolve = Boolean(singleGroup && lockedSalesPerson);
  const [formNotice, setFormNotice] = useState<FormMessage | null>(null);
  /** Po prefill z ZK — link „Moje zamówienia” z tym samym filtrem co w notatniku. */
  const [zkProsbaLinkContext, setZkProsbaLinkContext] = useState<{
    zkWatchId: string | null;
    zkNumber: string;
    clientLabel: string;
    clientKhId: number | null;
    mode?: "full" | "supplement";
    supplementLineCount?: number;
    lineKeys?: string[];
    allowedTwIds: ReadonlySet<number> | null;
    caseNoteIncluded?: boolean;
    caseNote?: string;
  } | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [stockConfirmOpen, setStockConfirmOpen] = useState(false);
  const [stockConfirmKind, setStockConfirmKind] = useState<"stock" | "zk_quantity" | null>(null);
  const [stockConfirmMessage, setStockConfirmMessage] = useState("");
  const [stockConfirmTitle, setStockConfirmTitle] = useState("Towar na stanie");
  const [stockConfirmConfirmLabel, setStockConfirmConfirmLabel] = useState("Wyślij mimo to");
  const pendingSubmitEntriesRef = useRef<(Entry & { requestNote?: string })[]>([]);
  const pendingSubmitAckRef = useRef<{
    acknowledgeSufficientStock?: boolean;
    acknowledgeZkQuantityMismatch?: boolean;
  }>({});
  const submitRef = useRef<() => void>(() => {});

  const clearFormNotice = useCallback(() => setFormNotice(null), [setFormNotice]);

  const applyProductZdStockOutPrefill = useCallback(
    (prefill: ProductZdLookupStockOutPrefill) => {
      setRequestKind("informacja");
      setInformacjaPath("stock_out");
      setValidationAttempted(false);
      setFormNotice(null);
      setMsg(null);
      setZkProsbaLinkContext(null);
      const line = newProductLine();
      setGroups([
        [
          {
            ...line,
            supplierId: "",
            salesPersonId: lockedId,
            symbol: prefill.symbol,
            mikranCode: prefill.mikranCode,
            product: prefill.product,
            quantity: "",
            subiektTwId: prefill.subiektTwId,
            stockSource: "subiekt",
          },
        ],
      ]);
    },
    [
      lockedId,
      setRequestKind,
      setInformacjaPath,
      setValidationAttempted,
      setFormNotice,
      setMsg,
      setZkProsbaLinkContext,
      setGroups,
    ]
  );

  const tourFormKey = tourDemo && lockedId ? lockedId : "";
  const [appliedTourFormKey, setAppliedTourFormKey] = useState("");
  if (tourFormKey && tourFormKey !== appliedTourFormKey) {
    setAppliedTourFormKey(tourFormKey);
    setGroups([buildOnboardingProsbaLines(lockedId)]);
    setRequestKind("zamowienie");
    setValidationAttempted(false);
    setFormNotice(null);
    setMsg(null);
  } else if (!tourFormKey && appliedTourFormKey) {
    setAppliedTourFormKey("");
  }

  useEffect(() => {
    const zkWatchParam = searchParams.get("zkWatch")?.trim();
    const zkParam = searchParams.get("zk")?.trim();
    const fromZkFlow =
      searchParams.get("fromZk") === "1" || Boolean(zkWatchParam) || Boolean(zkParam);
    if (tourDemo || !fromZkFlow) return;

    let cancelled = false;

    async function applyZkPrefill(prefill: ZkProsbaPrefill) {
      if (prefill.teethDraftsIncomplete) {
        setFormNotice({
          title: "Najpierw uzupełnij listę zębów",
          text: "Wróć do notatnika ZK i uzupełnij listę zębów (kolor, wzór, rozmiar), zanim utworzysz prośbę.",
          tone: "warning",
        });
        return;
      }
      if (!prefill.lines.length) return;
      let resolved = prefill;
      if (
        !zkProsbaCatalogLocked(resolved) &&
        resolved.zkWatchId?.trim()
      ) {
        try {
          const fromWatch = await actionGetZkProsbaPrefillByWatchId(
            resolved.zkWatchId,
            searchParams.get("dla")?.trim() || lockedId || undefined,
            resolved.lineKeys,
            resolved.requestKind
          );
          if (fromWatch?.teethDraftsIncomplete) {
            setFormNotice({
              title: "Najpierw uzupełnij listę zębów",
              text: "Wróć do notatnika ZK i uzupełnij listę zębów (kolor, wzór, rozmiar), zanim utworzysz prośbę.",
              tone: "warning",
            });
            return;
          }
          if (fromWatch && zkProsbaCatalogLocked(fromWatch)) {
            resolved = {
              ...resolved,
              allowedTwIds: fromWatch.allowedTwIds,
            };
          }
        } catch {
          /* allowlista — best effort */
        }
      }

      const clientName = resolved.clientName?.trim() || "";
      const clientKhId = resolved.clientKhId ?? null;
      const nextRequestKind = resolved.requestKind ?? "zamowienie";
      const allowedTwIds =
        resolved.allowedTwIds && resolved.allowedTwIds.length > 0
          ? new Set(resolved.allowedTwIds)
          : null;
      const { registryIndex } = teethProductInfo;
      const hasRegistry = registryIndex.byLineAndKind.size > 0;
      setRequestKind(nextRequestKind);
      if (nextRequestKind === "informacja") {
        setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
      }
      setValidationAttempted(false);
      setFormNotice(null);
      setMsg(null);
      if (resolved.zkWatchId || resolved.zkNumber.trim()) {
        setZkProsbaLinkContext({
          zkWatchId: resolved.zkWatchId,
          zkNumber: resolved.zkNumber,
          clientLabel: clientName,
          clientKhId,
          mode: resolved.mode,
          supplementLineCount: resolved.supplementLineCount,
          lineKeys: resolved.lineKeys,
          allowedTwIds,
          caseNoteIncluded: Boolean(resolved.includeCaseNote && resolved.caseNote?.trim()),
          ...(resolved.caseNote?.trim()
            ? { caseNote: resolved.caseNote.trim() }
            : {}),
        });
      }
      let baseLines = resolved.lines.map((line) => {
        const catalogResolved =
          hasRegistry && line.teethProductLine && line.teethKind
            ? resolveTeethCatalogProduct(
                registryIndex,
                line.teethProductLine,
                line.teethKind
              )
            : null;
        return {
          id: line.id,
          supplierId: "",
          salesPersonId: lockedId,
          symbol: catalogResolved?.symbol?.trim() || line.symbol,
          mikranCode: catalogResolved?.plu?.trim() || line.mikranCode,
          product: catalogResolved?.name || line.product,
          quantity: nextRequestKind === "informacja" ? "" : line.quantity,
          clientName: clientName || line.clientName,
          clientKhId: clientKhId ?? line.clientKhId ?? null,
          subiektTwId: catalogResolved?.twId ?? line.subiektTwId ?? null,
          source: catalogResolved ? ("catalog" as const) : line.source,
          onHand: line.onHand,
          reserved: line.reserved,
          available: line.available,
          stockSource: line.stockSource,
          zkQuantity: line.zkQuantity ?? null,
          requestNote: line.requestNote?.trim() || undefined,
          teethManufacturer:
            catalogResolved?.manufacturer ?? line.teethManufacturer ?? null,
          teethProductLine:
            catalogResolved?.productLine ?? line.teethProductLine ?? null,
          teethKind: line.teethKind ?? null,
          teethDetails: line.teethDetails?.length
            ? line.teethDetails.map((d) => ({ ...d }))
            : undefined,
        };
      });

      const twIds = collectProsbaLineTwIdsMissingStock(baseLines, nextRequestKind, teethExemptTwIds);
      if (twIds.length > 0) {
        try {
          const { actionFetchProsbaLineStock } = await import("@/app/actions/subiekt");
          const stock = await actionFetchProsbaLineStock(twIds);
          if (!cancelled) {
            baseLines = applyProsbaLineStockMap(baseLines, stock).next as typeof baseLines;
          }
        } catch {
          /* stan — best effort; useProsbaLinesStockSync dogoni */
        }
      }

      if (!cancelled) {
        setGroups([baseLines]);
      }
    }

    async function loadZkPrefill() {
      const delegateId = searchParams.get("dla")?.trim() || lockedId;
      if (!delegateId) return;

      const fromStorage = readZkProsbaPrefill();
      if (fromStorage && (fromStorage.lines.length || fromStorage.teethDraftsIncomplete)) {
        if (!cancelled) {
          const watchId = fromStorage.zkWatchId?.trim();
          if (watchId) {
            try {
              const fromWatch = await actionGetZkProsbaPrefillByWatchId(
                watchId,
                delegateId || undefined,
                fromStorage.lineKeys,
                fromStorage.requestKind
              );
              if (fromWatch) {
                await applyZkPrefill(fromWatch);
                clearZkProsbaPrefill();
                return;
              }
            } catch {
              /* fallback do stash poniżej */
            }
          }
          await applyZkPrefill(fromStorage);
          clearZkProsbaPrefill();
        }
        return;
      }

      const zkWatch = searchParams.get("zkWatch")?.trim();
      const zk = searchParams.get("zk")?.trim();
      const zkLineKeys = parseProsbaZkLineKeysParam(searchParams.get("zkLines"));
      const requestKindFromUrl =
        searchParams.get("rodzaj") === "informacja" ? ("informacja" as const) : undefined;

      try {
        if (cancelled) return;
        if (zkWatch) {
          const fromWatch = await actionGetZkProsbaPrefillByWatchId(
            zkWatch,
            delegateId || undefined,
            zkLineKeys,
            requestKindFromUrl
          );
          if (!cancelled && fromWatch && (fromWatch.lines.length || fromWatch.teethDraftsIncomplete)) {
            await applyZkPrefill(fromWatch);
            return;
          }
          if (!cancelled && zkLineKeys?.length) {
            setFormNotice({
              title: "Nie udało się wczytać ZK",
              text: "Uzupełnij prośbę ręcznie lub wróć do notatnika.",
              tone: "warning",
            });
            return;
          }
        }
        if (zk) {
          const fromServer = await actionGetZkProsbaPrefill(zk, delegateId || undefined);
          if (!cancelled && fromServer && (fromServer.lines.length || fromServer.teethDraftsIncomplete)) {
            await applyZkPrefill(fromServer);
            return;
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFormNotice({
            title: "Nie udało się wczytać ZK",
            text: userFacingErrorText(err, "Uzupełnij prośbę ręcznie."),
            tone: "warning",
          });
        }
      }

      const fromUrl = buildProsbaPrefillFromUrlParams({
        klient: searchParams.get("klient"),
        kh: searchParams.get("kh"),
        zk: searchParams.get("zk"),
        zkWatch: searchParams.get("zkWatch"),
      });
      if (!cancelled && fromUrl?.lines.length && !zkLineKeys?.length) {
        await applyZkPrefill(fromUrl);
      }
    }

    void loadZkPrefill();
    return () => {
      cancelled = true;
    };
  }, [lockedId, searchParams, tourDemo, teethExemptTwIds, teethProductInfo]);

  const teethOcrPrefillAppliedRef = useRef(false);
  useEffect(() => {
    if (tourDemo) return;
    if (teethOcrPrefillAppliedRef.current) return;
    const prefill = readTeethOcrProsbaPrefill();
    if (!prefill?.lines.length) return;
    teethOcrPrefillAppliedRef.current = true;
    clearTeethOcrProsbaPrefill();

    const { registryIndex } = teethProductInfo;
    const hasRegistry = registryIndex.byLineAndKind.size > 0;

    const resolvedSupplierId = resolveSupplierForTeethPrefill(prefill.lines, suppliers);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time OCR prefill from localStorage
    setRequestKind("zamowienie");
    setValidationAttempted(false);
    setFormNotice(null);
    setMsg(null);
    setGroups([
      prefill.lines.map((line) => {
        const resolved =
          hasRegistry && line.teethProductLine && line.teethKind
            ? resolveTeethCatalogProduct(
                registryIndex,
                line.teethProductLine,
                line.teethKind,
              )
            : null;
        return {
          ...line,
          supplierId: resolvedSupplierId,
          salesPersonId: lockedId,
          subiektTwId: resolved?.twId ?? line.subiektTwId,
          symbol: resolved?.symbol?.trim() || line.symbol,
          mikranCode: resolved?.plu?.trim() || line.mikranCode,
          product: resolved?.name || line.product,
          source: resolved ? "catalog" : line.source,
        };
      }),
    ]);
  }, [lockedId, tourDemo, teethProductInfo, suppliers]);

  const boardQuestionPrefillAppliedRef = useRef(false);
  useEffect(() => {
    if (tourDemo) return;
    if (boardQuestionPrefillAppliedRef.current) return;
    if (searchParams.get("fromBoard") !== "1") return;
    const prefill = readBoardQuestionProsbaPrefill();
    if (!prefill?.lines.length) return;
    boardQuestionPrefillAppliedRef.current = true;
    clearBoardQuestionProsbaPrefill();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time board→prosba prefill
    setRequestKind("zamowienie");
    setValidationAttempted(false);
    setFormNotice({
      tone: "info",
      text: DEPARTMENT_BOARD_QUESTIONS_FORM.quickProsbaPrefillNotice,
    });
    setMsg(null);
    setZkProsbaLinkContext(null);
    setGroups([
      prefill.lines.map((line) => ({
        ...emptyEntry(lockedId),
        symbol: line.symbol,
        mikranCode: line.mikranCode,
        product: line.product,
        quantity: line.quantity,
        subiektTwId: line.subiektTwId ?? null,
        source: line.source ?? null,
        stockSource: line.stockSource ?? null,
      })),
    ]);
  }, [lockedId, searchParams, tourDemo]);

  const supplierRefs = useMemo(() => toAppSupplierRefs(suppliers), [suppliers]);

  const isProcurementGroupForm = !(singleGroup && lockedSalesPerson);

  const groupHasCatalogProduct = (group: Entry[]) =>
    group.some((e) => e.source === "catalog");

  const procurementCanSubmit = useMemo(() => {
    if (!isProcurementGroupForm) return false;

    const activeGroups = groups.filter((group) =>
      group.some((row) =>
        hasAnyProductHint({
          supplierId: group[0]?.supplierId,
          symbol: row.symbol,
          mikranCode: row.mikranCode,
          product: row.product,
        })
      )
    );
    if (activeGroups.length === 0) return false;

    return activeGroups.every((group) => {
      const supplierId = group[0]?.supplierId ?? "";
      const salesPersonId = lockedId || (group[0]?.salesPersonId ?? "");
      return buildProcurementFormReadiness({
        salesPersonId,
        supplierId,
        lines: group.map((row) => ({
          symbol: row.symbol,
          mikranCode: row.mikranCode,
          product: row.product,
          quantity: row.quantity,
          supplierId,
          subiektTwId: row.subiektTwId,
          teethDetails: row.teethDetails,
          teethManufacturer: row.teethManufacturer,
          teethProductLine: row.teethProductLine,
        })),
        requestKind,
        teethExemptTwIds,
        ...flagsFromInformacjaFlowPath(
          requestKind === "informacja" ? informacjaPath : "direct"
        ),
      }).canSubmit;
    });
  }, [groups, requestKind, informacjaPath, lockedId, isProcurementGroupForm, teethExemptTwIds]);

  const informacjaFlags = useMemo(
    () =>
      requestKind === "informacja"
        ? flagsFromInformacjaFlowPath(informacjaPath)
        : {
            informacjaQueueViaDailyPanel: false,
            informacjaStockOutReorder: false,
          },
    [requestKind, informacjaPath]
  );

  const applySupplierFromSubiekt = useCallback(
    (
      supplierId: string,
      groupIndex = 0
    ) => {
      setGroups((g) =>
        g.map((gr, i) =>
          i === groupIndex ? gr.map((row) => ({ ...row, supplierId })) : gr
        )
      );
    },
    [setGroups]
  );

  const performSubmit = (
    entries: (Entry & { requestNote?: string })[],
    options?: { acknowledgeSufficientStock?: boolean }
  ) => {
    setPendingMessage(
      singleGroup ? "Wysyłanie prośby…" : "Zapisywanie zamówień…"
    );
    if (pendingSafetyRef.current) window.clearTimeout(pendingSafetyRef.current);
    pendingSafetyRef.current = window.setTimeout(() => setPendingMessage(null), ACTION_PENDING_SAFETY_FORM_MS);
    start(async () => {
      const zkCtx = zkProsbaLinkContext;
      try {
        assertProsbaLinesBelongToZk(entries, zkCtx?.allowedTwIds);
        const r = await actionAddIndividualOrders({
          entries: entries.map((e) => ({
            supplierId: e.supplierId || undefined,
            salesPersonId: e.salesPersonId,
            symbol: e.symbol,
            mikranCode: e.mikranCode,
            product: e.product,
            quantity: requestKind === "informacja" ? undefined : e.quantity,
            requestKind,
            clientName: e.clientName,
            clientKhId: e.clientKhId,
            subiektTwId: e.subiektTwId,
            onHand: e.onHand,
            reserved: e.reserved,
            available: e.available,
            stockSource: e.stockSource,
            source: e.source,
            requestNote: e.requestNote || undefined,
            sourceZkWatchId: zkCtx?.zkWatchId ?? undefined,
            sourceZkNumber: zkCtx?.zkNumber ?? undefined,
            sourceZkLineKeys: zkCtx?.lineKeys?.length ? zkCtx.lineKeys : undefined,
            informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
            informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
            teethDetails: e.teethDetails ?? undefined,
            teethOcrPending: e.teethOcrPending ?? undefined,
            teethOcrImagePath: e.teethOcrImagePath ?? undefined,
          })),
          acknowledgeSufficientStock: options?.acknowledgeSufficientStock,
        });
        const defaultSuccessText =
          singleGroup && lockedSalesPerson
            ? requestKind === "informacja" && informacjaFlags.informacjaStockOutReorder
              ? "Prośba zapisana — sygnał „brak na stanie” trafi do zakupów w panelu Dziś (Prośby handlowców)."
              : requestKind === "informacja" && informacjaFlags.informacjaQueueViaDailyPanel
                ? "Prośba zapisana — zakupy najpierw zamówią u dostawcy, potem magazyn wyśle informację e-mailem."
                : formatSubmitResult(r, requestKind, true)
            : procurementSubmitSuccessMessage({
                count: r.count,
                requestKind,
                lanes: classifyProsbaLinesByLane(
                  entries.map((e) => ({ subiektTwId: e.subiektTwId })),
                  teethExemptTwIds
                ),
                informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
                informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
              });

        const stockOutHidden =
          requestKind === "informacja" && informacjaFlags.informacjaStockOutReorder;

        setMsg({
          title: "Prośba zapisana",
          text: zkCtx
            ? `Powiązano z ${zkCtx.zkNumber}.`
            : defaultSuccessText,
          tone: "success",
          actionHref: stockOutHidden
            ? undefined
            : zkCtx
              ? buildMojeClientLink(lockedId, zkCtx.clientLabel, {
                  preview: submitForOther,
                  clientKhId: zkCtx.clientKhId,
                  zkWatchId: zkCtx.zkWatchId,
                  zkNumber: zkCtx.zkNumber,
                })
              : submitForOther
                ? `/moje?dla=${lockedSalesPerson?.id ?? lockedId}`
                : "/moje",
          actionLabel: stockOutHidden
            ? undefined
            : zkCtx
              ? "Prośby tego klienta"
              : submitForOther
                ? "Prośby handlowca"
                : "Moje zamówienia",
        });
        if (zkCtx?.zkWatchId && lockedId) {
          if (zkCtx.mode === "supplement" && zkCtx.lineKeys?.length) {
            removeUnseenNewZkLineKeys(lockedId, zkCtx.zkWatchId, zkCtx.lineKeys);
          } else {
            clearUnseenNewZkLineKeys(lockedId, zkCtx.zkWatchId);
          }
        }
        setFormNotice(null);
        setValidationAttempted(false);
        setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
        setZkProsbaLinkContext(null);
        setGroups(buildInitialGroups(lockedId, initialSupplierId));
        setStockConfirmOpen(false);
        setStockConfirmKind(null);
      } catch (e) {
        handleProsbaStockSubmitError(
          e,
          (message) => {
            setStockConfirmMessage(message);
            setStockConfirmKind("stock");
            setStockConfirmOpen(true);
          },
          (message) => {
            setMsg({ text: message, tone: "error" });
          }
        );
      } finally {
        if (pendingSafetyRef.current) {
          window.clearTimeout(pendingSafetyRef.current);
          pendingSafetyRef.current = null;
        }
        setPendingMessage(null);
      }
    });
  };

  const runSubmitWithConfirms = (
    entries: (Entry & { requestNote?: string })[],
    ack: {
      acknowledgeSufficientStock?: boolean;
      acknowledgeZkQuantityMismatch?: boolean;
    } = {}
  ) => {
    const mergedAck = { ...pendingSubmitAckRef.current, ...ack };

    if (requestKind === "zamowienie" && !mergedAck.acknowledgeSufficientStock) {
      const stockConfirm = buildProsbaSubmitStockConfirm(entries, "zamowienie", teethExemptTwIds);
      if (stockConfirm) {
        pendingSubmitEntriesRef.current = entries;
        pendingSubmitAckRef.current = mergedAck;
        setStockConfirmTitle("Towar na stanie");
        setStockConfirmConfirmLabel("Wyślij mimo to");
        setStockConfirmMessage(stockConfirm.message);
        setStockConfirmKind("stock");
        setStockConfirmOpen(true);
        return;
      }
    }

    if (requestKind === "zamowienie" && !mergedAck.acknowledgeZkQuantityMismatch) {
      const zkConfirm = buildProsbaSubmitZkQuantityConfirm(entries, "zamowienie");
      if (zkConfirm) {
        pendingSubmitEntriesRef.current = entries;
        pendingSubmitAckRef.current = mergedAck;
        setStockConfirmTitle(zkConfirm.title);
        setStockConfirmConfirmLabel(zkConfirm.confirmLabel);
        setStockConfirmMessage(zkConfirm.message);
        setStockConfirmKind("zk_quantity");
        setStockConfirmOpen(true);
        return;
      }
    }

    pendingSubmitAckRef.current = {};
    performSubmit(entries, mergedAck);
  };

  const submit = () => {
    setFormNotice(null);

    if (readOnly) {
      setFormNotice(ADMIN_PREVIEW_NOTICE);
      return;
    }

    if (tourDemo) {
      setFormNotice({
        title: "Tryb podglądu",
        text: "Formularz nie wysyła prośby — to tylko demonstracja.",
        tone: "warning",
      });
      return;
    }

    if (singleGroup && lockedSalesPerson) {
      const group = groups[0] ?? emptyGroup(lockedId, initialSupplierId ?? undefined);
      const salesPlan = assessSalesGroupSubmittable(group, "", requestKind);
      if (!salesPlan?.submittable) {
        setValidationAttempted(true);
        setFormNotice({
          title: "Uzupełnij wymagane pola",
          text:
            requestKind === "informacja"
              ? "Podaj symbol, kod Mikran lub opis produktu."
              : "Podaj produkt (symbol, kod Mikran lub opis) i ilość przy każdej pozycji.",
          tone: "error",
        });
        return;
      }
      const teethBlocked = group.some((line) =>
        prosbaLineHasTeethBlockers(line, requestKind, { exemptTwIds: teethExemptTwIds })
      );
      if (teethBlocked) {
        setValidationAttempted(true);
        setFormNotice(REQUEST_EDIT_FORM.teethListIncomplete);
        return;
      }
    }

    if (!singleGroup && !lockedId) {
      const groupIssues: string[] = [];
      groups.forEach((group, gi) => {
        const supplierId = group[0]?.supplierId ?? "";
        const hasContent = group.some((e) =>
          hasAnyProductHint({
            supplierId,
            symbol: e.symbol,
            mikranCode: e.mikranCode,
            product: e.product,
          })
        );
        if (!hasContent) return;

        const salesPersonId = group[0]?.salesPersonId ?? "";
        if (!salesPersonId) {
          groupIssues.push(`Grupa ${gi + 1}: wybierz handlowca`);
        }
        if (
          requestKind === "zamowienie" &&
          group.some(
            (e) =>
              hasAnyProductHint({
                supplierId,
                symbol: e.symbol,
                mikranCode: e.mikranCode,
                product: e.product,
              }) &&
              !hasValidOrderQuantity(e.quantity, "zamowienie")
          )
        ) {
          groupIssues.push(`Grupa ${gi + 1}: uzupełnij ilość przy każdej pozycji`);
        }
      });
      if (groupIssues.length) {
        setFormNotice({
          title: "Formularz wymaga poprawek",
          text: groupIssues.join(". "),
          tone: "error",
        });
        return;
      }
    }

    const entries: (Entry & { requestNote?: string })[] = [];
    groups.forEach((group) => {
      const supplierId =
        singleGroup && lockedSalesPerson ? "" : (group[0]?.supplierId ?? "");
      const salesPersonId = lockedId || (group[0]?.salesPersonId ?? "");
      group.forEach((e) => {
        const draft = {
          supplierId: supplierId || e.supplierId,
          symbol: e.symbol,
          mikranCode: e.mikranCode,
          product: e.product,
        };
        if (!hasAnyProductHint(draft)) return;
        if (!salesPersonId && !lockedId) return;
        entries.push({
          ...e,
          supplierId: supplierId || e.supplierId,
          salesPersonId,
          requestNote: e.requestNote?.trim() || undefined,
        });
      });
    });
    if (!entries.length) {
      setValidationAttempted(true);
      setFormNotice({
        title: "Brak pozycji",
        text: lockedSalesPerson
          ? "Wpisz nazwę lub symbol produktu (kod Mikran obok)."
          : "Wpisz produkt (nazwa lub symbol) oraz wybierz handlowca.",
        tone: "error",
      });
      return;
    }
    if (
      requestKind === "zamowienie" &&
      entries.some((e) => !hasValidOrderQuantity(e.quantity, "zamowienie"))
    ) {
      setValidationAttempted(true);
      setFormNotice({
        title: "Brak ilości",
        text: "Każda pozycja zamówienia musi mieć ilość (liczba sztuk, np. 1).",
        tone: "error",
      });
      return;
    }

    if (!singleGroup || !lockedSalesPerson) {
      try {
        let lineNo = 0;
        for (const e of entries) {
          lineNo += 1;
          assertProcurementEntryComplete(
            {
              supplierId: e.supplierId,
              symbol: e.symbol,
              mikranCode: e.mikranCode,
              product: e.product,
              quantity: e.quantity,
              requestKind,
              subiektTwId: e.subiektTwId,
              informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
              informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
            },
            entries.length > 1 ? `Pozycja ${lineNo}` : undefined
          );
        }
      } catch (err) {
        setFormNotice({ text: userFacingErrorText(err, "Uzupełnij wymagane pola."), tone: "error" });
        return;
      }
    }

    if (
      requestKind === "zamowienie" &&
      entries.some((entry) =>
        prosbaLineHasTeethBlockers(entry, requestKind, { exemptTwIds: teethExemptTwIds })
      )
    ) {
      setValidationAttempted(true);
      setFormNotice(REQUEST_EDIT_FORM.teethListIncomplete);
      return;
    }

    runSubmitWithConfirms(entries);
  };
  useEffect(() => {
    submitRef.current = submit;
  });

  const addSalesProductLine = useCallback(() => {
    if (!singleGroup || !lockedSalesPerson) return;
    clearFormNotice();
    setGroups((g) => {
      const group = g[0] ?? emptyGroup(lockedId);
      const appended = appendProductLine(group);
      if (appended.length <= group.length) return g;
      const newLine = appended[appended.length - 1]!;
      const inheritClient = group[0];
      return [
        [
          ...group,
          {
            ...newLine,
            // W trybie sales each line resolves its own supplier from Subiekt.
            // Inherit only when not deferring (e.g. prefill z harmonogramu ?dostawca=).
            supplierId: deferSupplierResolve ? "" : (group[0]?.supplierId ?? ""),
            salesPersonId: lockedId,
            clientName: inheritClient?.clientName,
            clientKhId: inheritClient?.clientKhId ?? null,
          },
        ],
      ];
    });
  }, [
    singleGroup,
    lockedSalesPerson,
    lockedId,
    clearFormNotice,
    deferSupplierResolve,
    setGroups,
  ]);

  const addProcurementProductLine = useCallback(() => {
    if (singleGroup && lockedSalesPerson) return;
    clearFormNotice();
    setGroups((g) => {
      if (!g.length) return g;
      const gi = 0;
      const group = g[gi] ?? emptyGroup(lockedId);
      const appended = appendProductLine(group);
      if (appended.length <= group.length) return g;
      const newLine = appended[appended.length - 1]!;
      const inheritClient = group[0];
      return g.map((gr, i) =>
        i === gi
          ? [
              ...group,
              {
                ...newLine,
                supplierId: group[0]?.supplierId ?? "",
                salesPersonId: group[0]?.salesPersonId ?? lockedId,
                clientName: inheritClient?.clientName,
                clientKhId: inheritClient?.clientKhId ?? null,
              },
            ]
          : gr
      );
    });
  }, [singleGroup, lockedSalesPerson, lockedId, clearFormNotice, setGroups]);

  const setProcurementRequestKind = useCallback((kind: IndividualRequestKind) => {
    setRequestKind(kind);
    if (kind === "informacja") setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
    else setInformacjaPath("direct");
  }, [setRequestKind, setInformacjaPath]);

  const salesProsbaSubmitState = useMemo(() => {
    if (!singleGroup || !lockedSalesPerson) {
      return null;
    }
    const group = groups[0] ?? emptyGroup(lockedId, initialSupplierId ?? undefined);
    const salesSubmitPlan = assessSalesGroupSubmittable(group, "", requestKind);
    const prosbaReadiness = buildProsbaFormReadiness(group, requestKind, salesSubmitPlan, {
      resolvingSupplier,
      informacjaPath,
      teethExemptTwIds,
      zkAllowedTwIds: zkProsbaLinkContext?.allowedTwIds ?? undefined,
    });
    return {
      group,
      salesSubmitPlan,
      prosbaReadiness,
      canSubmit: prosbaReadiness.canSubmit && !resolvingSupplier,
    };
  }, [
    singleGroup,
    lockedSalesPerson,
    groups,
    lockedId,
    initialSupplierId,
    requestKind,
    resolvingSupplier,
    informacjaPath,
    teethExemptTwIds,
    zkProsbaLinkContext?.allowedTwIds,
  ]);

  const zkQuantityFormBanner = useMemo(() => {
    if (!zkProsbaLinkContext || tourDemo || requestKind !== "zamowienie") return null;

    const lines = groups[0] ?? [];
    return formatProsbaZkQuantityFormBanner(lines, requestKind);
  }, [zkProsbaLinkContext, tourDemo, requestKind, groups]);

  const zkCaseNoteStillOnLines = useMemo(() => {
    const note = zkProsbaLinkContext?.caseNote?.trim();
    if (!note || !zkProsbaLinkContext?.caseNoteIncluded) return false;
    return groups.some((group) =>
      group.some((line) => line.requestNote?.trim() === note)
    );
  }, [zkProsbaLinkContext?.caseNote, zkProsbaLinkContext?.caseNoteIncluded, groups]);

  useEffect(() => {
    if (!singleGroup || !lockedSalesPerson) return;

    const onKey = (e: KeyboardEvent) => {
      handleSalesProsbaKeyboardEvent(e, {
        pending,
        canSubmit: salesProsbaSubmitState?.canSubmit ?? false,
        locked: readOnly || tourDemo,
        onSubmit: () => submitRef.current(),
        onSetRequestKind: setRequestKind,
        onAddProductLine: addSalesProductLine,
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    singleGroup,
    lockedSalesPerson,
    pending,
    readOnly,
    tourDemo,
    addSalesProductLine,
    salesProsbaSubmitState?.canSubmit,
  ]);

  useEffect(() => {
    if (singleGroup && lockedSalesPerson) return;

    const onKey = (e: KeyboardEvent) => {
      handleProcurementProsbaKeyboardEvent(e, {
        pending,
        onSubmit: () => submitRef.current(),
        onSetRequestKind: setProcurementRequestKind,
        onAddProductLine: addProcurementProductLine,
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    singleGroup,
    lockedSalesPerson,
    pending,
    setProcurementRequestKind,
    addProcurementProductLine,
  ]);

  const removeGroup = (gi: number) => {
    setGroups((g) => (g.length <= 1 ? g : g.filter((_, i) => i !== gi)));
  };

  const updateGroupLines = (gi: number, lines: Entry[]) => {
    const groupSupplierId = groups[gi]?.[0]?.supplierId ?? "";
    const salesPersonId = groups[gi]?.[0]?.salesPersonId ?? lockedId;
    setGroups((g) =>
      g.map((gr, i) =>
        i === gi
          ? lines.map((line, lineIdx) => ({
              ...line,
              supplierId: deferSupplierResolve
                ? (line.supplierId || gr[lineIdx]?.supplierId || "")
                : groupSupplierId,
              salesPersonId,
            }))
          : gr
      )
    );
  };

  const toastSlot = msg ? (
    <NoticeToast
      notice={msg}
      onDismiss={dismissToast}
      action={
        msg.tone === "success" && singleGroup && lockedSalesPerson && msg.actionHref ? (
          <Link href={msg.actionHref}>
            <Button variant="secondary" className="w-full">
              {msg.actionLabel ?? "Moje zamówienia"}
            </Button>
          </Link>
        ) : undefined
      }
    />
  ) : null;

  const stockConfirmDialog = (
    <ProsbaStockConfirmDialog
      open={stockConfirmOpen}
      title={stockConfirmTitle}
      message={stockConfirmMessage}
      confirmLabel={stockConfirmConfirmLabel}
      pending={pending}
      onCancel={() => {
        setStockConfirmOpen(false);
        setStockConfirmKind(null);
        pendingSubmitEntriesRef.current = [];
        pendingSubmitAckRef.current = {};
      }}
      onConfirm={() => {
        setStockConfirmOpen(false);
        const entries = pendingSubmitEntriesRef.current;
        const prevAck = pendingSubmitAckRef.current;
        const kind = stockConfirmKind;
        setStockConfirmKind(null);
        if (kind === "stock") {
          runSubmitWithConfirms(entries, { ...prevAck, acknowledgeSufficientStock: true });
          return;
        }
        runSubmitWithConfirms(entries, { ...prevAck, acknowledgeZkQuantityMismatch: true });
      }}
    />
  );

  if (singleGroup && lockedSalesPerson) {
    const group = salesProsbaSubmitState?.group ?? emptyGroup(lockedId, initialSupplierId ?? undefined);
    const salesSubmitPlan = salesProsbaSubmitState?.salesSubmitPlan ?? null;
    const prosbaReadiness =
      salesProsbaSubmitState?.prosbaReadiness ??
      buildProsbaFormReadiness(group, requestKind, salesSubmitPlan, {
        resolvingSupplier,
        informacjaPath,
        teethExemptTwIds,
        zkAllowedTwIds: zkProsbaLinkContext?.allowedTwIds ?? undefined,
      });
    const canSubmitProsba = salesProsbaSubmitState?.canSubmit ?? false;
    const zkCatalogLocked = Boolean(zkProsbaLinkContext?.allowedTwIds?.size);
    /** Prefill z harmonogramu (?dostawca=) — pokazuj, dopóki Subiekt nie wskaże innego dostawcy. */
    const scheduleSupplier =
      initialSupplierId && group[0]?.supplierId === initialSupplierId
        ? suppliers.find((s) => s.id === initialSupplierId) ?? null
        : null;

    const vacationHits = collectProsbaVacationHits(group, suppliersOnVacationNow, {
      fallbackSupplierId: initialSupplierId,
      supplierNames: Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
    });
    const vacationNoticeModel = !tourDemo
      ? buildProsbaSupplierVacationNoticeModel(vacationHits)
      : null;

    const mojeHref = submitForOther ? `/moje?dla=${lockedSalesPerson.id}` : "/moje";
    const mojeLabel = submitForOther ? "Prośby handlowca" : "Moje zamówienia";

    return (
      <div className={cn("relative space-y-5", msg && "pb-44")}>
        {pendingMessage ? (
          <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
        ) : null}
        {toastSlot}
        {stockConfirmDialog}

        <ProsbaPageToolbar
          mojeHref={mojeHref}
          mojeLabel={mojeLabel}
          showProductZdLookup={!readOnly && !tourDemo}
          suppliers={suppliers}
          onProductStockOutPrefill={
            readOnly || tourDemo ? undefined : applyProductZdStockOutPrefill
          }
        />

        <Card
          padding={false}
          className={cn(
            zkProsbaLinkContext && !tourDemo ? "overflow-visible" : "overflow-hidden"
          )}
        >
          <div className={cn(tourDemo && "pointer-events-none select-none")}>
          <CardHeader
            inset
            density="compact"
            leading={
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconPlusCircle size={20} />
              </SectionHeadingIcon>
            }
            title={
              zkProsbaLinkContext && !tourDemo
                ? ZK_PROSBA_LINK_BANNER_COPY.formTitle
                : "Nowa prośba"
            }
            hint={submitForOther ? undefined : PROSBA_PAGE_HEADER_HINTS.newRequest}
            hintAriaLabel="O formularzu prośby"
            description={
              submitForOther
                ? `Zgłaszasz w imieniu: ${lockedSalesPerson.name}. Po wysłaniu prośba pojawi się w jego liście „Moje zamówienia”.`
                : zkProsbaLinkContext && !tourDemo
                  ? [
                      zkProsbaLinkContext.mode === "supplement"
                        ? ZK_PROSBA_LINK_BANNER_COPY.titleSupplement
                        : ZK_PROSBA_LINK_BANNER_COPY.titleFull,
                      `· ZK ${zkProsbaLinkContext.zkNumber.trim()}`,
                      zkProsbaLinkContext.clientLabel?.trim()
                        ? `· ${zkProsbaLinkContext.clientLabel.trim()}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : undefined
            }
          />

          {tourDemo ? (
            <div className="border-b border-amber-200/90 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950 sm:px-4">
              Podgląd formularza z przykładowymi pozycjami — edycja i wysyłka są wyłączone.
            </div>
          ) : null}

          {zkProsbaLinkContext && !tourDemo ? (
            <ZkProsbaLinkBanner
              zkNumber={zkProsbaLinkContext.zkNumber}
              zkWatchId={zkProsbaLinkContext.zkWatchId}
              salesPersonId={lockedId}
              previewDla={searchParams.get("dla")}
              clientLabel={zkProsbaLinkContext.clientLabel}
              mode={zkProsbaLinkContext.mode}
              supplementLineCount={zkProsbaLinkContext.supplementLineCount}
              catalogLocked={zkCatalogLocked}
              caseNoteIncluded={zkCaseNoteStillOnLines}
            />
          ) : null}

          {zkQuantityFormBanner ? (
            <div
              className="border-b border-indigo-200/80 bg-indigo-50/70 px-3 py-2.5 text-xs leading-relaxed text-indigo-950 sm:px-4"
              role="status"
            >
              {zkQuantityFormBanner}
            </div>
          ) : null}

          {scheduleSupplier && !tourDemo ? (
            <div
              className="border-b border-indigo-100 bg-indigo-50/90 px-3 py-2.5 text-sm text-indigo-950 sm:px-4"
              role="status"
            >
              <p className="leading-snug">
                <span className="font-medium">Dostawca z harmonogramu:</span>{" "}
                <span className="font-semibold text-indigo-900">
                  {scheduleSupplier.name}
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-indigo-800/85">
                Prośba trafi do tego dostawcy. Jeśli wybierzesz produkt z Subiekta
                przypisany do innego dostawcy, dopasowanie zaktualizuje się
                automatycznie.
              </p>
              {requestKind === "zamowienie" ? (
                <ProsbaSupplierLeadTimeMeta
                  className="mt-2"
                  supplierIds={[scheduleSupplier.id]}
                  suppliers={suppliers}
                  statsBySupplierId={statsBySupplierId}
                  showSupplierNames={false}
                />
              ) : null}
            </div>
          ) : null}

          {!tourDemo ? <ProsbaVsBoardHint /> : null}

          <ProsbaFormMetaStrip keyboardHints={SALES_PROSBA_KEYBOARD_HINTS} />

          <div
            className={cn(
              "space-y-3 p-3 sm:p-4",
              tourDemo && "pointer-events-none select-none"
            )}
          >
            {delegatePeople && delegatePeople.length > 0 ? (
              <ProsbaFormSection
                title={PROSBA_FORM_SECTION_COPY.delegate.title}
                hint={PROSBA_FORM_SECTION_COPY.delegate.hint}
                accent="indigo"
                icon={<IconUserCog size={17} />}
                tileClassName="bg-indigo-100 text-indigo-800"
              >
                <Field labelClassName="inline-flex min-h-6 items-center" label="Handlowiec">
                  <Select
                    value={lockedSalesPerson.id}
                    onChange={(e) => {
                      const id = e.target.value;
                      router.push(
                        prosbaHref({
                          salesPersonId:
                            managerSelfId && id === managerSelfId ? undefined : id,
                        })
                      );
                    }}
                  >
                    {delegatePeople.map((p) => (
                      <option key={p.id} value={p.id}>
                        {managerSelfId && p.id === managerSelfId
                          ? `${p.name} (ja)`
                          : p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </ProsbaFormSection>
            ) : null}

            <ProsbaFormRequestKindSection
              value={requestKind}
              disabled={pending || tourDemo}
              onChange={(kind) => {
                setRequestKind(kind);
                if (kind === "informacja") setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
                else setInformacjaPath("direct");
              }}
            />

            {requestKind === "informacja" ? (
              <ProsbaFormInformacjaSection
                path={informacjaPath}
                onChange={setInformacjaPath}
                disabled={pending || tourDemo}
              />
            ) : null}

            <ProsbaFormProductsSection
              requestKind={requestKind}
              informacjaPath={informacjaPath}
              showShortageLookup={prosbaLinesIncludeTeethProduct(group, teethExemptTwIds)}
              hint={
                zkCatalogLocked
                  ? ZK_PROSBA_LINK_BANNER_COPY.productsSectionHint
                  : requestKind === "informacja"
                    ? informacjaProductsFormHint(informacjaPath)
                    : PROSBA_FORM_SECTION_COPY.products.orderHint
              }
            >
              <div className="space-y-3">
                {vacationNoticeModel ? (
                  <ProsbaSupplierVacationNotice model={vacationNoticeModel} />
                ) : null}
                <RequestProductLinesEditor
                  lines={group}
                  onChange={(lines) => {
                    clearFormNotice();
                    updateGroupLines(0, lines as Entry[]);
                  }}
                  requestKind={requestKind}
                  appearance="prosba"
                  addLabel="+ Kolejny produkt"
                  showClientField
                  suppliers={supplierRefs}
                  deferSupplierResolve={deferSupplierResolve}
                  groupSupplierId={group[0]?.supplierId || initialSupplierId || ""}
                  formSuppliers={suppliers}
                  statsBySupplierId={statsBySupplierId}
                  showLinkedLeadTime={!tourDemo}
                  linkedLeadTimeOmitSupplierIds={
                    scheduleSupplier ? [scheduleSupplier.id] : undefined
                  }
                  allowedTwIds={zkProsbaLinkContext?.allowedTwIds ?? undefined}
                  allowedTwIdsHint={
                    zkCatalogLocked ? ZK_PROSBA_LINK_BANNER_COPY.typeaheadHint : undefined
                  }
                  lockSubiektLink={zkCatalogLocked}
                  onSupplierResolved={({ supplierId }) => {
                    if (!deferSupplierResolve) {
                      applySupplierFromSubiekt(supplierId, 0);
                    }
                  }}
                  onResolvingSupplierChange={setResolvingSupplier}
                  validationAttempted={validationAttempted}
                  liveValidation={!tourDemo}
                  onTeethListCommitNotice={(notice, tone = "success") =>
                    setMsg(
                      typeof notice === "string"
                        ? { text: notice, tone }
                        : { title: notice.title, text: notice.text, tone },
                    )
                  }
                />

                <ProsbaFormReadiness
                  lines={group}
                  requestKind={requestKind}
                  salesSubmitPlan={salesSubmitPlan}
                  formMessage={formNotice}
                  supplierId={group[0]?.supplierId || initialSupplierId || ""}
                  resolvingSupplier={resolvingSupplier}
                  informacjaPath={informacjaPath}
                  validationAttempted={validationAttempted}
                  teethExemptTwIds={teethExemptTwIds}
                  zkAllowedTwIds={zkProsbaLinkContext?.allowedTwIds ?? undefined}
                />
              </div>
            </ProsbaFormProductsSection>
          </div>

          <div
            className={cn(
              "flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/35 px-3 py-3 sm:flex-row sm:items-center sm:px-4",
              requestKind === "informacja" ? "sm:justify-between" : "sm:justify-end"
            )}
          >
            {requestKind === "informacja" ? (
              <p className="text-xs leading-relaxed text-slate-500">
                {informacjaSalesFooterNote(informacjaPath)}
              </p>
            ) : null}
            <Button
              disabled={pending || tourDemo || readOnly || !canSubmitProsba}
              onClick={submit}
              title={
                !canSubmitProsba && !pending && !tourDemo
                  ? prosbaReadiness.headline
                  : undefined
              }
              className="w-full shrink-0 sm:w-auto sm:min-w-[10rem]"
            >
              {tourDemo ? "Podgląd — bez wysyłki" : pending ? "Wysyłanie…" : "Wyślij prośbę"}
            </Button>
          </div>
          </div>
        </Card>

        <AppBrandContentFooter mobileOnly variant="page" />
      </div>
    );
  }

  return (
    <div className={cn("relative space-y-6", msg && "pb-44")}>
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {toastSlot}
      {stockConfirmDialog}

      <Card padding={false}>
        <CardHeader
          inset
          leading={
            <SectionHeadingIcon tileClassName="bg-violet-100 text-violet-800">
              <IconLayers size={20} />
            </SectionHeadingIcon>
          }
          title="Zamówienie grupowe"
          hint={PROSBA_PAGE_HEADER_HINTS.groupOrder}
          hintAriaLabel="O zamówieniu grupowym"
        />

        <ProsbaFormKeyboardStrip hints={PROCUREMENT_PROSBA_KEYBOARD_HINTS} variant="procurement" />

        <div className="space-y-3 p-3 sm:p-4">
          <ProsbaFormRequestKindSection
            value={requestKind}
            onChange={(kind) => {
              setRequestKind(kind);
              if (kind === "informacja") setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
              else setInformacjaPath("direct");
            }}
          />

          {requestKind === "informacja" ? (
            <ProsbaFormInformacjaSection
              path={informacjaPath}
              onChange={setInformacjaPath}
              disabled={pending}
              includeViaPanel
            />
          ) : null}
        </div>
      </Card>

      {groups.map((group, gi) => {
        const groupVacationModel = buildProsbaSupplierVacationNoticeModel(
          collectProsbaVacationHits(group, suppliersOnVacationNow, {
            fallbackSupplierId: group[0]?.supplierId || initialSupplierId,
            supplierNames: Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
          })
        );

        return (
        <Card key={gi} padding={false}>
          <CardHeader
            inset
            title={
              singleGroup && lockedSalesPerson
                ? submitForOther
                  ? `Prośba: ${lockedSalesPerson.name}`
                  : "Twoja prośba"
                : `Grupa ${gi + 1}`
            }
            hint={PROSBA_PAGE_HEADER_HINTS.groupCard}
            hintAriaLabel="O grupie produktów"
            description={
              lockedSalesPerson
                ? requestKind === "informacja"
                  ? `Handlowiec: ${lockedSalesPerson.name} · powiadomienie o stanie magazynowym`
                  : `Handlowiec: ${lockedSalesPerson.name}`
                : undefined
            }
            action={
              !singleGroup && groups.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-700 hover:bg-red-50"
                  onClick={() => removeGroup(gi)}
                >
                  Usuń grupę
                </Button>
              ) : null
            }
          />
          <div className="space-y-3 px-3 pb-4 sm:px-4">
            <div
              className={cn(
                "grid gap-3",
                lockedSalesPerson ? "sm:grid-cols-1" : "sm:grid-cols-2"
              )}
            >
              {lockedSalesPerson ? (
                <ProsbaFormSection
                  title={PROSBA_FORM_SECTION_COPY.delegate.title}
                  hint={
                    submitForOther
                      ? PROSBA_FORM_SECTION_COPY.delegate.hint
                      : "Prośba powiązana z Twoim kontem — nie trzeba wybierać z listy."
                  }
                  accent="indigo"
                  icon={<IconUserCog size={17} />}
                  tileClassName="bg-indigo-100 text-indigo-800"
                >
                  <p className="text-sm font-medium text-slate-900">{lockedSalesPerson.name}</p>
                </ProsbaFormSection>
              ) : null}
              {!lockedSalesPerson ? (
                <ProsbaFormSection
                  title={PROSBA_FORM_SECTION_COPY.delegateProcurement.title}
                  hint={PROSBA_FORM_SECTION_COPY.delegateProcurement.hint}
                  accent="indigo"
                  icon={<IconUserGroup size={17} />}
                  tileClassName="bg-indigo-100 text-indigo-800"
                  className="sm:col-span-2"
                >
                  <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                    <Field labelClassName="inline-flex min-h-6 items-center" label="Dla kogo (handlowiec)">
                      <Select
                        value={group[0]?.salesPersonId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setGroups((g) =>
                            g.map((gr, i) =>
                              i === gi
                                ? gr.map((row) => ({ ...row, salesPersonId: v }))
                                : gr
                            )
                          );
                        }}
                      >
                        <option value="">Wybierz osobę</option>
                        {salesPeople.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field labelClassName="inline-flex min-h-6 items-center" label="Dostawca">
                      <div className="space-y-1.5">
                        <SupplierPickerField
                          suppliers={suppliers}
                          value={group[0]?.supplierId ?? ""}
                          onChange={(v) => {
                            clearFormNotice();
                            setGroups((g) =>
                              g.map((gr, i) =>
                                i === gi ? gr.map((row) => ({ ...row, supplierId: v })) : gr
                              )
                            );
                          }}
                          allowEmpty
                          emptyLabel="Wybierz dostawcę"
                          disabled={
                            !isProcurementGroupForm && groupHasCatalogProduct(group)
                          }
                          placeholder="Szukaj dostawcy w systemie lub Subiekcie…"
                          showInlineFeedback={false}
                        />
                        {requestKind === "zamowienie" ? (
                          <ProsbaSupplierLeadTimeMeta
                            supplierIds={
                              group[0]?.supplierId?.trim()
                                ? [group[0].supplierId.trim()]
                                : []
                            }
                            suppliers={suppliers}
                            statsBySupplierId={statsBySupplierId}
                          />
                        ) : null}
                      </div>
                    </Field>
                  </div>
                </ProsbaFormSection>
              ) : (
                <Field labelClassName="inline-flex min-h-6 items-center" label="Dostawca">
                  <div className="space-y-1.5">
                    <SupplierPickerField
                      suppliers={suppliers}
                      value={group[0]?.supplierId ?? ""}
                      onChange={(v) => {
                        clearFormNotice();
                        setGroups((g) =>
                          g.map((gr, i) =>
                            i === gi ? gr.map((row) => ({ ...row, supplierId: v })) : gr
                          )
                        );
                      }}
                      disabled={
                        !isProcurementGroupForm && groupHasCatalogProduct(group)
                      }
                      allowEmpty
                      emptyLabel="Wybierz dostawcę"
                      placeholder="Szukaj dostawcy w systemie lub Subiekcie…"
                      showInlineFeedback={false}
                    />
                    {requestKind === "zamowienie" ? (
                      <ProsbaSupplierLeadTimeMeta
                        supplierIds={
                          group[0]?.supplierId?.trim()
                            ? [group[0].supplierId.trim()]
                            : []
                        }
                        suppliers={suppliers}
                        statsBySupplierId={statsBySupplierId}
                      />
                    ) : null}
                  </div>
                </Field>
              )}
            </div>

            <ProsbaFormProductsSection
              requestKind={requestKind}
              informacjaPath={informacjaPath}
              showShortageLookup={prosbaLinesIncludeTeethProduct(group, teethExemptTwIds)}
              hint={
                zkProsbaLinkContext?.allowedTwIds?.size
                  ? ZK_PROSBA_LINK_BANNER_COPY.productsSectionHint
                  : requestKind === "informacja"
                    ? informacjaProductsFormHint(informacjaPath)
                    : PROSBA_FORM_SECTION_COPY.products.orderHint
              }
            >
              <div className="space-y-3">
                {groupVacationModel ? (
                  <ProsbaSupplierVacationNotice model={groupVacationModel} />
                ) : null}
                <RequestProductLinesEditor
                  lines={group}
                  onChange={(lines) => {
                    clearFormNotice();
                    updateGroupLines(gi, lines as Entry[]);
                  }}
                  requestKind={requestKind}
                  appearance="prosba"
                  addLabel="+ Kolejny produkt w grupie"
                  showClientField={Boolean(lockedSalesPerson)}
                  suppliers={supplierRefs}
                  unifiedFeedback
                  groupSupplierId={group[0]?.supplierId ?? ""}
                  formSuppliers={suppliers}
                  statsBySupplierId={statsBySupplierId}
                  showLinkedLeadTime={false}
                  allowedTwIds={zkProsbaLinkContext?.allowedTwIds ?? undefined}
                  allowedTwIdsHint={
                    zkProsbaLinkContext?.allowedTwIds?.size
                      ? ZK_PROSBA_LINK_BANNER_COPY.typeaheadHint
                      : undefined
                  }
                  lockSubiektLink={Boolean(zkProsbaLinkContext?.allowedTwIds?.size)}
                  onSupplierResolved={({ supplierId }) =>
                    applySupplierFromSubiekt(supplierId, gi)
                  }
                  onSupplierMappingMissing={() =>
                    setGroups((g) =>
                      g.map((gr, i) =>
                        i === gi ? gr.map((row) => ({ ...row, supplierId: "" })) : gr
                      )
                    )
                  }
                  onResolvingSupplierChange={setResolvingSupplier}
                  validationAttempted={validationAttempted}
                  liveValidation
                  onTeethListCommitNotice={(notice, tone = "success") =>
                    setMsg(
                      typeof notice === "string"
                        ? { text: notice, tone }
                        : { title: notice.title, text: notice.text, tone },
                    )
                  }
                />

                <ProsbaFormReadiness
                  lines={group}
                  requestKind={requestKind}
                  salesSubmitPlan={
                    buildProsbaFormReadinessWithSupplier(
                      group,
                      group[0]?.supplierId ?? "",
                      requestKind,
                      {
                        informacjaPath,
                        resolvingSupplier,
                        zkAllowedTwIds: zkProsbaLinkContext?.allowedTwIds ?? undefined,
                      }
                    ).plan
                  }
                  formMessage={gi === 0 ? formNotice : null}
                  supplierId={group[0]?.supplierId ?? ""}
                  informacjaPath={informacjaPath}
                  resolvingSupplier={resolvingSupplier}
                  validationAttempted={validationAttempted}
                  zkAllowedTwIds={zkProsbaLinkContext?.allowedTwIds ?? undefined}
                />
              </div>
            </ProsbaFormProductsSection>
          </div>
        </Card>
        );
      })}

      <Card padding={false}>
        <div className="flex flex-col gap-3 bg-slate-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-relaxed text-slate-500">
            {requestKind === "informacja"
              ? informacjaFlags.informacjaStockOutReorder
                ? "Sygnały „brak na stanie” trafią do Prośb handlowców w panelu Dziś."
                : informacjaFlags.informacjaQueueViaDailyPanel
                  ? "Informacja przez panel Dziś — najpierw Główne/Uzupełniające, potem magazyn."
                  : "Powiadomienie o stanie magazynowym trafi od razu do kolejki magazynu."
              : "Zamówienia trafiają do panelu dziennego po zapisie kompletnych danych (dostawca, produkt z Subiekta lub ręcznie, ilość)."}
          </p>
          <div className="flex flex-wrap gap-2">
            {!singleGroup ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setGroups((g) => [...g, emptyGroup(lockedId)]);
                }}
              >
                <IconPlusCircle size={18} className="shrink-0" />
                Nowa grupa
              </Button>
            ) : null}
            <Button
              disabled={pending || readOnly || !procurementCanSubmit}
              onClick={submit}
            >
              {pending ? "Zapisywanie…" : "Zatwierdź wszystkie"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
