"use client";

import { useState, useTransition, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import type { IndividualRequestKind } from "@/types/database";
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
import { PROCUREMENT_TEAM_LABEL, PROCUREMENT_TEAM_LABEL_TITLE } from "@/lib/orders/procurement-copy";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import { buildOnboardingProsbaLines } from "@/lib/sales/sales-onboarding-demo-data";
import {
  actionGetZkProsbaPrefill,
  actionGetZkProsbaPrefillByWatchId,
} from "@/app/actions/sales-notepad";
import { ProsbaVsBoardHint } from "@/components/department-board/ProsbaVsBoardHint";
import { ZkProsbaLinkBanner } from "@/components/orders/ZkProsbaLinkBanner";
import { buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import {
  buildProsbaPrefillFromUrlParams,
  clearZkProsbaPrefill,
  parseProsbaZkLineKeysParam,
  readZkProsbaPrefill,
  type ZkProsbaPrefill,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { clearUnseenNewZkLineKeys, removeUnseenNewZkLineKeys } from "@/lib/client/zk-watch-new-lines-snapshot";
import { ProsbaStockConfirmDialog } from "@/components/orders/ProsbaStockConfirmDialog";
import { buildProsbaSubmitStockConfirm, buildProsbaSubmitZkQuantityConfirm, formatProsbaZkQuantityFormBanner, applyProsbaLineStockMap, collectProsbaLineTwIdsMissingStock } from "@/lib/orders/prosba-stock-check";
import { handleProsbaStockSubmitError } from "@/lib/orders/prosba-stock-submit-error";

function formatSubmitResult(
  r: {
    count: number;
    complete: number;
    verification: number;
  },
  requestKind: IndividualRequestKind,
  forSales?: boolean
): string {
  const { complete, verification } = r;
  if (forSales) {
    if (verification > 0 && complete === 0) {
      return "Prośba zapisana — dział zakupów dopracuje szczegóły. Śledź status w „Moje zamówienia”.";
    }
    if (verification > 0 && complete > 0) {
      return `Zapisano prośbę (${complete} od razu do realizacji, ${verification} do weryfikacji). Sprawdź „Moje zamówienia”.`;
    }
    return requestKind === "informacja"
      ? "Prośba o dostępność zapisana."
      : "Prośba zapisana.";
  }
  if (verification > 0 && complete > 0) {
    return `Zapisano ${complete} kompletnych i ${verification} do weryfikacji przez ${PROCUREMENT_TEAM_LABEL}.`;
  }
  if (verification > 0) {
    return `Przekazano ${verification} pozycji do weryfikacji — ${PROCUREMENT_TEAM_LABEL} uzupełni brakujące dane (dostawca, opis).`;
  }
  if (requestKind === "informacja") {
    return `Dodano ${complete} prośb(y) informacyjn(e). ${PROCUREMENT_TEAM_LABEL_TITLE} powiadomi Cię e-mailem, gdy towar będzie na magazynie.`;
  }
  return `Dodano ${complete} pozycji do panelu dziennego.`;
}

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
  zkQuantity?: number | null;
  requestNote?: string;
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { readOnly: panelReadOnly } = useAdminPanelPreview();
  const readOnly = forceReadOnly || panelReadOnly;
  const tourDemo = useSalesOnboardingDemo("prosba");
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
  const [msg, setMsg] = useState<{
    text: string;
    tone: "success" | "error";
    actionHref?: string;
    actionLabel?: string;
  } | null>(null);
  const dismissToast = useCallback(() => setMsg(null), []);
  const [resolvingSupplier, setResolvingSupplier] = useState(false);
  const deferSupplierResolve = Boolean(singleGroup && lockedSalesPerson);
  const [formNotice, setFormNotice] = useState<{
    text: string;
    tone: "error" | "warning";
  } | null>(null);
  /** Po prefill z ZK — link „Moje zamówienia” z tym samym filtrem co w notatniku. */
  const [zkProsbaLinkContext, setZkProsbaLinkContext] = useState<{
    zkWatchId: string | null;
    zkNumber: string;
    clientLabel: string;
    clientKhId: number | null;
    mode?: "full" | "supplement";
    supplementLineCount?: number;
    lineKeys?: string[];
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

  const clearFormNotice = useCallback(() => setFormNotice(null), []);

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
    [lockedId]
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
      if (!prefill.lines.length) return;
      const clientName = prefill.clientName?.trim() || "";
      const clientKhId = prefill.clientKhId ?? null;
      const nextRequestKind = prefill.requestKind ?? "zamowienie";
      setRequestKind(nextRequestKind);
      if (nextRequestKind === "informacja") {
        setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
      }
      setValidationAttempted(false);
      setFormNotice(null);
      setMsg(null);
      if (prefill.zkWatchId || prefill.zkNumber.trim()) {
        setZkProsbaLinkContext({
          zkWatchId: prefill.zkWatchId,
          zkNumber: prefill.zkNumber,
          clientLabel: clientName,
          clientKhId,
          mode: prefill.mode,
          supplementLineCount: prefill.supplementLineCount,
          lineKeys: prefill.lineKeys,
        });
      }
      let baseLines = prefill.lines.map((line) => ({
        id: line.id,
        supplierId: "",
        salesPersonId: lockedId,
        symbol: line.symbol,
        mikranCode: line.mikranCode,
        product: line.product,
        quantity: nextRequestKind === "informacja" ? "" : line.quantity,
        clientName: clientName || line.clientName,
        clientKhId: clientKhId ?? line.clientKhId ?? null,
        subiektTwId: line.subiektTwId ?? null,
        onHand: line.onHand,
        reserved: line.reserved,
        available: line.available,
        stockSource: line.stockSource,
        zkQuantity: line.zkQuantity ?? null,
      }));

      const twIds = collectProsbaLineTwIdsMissingStock(baseLines, nextRequestKind);
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
      if (fromStorage?.lines.length) {
        if (!cancelled) {
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
          if (!cancelled && fromWatch?.lines.length) {
            await applyZkPrefill(fromWatch);
            return;
          }
          if (!cancelled && zkLineKeys?.length) {
            setFormNotice({
              text: "Nie udało się wczytać wybranych pozycji ZK — uzupełnij prośbę ręcznie lub wróć do notatnika.",
              tone: "warning",
            });
            return;
          }
        }
        if (zk) {
          const fromServer = await actionGetZkProsbaPrefill(zk, delegateId || undefined);
          if (!cancelled && fromServer?.lines.length) {
            await applyZkPrefill(fromServer);
            return;
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFormNotice({
            text:
              err instanceof Error
                ? err.message
                : "Nie udało się wczytać danych ZK — uzupełnij prośbę ręcznie.",
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
  }, [lockedId, searchParams, tourDemo]);

  const supplierRefs = useMemo(() => toAppSupplierRefs(suppliers), [suppliers]);

  const isProcurementGroupForm = !(singleGroup && lockedSalesPerson);

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
        })),
        requestKind,
        ...flagsFromInformacjaFlowPath(
          requestKind === "informacja" ? informacjaPath : "direct"
        ),
      }).canSubmit;
    });
  }, [groups, requestKind, informacjaPath, lockedId, isProcurementGroupForm]);

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
    []
  );

  const performSubmit = (
    entries: (Entry & { requestNote?: string })[],
    options?: { acknowledgeSufficientStock?: boolean }
  ) => {
    setPendingMessage(
      singleGroup ? "Wysyłanie prośby…" : "Zapisywanie zamówień…"
    );
    start(async () => {
      const zkCtx = zkProsbaLinkContext;
      try {
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
            requestNote: e.requestNote || undefined,
            sourceZkWatchId: zkCtx?.zkWatchId ?? undefined,
            sourceZkNumber: zkCtx?.zkNumber ?? undefined,
            informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
            informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
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
            : requestKind === "informacja"
              ? informacjaFlags.informacjaStockOutReorder
                ? `Dodano ${r.count} sygnał(ów) „brak na stanie” — w panelu Dziś (Prośby handlowców).`
                : informacjaFlags.informacjaQueueViaDailyPanel
                  ? `Dodano ${r.count} prośb(y) informacyjn(e) — najpierw kolejka Dziś (Główne/Uzupełniające).`
                  : `Dodano ${r.count} prośb(y) informacyjn(e) — od razu do kolejki magazynu.`
              : `Dodano ${r.count} pozycji do panelu dziennego.`;

        const stockOutHidden =
          requestKind === "informacja" && informacjaFlags.informacjaStockOutReorder;

        setMsg({
          text: zkCtx
            ? `Prośba zapisana i powiązana z ${zkCtx.zkNumber}.`
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
      const stockConfirm = buildProsbaSubmitStockConfirm(entries, "zamowienie");
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
      setFormNotice({ text: ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED, tone: "warning" });
      return;
    }

    if (tourDemo) {
      setFormNotice({
        text: "To tylko podgląd wprowadzenia — w tourze formularz nie wysyła prośby.",
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
          text:
            requestKind === "informacja"
              ? "Uzupełnij wymagane pola — symbol, kod Mikran lub opis produktu."
              : "Uzupełnij wymagane pola — produkt (symbol, kod Mikran lub opis) i ilość przy każdej pozycji.",
          tone: "error",
        });
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
        setFormNotice({ text: groupIssues.join(". "), tone: "error" });
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
        setFormNotice({
          text: err instanceof Error ? err.message : "Uzupełnij wymagane pola.",
          tone: "error",
        });
        return;
      }
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
            // Dziedziczy dostawcę grupy (np. prefill z harmonogramu ?dostawca=).
            supplierId: group[0]?.supplierId ?? "",
            salesPersonId: lockedId,
            clientName: inheritClient?.clientName,
            clientKhId: inheritClient?.clientKhId ?? null,
          },
        ],
      ];
    });
  }, [singleGroup, lockedSalesPerson, lockedId, clearFormNotice]);

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
  }, [singleGroup, lockedSalesPerson, lockedId, clearFormNotice]);

  const setProcurementRequestKind = useCallback((kind: IndividualRequestKind) => {
    setRequestKind(kind);
    if (kind === "informacja") setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
    else setInformacjaPath("direct");
  }, []);

  const salesProsbaSubmitState = useMemo(() => {
    if (!singleGroup || !lockedSalesPerson) {
      return null;
    }
    const group = groups[0] ?? emptyGroup(lockedId, initialSupplierId ?? undefined);
    const salesSubmitPlan = assessSalesGroupSubmittable(group, "", requestKind);
    const prosbaReadiness = buildProsbaFormReadiness(group, requestKind, salesSubmitPlan, {
      resolvingSupplier,
      informacjaPath,
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
  ]);

  const zkQuantityFormBanner = useMemo(() => {
    if (!zkProsbaLinkContext || tourDemo || requestKind !== "zamowienie") return null;
    const lines = groups[0] ?? [];
    return formatProsbaZkQuantityFormBanner(lines, requestKind);
  }, [zkProsbaLinkContext, tourDemo, requestKind, groups]);

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
    const supplierId = groups[gi]?.[0]?.supplierId ?? "";
    const salesPersonId = groups[gi]?.[0]?.salesPersonId ?? lockedId;
    setGroups((g) =>
      g.map((gr, i) =>
        i === gi
          ? lines.map((line) => ({
              ...line,
              supplierId,
              salesPersonId,
            }))
          : gr
      )
    );
  };

  const toastSlot = msg ? (
    <Toast
      message={msg.text}
      tone={msg.tone}
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
      });
    const canSubmitProsba = salesProsbaSubmitState?.canSubmit ?? false;
    /** Prefill z harmonogramu (?dostawca=) — pokazuj, dopóki Subiekt nie wskaże innego dostawcy. */
    const scheduleSupplier =
      initialSupplierId && group[0]?.supplierId === initialSupplierId
        ? suppliers.find((s) => s.id === initialSupplierId) ?? null
        : null;

    const mojeHref = submitForOther ? `/moje?dla=${lockedSalesPerson.id}` : "/moje";
    const mojeLabel = submitForOther ? "Prośby handlowca" : "Moje zamówienia";

    return (
      <div className="relative space-y-5">
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

        <Card padding={false} className="overflow-hidden">
          <div className={cn(tourDemo && "pointer-events-none select-none")}>
          <CardHeader
            inset
            density="compact"
            leading={
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconPlusCircle size={20} />
              </SectionHeadingIcon>
            }
            title="Nowa prośba"
            hint={submitForOther ? undefined : PROSBA_PAGE_HEADER_HINTS.newRequest}
            hintAriaLabel="O formularzu prośby"
            description={
              submitForOther
                ? `Zgłaszasz w imieniu: ${lockedSalesPerson.name}. Po wysłaniu prośba pojawi się w jego liście „Moje zamówienia”.`
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
            />
          ) : null}

          {zkQuantityFormBanner ? (
            <div
              className="border-b border-indigo-200/80 bg-indigo-50/70 px-3 py-2 text-xs leading-relaxed text-indigo-950 sm:px-4"
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
              hint={
                requestKind === "informacja"
                  ? informacjaProductsFormHint(informacjaPath)
                  : PROSBA_FORM_SECTION_COPY.products.orderHint
              }
            >
              <div className="space-y-3">
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
                  onSupplierResolved={({ supplierId }) =>
                    applySupplierFromSubiekt(supplierId, 0)
                  }
                  onResolvingSupplierChange={setResolvingSupplier}
                  validationAttempted={validationAttempted}
                  liveValidation={!tourDemo}
                />

                <ProsbaFormReadiness
                  lines={group}
                  requestKind={requestKind}
                  salesSubmitPlan={salesSubmitPlan}
                  formMessage={formNotice}
                  resolvingSupplier={resolvingSupplier}
                  informacjaPath={informacjaPath}
                  validationAttempted={validationAttempted}
                />
              </div>
            </ProsbaFormProductsSection>
          </div>

          <div
            className={cn(
              "flex flex-col gap-2.5 border-t border-slate-200/80 bg-slate-50/35 px-3 py-3 sm:flex-row sm:items-center sm:px-4",
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
    <div className="relative space-y-6">
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

      {groups.map((group, gi) => (
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
                  ? `Handlowiec: ${lockedSalesPerson.name} · informacja o dostępności`
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
                  className={lockedSalesPerson ? undefined : "sm:col-span-2"}
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
                        placeholder="Szukaj dostawcy w systemie lub Subiekcie…"
                        showInlineFeedback={false}
                      />
                    </Field>
                  </div>
                </ProsbaFormSection>
              ) : (
                <Field labelClassName="inline-flex min-h-6 items-center" label="Dostawca">
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
                    placeholder="Szukaj dostawcy w systemie lub Subiekcie…"
                    showInlineFeedback={false}
                  />
                </Field>
              )}
            </div>

            <ProsbaFormProductsSection
              requestKind={requestKind}
              informacjaPath={informacjaPath}
              hint={
                requestKind === "informacja"
                  ? informacjaProductsFormHint(informacjaPath)
                  : PROSBA_FORM_SECTION_COPY.products.orderHint
              }
            >
              <div className="space-y-3">
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
                />

                <ProsbaFormReadiness
                  lines={group}
                  requestKind={requestKind}
                  salesSubmitPlan={
                    buildProsbaFormReadinessWithSupplier(
                      group,
                      group[0]?.supplierId ?? "",
                      requestKind,
                      { informacjaPath, resolvingSupplier }
                    ).plan
                  }
                  formMessage={gi === 0 ? formNotice : null}
                  informacjaPath={informacjaPath}
                  resolvingSupplier={resolvingSupplier}
                  validationAttempted={validationAttempted}
                />
              </div>
            </ProsbaFormProductsSection>
          </div>
        </Card>
      ))}

      <Card padding={false}>
        <div className="flex flex-col gap-3 bg-slate-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-relaxed text-slate-500">
            {requestKind === "informacja"
              ? informacjaFlags.informacjaStockOutReorder
                ? "Sygnały „brak na stanie” trafią do Prośb handlowców w panelu Dziś."
                : informacjaFlags.informacjaQueueViaDailyPanel
                  ? "Informacja przez panel Dziś — najpierw Główne/Uzupełniające, potem magazyn."
                  : "Informacja o dostępności trafi od razu do kolejki magazynu."
              : "Zamówienia trafiają do panelu dziennego po zapisie kompletnych danych (dostawca, produkt z Subiekta lub ręcznie, ilość)."}
          </p>
          <div className="flex flex-wrap gap-2">
            {!singleGroup ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setGroups((g) => [...g, emptyGroup(lockedId)]);
                }}
              >
                + Nowa grupa
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
