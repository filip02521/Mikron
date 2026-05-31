"use client";

import { useState, useTransition, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import type { DeliveryStats, IndividualRequestKind, StatsMode } from "@/types/database";
import { RequestKindToggle } from "@/components/orders/RequestKindToggle";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { prosbaHref } from "@/lib/orders/prosba-url";
import { IconLayers, IconPlusCircle } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import { hasAnyProductHint, hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import { assessProcurementGroupCompleteness, buildProcurementFormReadiness } from "@/lib/orders/procurement-form-readiness";
import { InformacjaFlowPicker } from "@/components/orders/InformacjaFlowPicker";
import type { RequestCompleteness } from "@/lib/orders/request-completeness";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import { assessSalesGroupSubmittable } from "@/lib/orders/sales-request-submit";
import { RequestFormStatusPanel } from "@/components/orders/RequestFormStatusPanel";
import { ProsbaFormReadiness } from "@/components/orders/ProsbaFormReadiness";
import { RequestProductLinesEditor } from "@/components/orders/RequestProductLinesEditor";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { newProductLine, appendProductLine } from "@/components/orders/request-product-lines";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
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
  clearZkProsbaPrefill,
  readZkProsbaPrefill,
} from "@/lib/orders/zk-watch-prosba-prefill";

function groupCompletenessAssessment(
  group: Entry[],
  requestKind: IndividualRequestKind
): RequestCompleteness | null {
  return assessProcurementGroupCompleteness(
    group.map((row) => ({
      symbol: row.symbol,
      mikranCode: row.mikranCode,
      product: row.product,
      quantity: row.quantity,
      supplierId: row.supplierId,
      subiektTwId: row.subiektTwId,
    })),
    group[0]?.supplierId ?? "",
    requestKind
  );
}

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
  subiektTwId?: number | null;
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
  statsBySupplierId = {},
  lockedSalesPerson,
  singleGroup = false,
  submitForOther = false,
  initialSupplierId,
  delegatePeople,
  managerSelfId,
}: {
  suppliers: { id: string; name: string; stats_mode?: StatsMode; subiekt_kh_id?: number | null }[];
  salesPeople: { id: string; name: string }[];
  statsBySupplierId?: Record<string, DeliveryStats>;
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tourDemo = useSalesOnboardingDemo("prosba");
  const lockedId = lockedSalesPerson?.id ?? "";
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [informacjaViaDailyPanel, setInformacjaViaDailyPanel] = useState(false);
  const [groups, setGroups] = useState<Entry[][]>(() =>
    buildInitialGroups(lockedId, initialSupplierId)
  );
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismissToast = useCallback(() => setMsg(null), []);
  const [supplierSubiektFeedback, setSupplierSubiektFeedback] =
    useState<SubiektFeedback | null>(null);
  const [supplierPickerFeedbacks, setSupplierPickerFeedbacks] = useState<SubiektFeedback[]>(
    []
  );
  const [productLineFeedback, setProductLineFeedback] = useState<SubiektFeedback | null>(
    null
  );
  const [configFeedback, setConfigFeedback] = useState<SubiektFeedback | null>(null);
  const [resolvingSupplier, setResolvingSupplier] = useState(false);
  const deferSupplierResolve = Boolean(singleGroup && lockedSalesPerson);
  const [formNotice, setFormNotice] = useState<{
    text: string;
    tone: "error" | "warning";
  } | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  const clearFormNotice = useCallback(() => setFormNotice(null), []);

  useEffect(() => {
    if (!tourDemo || !lockedId) return;
    setGroups([buildOnboardingProsbaLines(lockedId)]);
    setRequestKind("zamowienie");
    setValidationAttempted(false);
    setFormNotice(null);
    setMsg(null);
  }, [lockedId, tourDemo]);

  useEffect(() => {
    if (tourDemo || !searchParams.get("fromZk")) return;
    const prefill = readZkProsbaPrefill();
    if (!prefill?.lines.length) return;
    clearZkProsbaPrefill();
    setRequestKind("zamowienie");
    setValidationAttempted(false);
    setFormNotice(null);
    setMsg(null);
    setGroups([
      prefill.lines.map((line) => ({
        id: line.id,
        supplierId: "",
        salesPersonId: lockedId,
        symbol: line.symbol,
        mikranCode: line.mikranCode,
        product: line.product,
        quantity: line.quantity,
        clientName: prefill.clientName || line.clientName,
        subiektTwId: line.subiektTwId ?? null,
      })),
    ]);
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
        informacjaViaDailyPanel,
      }).canSubmit;
    });
  }, [groups, requestKind, informacjaViaDailyPanel, lockedId, isProcurementGroupForm]);

  const applySupplierFromSubiekt = useCallback(
    (
      supplierId: string,
      groupIndex = 0
    ) => {
      setSupplierSubiektFeedback(null);
      setGroups((g) =>
        g.map((gr, i) =>
          i === groupIndex ? gr.map((row) => ({ ...row, supplierId })) : gr
        )
      );
    },
    []
  );

  const submit = () => {
    setFormNotice(null);

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

    const entries: Entry[] = [];
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
        });
      });
    });
    if (!entries.length) {
      setValidationAttempted(true);
      setFormNotice({
        text: lockedSalesPerson
          ? "Podaj symbol, kod Mikran lub opis produktu."
          : "Podaj symbol, kod Mikran lub opis produktu oraz wybierz handlowca.",
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
              informacjaQueueViaDailyPanel:
                requestKind === "informacja" && informacjaViaDailyPanel,
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

    setPendingMessage(
      singleGroup ? "Wysyłanie prośby…" : "Zapisywanie zamówień…"
    );
    start(async () => {
      try {
        const r = await actionAddIndividualOrders(
          entries.map((e) => ({
            supplierId: e.supplierId || undefined,
            salesPersonId: e.salesPersonId,
            symbol: e.symbol,
            mikranCode: e.mikranCode,
            product: e.product,
            quantity: requestKind === "informacja" ? undefined : e.quantity,
            requestKind,
            clientName: e.clientName,
            subiektTwId: e.subiektTwId,
            informacjaQueueViaDailyPanel:
              requestKind === "informacja" && informacjaViaDailyPanel,
          }))
        );
        setMsg({
          text:
            singleGroup && lockedSalesPerson
              ? formatSubmitResult(r, requestKind, true)
              : requestKind === "informacja"
                ? informacjaViaDailyPanel
                  ? `Dodano ${r.count} prośb(y) informacyjn(e) — najpierw kolejka Dziś (Główne/Uzupełniające).`
                  : `Dodano ${r.count} prośb(y) informacyjn(e) — od razu do kolejki magazynu.`
                : `Dodano ${r.count} pozycji do panelu dziennego.`,
          tone: "success",
        });
        setFormNotice(null);
        setValidationAttempted(false);
        setInformacjaViaDailyPanel(false);
        setSupplierSubiektFeedback(null);
        setProductLineFeedback(null);
        setGroups(buildInitialGroups(lockedId, initialSupplierId));
      } catch (e) {
        setMsg({
          text: e instanceof Error ? e.message : "Błąd",
          tone: "error",
        });
      } finally {
        setPendingMessage(null);
      }
    });
  };
  submitRef.current = submit;

  const addSalesProductLine = useCallback(() => {
    if (!singleGroup || !lockedSalesPerson) return;
    clearFormNotice();
    setGroups((g) => {
      const group = g[0] ?? emptyGroup(lockedId);
      const appended = appendProductLine(group);
      if (appended.length <= group.length) return g;
      const newLine = appended[appended.length - 1]!;
      return [
        [
          ...group,
          {
            ...newLine,
            supplierId: "",
            salesPersonId: lockedId,
          },
        ],
      ];
    });
  }, [singleGroup, lockedSalesPerson, lockedId, clearFormNotice]);

  useEffect(() => {
    if (!singleGroup || !lockedSalesPerson) return;

    const onKey = (e: KeyboardEvent) => {
      handleSalesProsbaKeyboardEvent(e, {
        pending,
        onSubmit: () => submitRef.current(),
        onSetRequestKind: setRequestKind,
        onAddProductLine: addSalesProductLine,
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [singleGroup, lockedSalesPerson, pending, addSalesProductLine]);

  useEffect(() => {
    if (singleGroup && lockedSalesPerson) return;

    const onKey = (e: KeyboardEvent) => {
      handleProcurementProsbaKeyboardEvent(e, {
        pending,
        onSubmit: () => submitRef.current(),
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [singleGroup, lockedSalesPerson, pending]);

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
        msg.tone === "success" && singleGroup && lockedSalesPerson ? (
          <Link
            href={submitForOther ? `/moje?dla=${lockedSalesPerson.id}` : "/moje"}
          >
            <Button variant="secondary" className="w-full">
              {submitForOther ? "Prośby handlowca" : "Moje zamówienia"}
            </Button>
          </Link>
        ) : undefined
      }
    />
  ) : null;

  if (singleGroup && lockedSalesPerson) {
    const group = groups[0] ?? emptyGroup(lockedId, initialSupplierId ?? undefined);
    // Prośba handlowca: dostawca nie jest wybierany ręcznie.
    const supplierId = "";
    const salesSubmitPlan = assessSalesGroupSubmittable(group, supplierId, requestKind);

    return (
      <div className="relative">
        {pendingMessage ? (
          <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
        ) : null}
        {toastSlot}

        <Card padding={false}>
          <div className={cn(tourDemo && "pointer-events-none select-none")}>
          <CardHeader
            inset
            leading={
              <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
                <IconPlusCircle size={20} />
              </SectionHeadingIcon>
            }
            title="Nowa prośba"
            description={
              submitForOther
                ? `Zgłaszasz w imieniu: ${lockedSalesPerson.name}. Po wysłaniu prośba pojawi się w jego liście „Moje zamówienia”.`
                : "Jeden formularz — wybierz rodzaj prośby i produkty. Dostawcę dobierzemy automatycznie albo uzupełni dział zakupów."
            }
          />

          {tourDemo ? (
            <div className="border-b border-amber-200/90 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-950 sm:px-6">
              Podgląd formularza z przykładowymi pozycjami — edycja i wysyłka są wyłączone.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-6">
            <span className="shrink-0 text-xs font-medium text-slate-600">Skróty klawiszowe</span>
            <KeyboardShortcutsHint items={[...SALES_PROSBA_KEYBOARD_HINTS]} compact />
          </div>

          <div
            className={cn(
              "space-y-8 px-4 py-6 sm:px-6",
              tourDemo && "pointer-events-none select-none"
            )}
          >
            {delegatePeople && delegatePeople.length > 0 ? (
              <ProsbaFormSection
                title="W czyim imieniu?"
                hint="Kierownik może złożyć prośbę dla handlowca z zespołu."
              >
                <Field label="Handlowiec">
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

            <ProsbaFormSection
              title="Co chcesz zgłosić?"
              hint="Wybierz jedną opcję — pola poniżej dopasują się do rodzaju prośby."
            >
              <RequestKindToggle value={requestKind} onChange={setRequestKind} />
            </ProsbaFormSection>

            <ProsbaFormSection
              title="Produkty"
              hint={
                requestKind === "informacja"
                  ? "Wystarczy symbol, kod Mikran lub opis — bez ilości. Dostawcę dobierzemy automatycznie albo uzupełni dział zakupów."
                  : "Podaj symbol, kod Mikran lub opis oraz ilość. Dostawcę dobierzemy automatycznie albo uzupełni dział zakupów."
              }
            >
              <div className="space-y-4">
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
                />

                <ProsbaFormReadiness
                  lines={group}
                  requestKind={requestKind}
                  salesSubmitPlan={salesSubmitPlan}
                  formMessage={formNotice}
                  resolvingSupplier={resolvingSupplier}
                />
              </div>
            </ProsbaFormSection>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-relaxed text-slate-500">
              Po wysłaniu sprawdź status w{" "}
              <Link
                href={submitForOther ? `/moje?dla=${lockedSalesPerson.id}` : "/moje"}
                className="font-medium text-indigo-700 hover:underline"
              >
                {submitForOther ? "Prośby handlowca" : "Moje zamówienia"}
              </Link>
              . O ważnych zmianach dostaniesz też e-mail.
            </p>
            <Button
              disabled={pending || tourDemo}
              onClick={submit}
              className={cn(
                "w-full shrink-0 sm:w-auto sm:min-w-[10rem]",
                !pending && salesSubmitPlan?.submittable === false && "opacity-90"
              )}
            >
              {tourDemo ? "Podgląd — bez wysyłki" : pending ? "Wysyłanie…" : "Wyślij prośbę"}
            </Button>
          </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {toastSlot}

      <Card padding={false}>
        <CardHeader
          inset
          leading={
            <SectionHeadingIcon tileClassName="bg-violet-100 text-violet-800">
              <IconLayers size={20} />
            </SectionHeadingIcon>
          }
          title="Zamówienie grupowe"
          description="Wiele produktów w jednej lub kilku grupach — jeden dostawca i handlowiec na grupę."
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-6">
          <span className="shrink-0 text-xs font-medium text-slate-600">Skróty klawiszowe</span>
          <KeyboardShortcutsHint items={[...PROCUREMENT_PROSBA_KEYBOARD_HINTS]} compact />
        </div>

        <div className="space-y-6 border-b border-slate-100 px-4 py-5 sm:px-6">
          <ProsbaFormSection
            title="Rodzaj prośby"
            hint="Zamówienie u dostawcy albo tylko informacja o dostępności na magazynie"
          >
            <RequestKindToggle
              value={requestKind}
              onChange={(kind) => {
                setRequestKind(kind);
                if (kind !== "informacja") setInformacjaViaDailyPanel(false);
              }}
            />
          </ProsbaFormSection>

          {requestKind === "informacja" ? (
            <InformacjaFlowPicker
              viaDailyPanel={informacjaViaDailyPanel}
              onChange={setInformacjaViaDailyPanel}
              disabled={pending}
              name="informacja-path-group"
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
            description={
              lockedSalesPerson
                ? requestKind === "informacja"
                  ? `Zgłaszasz jako ${lockedSalesPerson.name} — powiadomienie o dostępności na magazynie`
                  : `Zgłaszasz jako ${lockedSalesPerson.name} — wybierz dostawcę i produkty`
                : requestKind === "informacja"
                  ? "Powiadomienie — bez składania zamówienia u dostawcy"
                  : "Jeden dostawca i handlowiec — wiele produktów"
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
          <div className="space-y-4 px-6 pb-6">
            <div
              className={cn(
                "grid gap-3",
                lockedSalesPerson ? "sm:grid-cols-1" : "sm:grid-cols-2"
              )}
            >
              {lockedSalesPerson ? (
                <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-slate-800">
                  <span className="font-medium text-slate-900">Dla kogo: </span>
                  {lockedSalesPerson.name}
                  <span className="mt-1 block text-xs text-slate-600">
                    {submitForOther
                      ? "Prośba pojawi się w liście „Moje zamówienia” tego handlowca."
                      : "Powiązane z Twoim kontem — nie trzeba wybierać z listy."}
                  </span>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Field label="Dostawca">
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
                    onSubiektFeedbackChange={setSupplierPickerFeedbacks}
                  />
                </Field>
              </div>
              {!lockedSalesPerson ? (
                <Field label="Dla kogo (handlowiec)">
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
              ) : null}
            </div>

            <RequestProductLinesEditor
              lines={group}
              onChange={(lines) => {
                clearFormNotice();
                updateGroupLines(gi, lines as Entry[]);
              }}
              requestKind={requestKind}
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
              onSupplierResolveFeedback={setSupplierSubiektFeedback}
              onProductFeedbackChange={setProductLineFeedback}
              onConfigFeedbackChange={setConfigFeedback}
              onResolvingSupplierChange={setResolvingSupplier}
            />

            <RequestFormStatusPanel
              requestKind={requestKind}
              draft={{
                supplierId: group[0]?.supplierId,
                symbol: group.find((r) => r.symbol.trim())?.symbol,
                mikranCode: group.find((r) => r.mikranCode.trim())?.mikranCode,
                product: group.find((r) => r.product.trim())?.product,
                quantity: group.find((r) => r.quantity.trim())?.quantity,
                requestKind,
              }}
              forcedAssessment={groupCompletenessAssessment(group, requestKind)}
              subiektFeedbacks={[
                configFeedback,
                ...supplierPickerFeedbacks,
                supplierSubiektFeedback,
                productLineFeedback,
              ]}
              resolvingSupplier={resolvingSupplier}
              leadTime={
                requestKind === "zamowienie" && group[0]?.supplierId
                  ? {
                      stats: statsBySupplierId[group[0].supplierId],
                      statsMode:
                        suppliers.find((s) => s.id === group[0]?.supplierId)?.stats_mode ??
                        "LACZNIE",
                    }
                  : null
              }
              scheduleHint={
                initialSupplierId &&
                group[0]?.supplierId === initialSupplierId &&
                suppliers.some((s) => s.id === initialSupplierId)
                  ? `Wybrany z harmonogramu: ${suppliers.find((s) => s.id === initialSupplierId)?.name ?? ""}`
                  : null
              }
              formMessage={gi === 0 ? formNotice : null}
              audience="procurement"
            />
          </div>
        </Card>
      ))}

      <Card padding={false}>
        <div className="flex flex-col gap-3 bg-slate-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-relaxed text-slate-500">
            Zamówienia trafiają do panelu dziennego po zapisie kompletnych danych (dostawca, produkt z
            Subiekta lub ręcznie, ilość).
          </p>
          <div className="flex flex-wrap gap-2">
            {!singleGroup ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => setGroups((g) => [...g, emptyGroup(lockedId)])}
              >
                + Nowa grupa
              </Button>
            ) : null}
            <Button disabled={pending || !procurementCanSubmit} onClick={submit}>
              {pending ? "Zapisywanie…" : "Zatwierdź wszystkie"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
