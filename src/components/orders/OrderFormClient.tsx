"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import type { DeliveryStats, IndividualRequestKind, StatsMode } from "@/types/database";
import { SupplierLeadTimeHint } from "@/components/orders/SupplierLeadTimeHint";
import { RequestKindToggle } from "@/components/orders/RequestKindToggle";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { prosbaHref } from "@/lib/orders/prosba-url";
import { IconLayers, IconPlusCircle } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import {
  assessRequestCompleteness,
  hasAnyProductHint,
  hasValidOrderQuantity,
  type RequestCompleteness,
} from "@/lib/orders/request-completeness";
import { RequestCompletenessBanner } from "@/components/orders/RequestCompletenessBanner";
import { RequestProductLinesEditor } from "@/components/orders/RequestProductLinesEditor";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { newProductLine } from "@/components/orders/request-product-lines";

function groupCompletenessAssessment(
  group: Entry[],
  requestKind: IndividualRequestKind
): RequestCompleteness | null {
  const supplierId = group[0]?.supplierId;
  let anyHint = false;
  for (const row of group) {
    const draft = {
      supplierId,
      symbol: row.symbol,
      product: row.product,
      quantity: row.quantity,
      requestKind,
    };
    if (!hasAnyProductHint(draft)) continue;
    anyHint = true;
    if (assessRequestCompleteness(draft) === "incomplete") return "incomplete";
  }
  return anyHint ? "complete" : null;
}

function formatSubmitResult(
  r: { count: number; complete: number; verification: number },
  requestKind: IndividualRequestKind,
  forSales?: boolean
): string {
  const { complete, verification } = r;
  if (forSales) {
    if (verification > 0 && complete === 0) {
      return "Prośba przekazana do uzupełnienia przez dział dostaw.";
    }
    if (verification > 0 && complete > 0) {
      return `Zapisano ${complete} kompletnych i ${verification} do uzupełnienia — śledź status w „Moje zamówienia”.`;
    }
    return requestKind === "informacja"
      ? "Prośba o dostępność zapisana."
      : "Prośba zapisana.";
  }
  if (verification > 0 && complete > 0) {
    return `Zapisano ${complete} kompletnych i ${verification} do weryfikacji przez dział dostaw.`;
  }
  if (verification > 0) {
    return `Przekazano ${verification} pozycji do weryfikacji — zakupy uzupełnią brakujące dane (dostawca, opis).`;
  }
  if (requestKind === "informacja") {
    return `Dodano ${complete} prośb(y) informacyjn(e). Dział dostaw powiadomi Cię e-mailem, gdy towar będzie na magazynie.`;
  }
  return `Dodano ${complete} pozycji do panelu dziennego.`;
}

interface Entry {
  id: string;
  supplierId: string;
  salesPersonId: string;
  symbol: string;
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
  suppliers: { id: string; name: string; stats_mode?: StatsMode }[];
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
  const lockedId = lockedSalesPerson?.id ?? "";
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [groups, setGroups] = useState<Entry[][]>(() =>
    buildInitialGroups(lockedId, initialSupplierId)
  );
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismissToast = useCallback(() => setMsg(null), []);

  const submit = () => {
    const entries: Entry[] = [];
    groups.forEach((group) => {
      const supplierId = group[0]?.supplierId ?? "";
      const salesPersonId = lockedId || (group[0]?.salesPersonId ?? "");
      group.forEach((e) => {
        const draft = {
          supplierId: supplierId || e.supplierId,
          symbol: e.symbol,
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
      setMsg({
        text: lockedSalesPerson
          ? "Podaj symbol lub opis produktu."
          : "Podaj symbol lub opis produktu oraz wybierz handlowca.",
        tone: "error",
      });
      return;
    }
    if (
      requestKind === "zamowienie" &&
      entries.some((e) => !hasValidOrderQuantity(e.quantity, "zamowienie"))
    ) {
      setMsg({
        text: "Każda pozycja zamówienia musi mieć ilość (liczba sztuk, np. 1).",
        tone: "error",
      });
      return;
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
            product: e.product,
            quantity: requestKind === "informacja" ? undefined : e.quantity,
            requestKind,
            clientName: e.clientName,
            subiektTwId: e.subiektTwId,
          }))
        );
        setMsg({
          text: formatSubmitResult(r, requestKind, Boolean(singleGroup && lockedSalesPerson)),
          tone: "success",
        });
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
              {submitForOther ? "Panel handlowca" : "Moje zamówienia"}
            </Button>
          </Link>
        ) : undefined
      }
    />
  ) : null;

  if (singleGroup && lockedSalesPerson) {
    const group = groups[0] ?? emptyGroup(lockedId, initialSupplierId ?? undefined);
    const supplierId = group[0]?.supplierId ?? "";
    const supplierFromPlan =
      initialSupplierId &&
      supplierId === initialSupplierId &&
      suppliers.some((s) => s.id === initialSupplierId);

    return (
      <div className="relative">
        {pendingMessage ? (
          <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
        ) : null}
        {toastSlot}

        <Card padding={false} className="overflow-hidden">
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
                ? `Zgłaszasz w imieniu: ${lockedSalesPerson.name}. Po wysłaniu prośba pojawi się na jego panelu.`
                : "Jeden formularz — rodzaj prośby, dostawca i produkty. Status śledzisz w Moje zamówienia."
            }
          />

          <div className="space-y-8 px-4 py-6 sm:px-6">
            {delegatePeople && delegatePeople.length > 0 && managerSelfId ? (
              <ProsbaFormSection
                title="W czyim imieniu?"
                hint="Kierownik może złożyć prośbę dla handlowca z zespołu."
              >
                <Field label="Handlowiec">
                  <Select
                    value={lockedSalesPerson.id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const dostawca = searchParams.get("dostawca") ?? undefined;
                      router.push(
                        prosbaHref({
                          salesPersonId: id === managerSelfId ? undefined : id,
                          supplierId: dostawca,
                        })
                      );
                    }}
                  >
                    {delegatePeople.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id === managerSelfId ? `${p.name} (ja)` : p.name}
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
              title="Dostawca i produkty"
              hint={
                requestKind === "informacja"
                  ? "Wystarczy symbol lub opis — bez ilości. Dostawcę możesz pominąć, dział dostaw uzupełni."
                  : "Podaj symbol lub opis oraz ilość. Dostawcę możesz wybrać teraz lub zostawić do uzupełnienia."
              }
            >
              <div className="space-y-4">
                <Field label="Dostawca (opcjonalnie)">
                  <SupplierPickerField
                    suppliers={suppliers}
                    value={supplierId}
                    onChange={(v) => {
                      setGroups((g) =>
                        g.map((gr, i) =>
                          i === 0 ? gr.map((row) => ({ ...row, supplierId: v })) : gr
                        )
                      );
                    }}
                    allowEmpty
                    emptyLabel="Wybierz później / nie wiem"
                  />
                </Field>
                {supplierFromPlan ? (
                  <p className="text-xs font-medium text-indigo-700">
                    Z harmonogramu:{" "}
                    {suppliers.find((s) => s.id === initialSupplierId)?.name}
                  </p>
                ) : null}

                {requestKind === "zamowienie" && supplierId ? (
                  <SupplierLeadTimeHint
                    compact
                    stats={statsBySupplierId[supplierId]}
                    statsMode={
                      suppliers.find((s) => s.id === supplierId)?.stats_mode ?? "LACZNIE"
                    }
                  />
                ) : null}

                <RequestProductLinesEditor
                  lines={group}
                  onChange={(lines) => updateGroupLines(0, lines as Entry[])}
                  requestKind={requestKind}
                  appearance="prosba"
                  addLabel="+ Kolejny produkt"
                  showClientField
                />

                <RequestCompletenessBanner
                  draft={{
                    supplierId,
                    symbol: group.find((r) => r.symbol.trim())?.symbol,
                    product: group.find((r) => r.product.trim())?.product,
                    quantity: group.find((r) => r.quantity.trim())?.quantity,
                    requestKind,
                  }}
                  requestKind={requestKind}
                  forcedAssessment={groupCompletenessAssessment(group, requestKind)}
                />
              </div>
            </ProsbaFormSection>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-relaxed text-slate-500">
              Po wysłaniu sprawdź status w{" "}
              <Link href="/moje" className="font-medium text-indigo-700 hover:underline">
                Moje zamówienia
              </Link>
              . O ważnych zmianach dostaniesz też e-mail.
            </p>
            <Button
              disabled={pending}
              onClick={submit}
              className="w-full shrink-0 sm:w-auto sm:min-w-[10rem]"
            >
              {pending ? "Wysyłanie…" : "Wyślij prośbę"}
            </Button>
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

      <Card padding={false} className="overflow-hidden">
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

        <div className="space-y-6 border-b border-slate-100 px-4 py-5 sm:px-6">
          <ProsbaFormSection
            title="Rodzaj prośby"
            hint="Zamówienie u dostawcy albo tylko informacja o dostępności na magazynie"
          >
            <RequestKindToggle value={requestKind} onChange={setRequestKind} />
          </ProsbaFormSection>
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
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-slate-800">
                  <span className="font-medium text-slate-900">Dla kogo: </span>
                  {lockedSalesPerson.name}
                  <span className="mt-1 block text-xs text-slate-600">
                    {submitForOther
                      ? "Prośba pojawi się na panelu tego handlowca."
                      : "Powiązane z Twoim kontem — nie trzeba wybierać z listy."}
                  </span>
                </div>
              ) : null}
              <div>
                <Field label="Dostawca (opcjonalnie przy weryfikacji)">
                  <SupplierPickerField
                    suppliers={suppliers}
                    value={group[0]?.supplierId ?? ""}
                    onChange={(v) => {
                      setGroups((g) =>
                        g.map((gr, i) =>
                          i === gi ? gr.map((row) => ({ ...row, supplierId: v })) : gr
                        )
                      );
                    }}
                    allowEmpty
                    emptyLabel="Wybierz dostawcę"
                    placeholder="Szukaj dostawcy w systemie lub Subiekcie…"
                  />
                </Field>
                {initialSupplierId &&
                group[0]?.supplierId === initialSupplierId &&
                suppliers.some((s) => s.id === initialSupplierId) ? (
                  <p className="mt-1 text-xs font-medium text-indigo-700">
                    Wybrany z harmonogramu:{" "}
                    {suppliers.find((s) => s.id === initialSupplierId)?.name}
                  </p>
                ) : null}
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

            {requestKind === "zamowienie" && group[0]?.supplierId ? (
              <SupplierLeadTimeHint
                stats={statsBySupplierId[group[0].supplierId]}
                statsMode={
                  suppliers.find((s) => s.id === group[0]?.supplierId)?.stats_mode ??
                  "LACZNIE"
                }
              />
            ) : null}

            <RequestCompletenessBanner
              draft={{
                supplierId: group[0]?.supplierId,
                symbol: group.find((r) => r.symbol.trim())?.symbol,
                product: group.find((r) => r.product.trim())?.product,
                quantity: group.find((r) => r.quantity.trim())?.quantity,
                requestKind,
              }}
              requestKind={requestKind}
              forcedAssessment={groupCompletenessAssessment(group, requestKind)}
            />

            <RequestProductLinesEditor
              lines={group}
              onChange={(lines) => updateGroupLines(gi, lines as Entry[])}
              requestKind={requestKind}
              addLabel="+ Kolejny produkt w grupie"
              showClientField={Boolean(lockedSalesPerson)}
            />
          </div>
        </Card>
      ))}

      <Card padding={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 bg-slate-50/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-relaxed text-slate-500">
            Po zapisie prośby trafią do weryfikacji lub panelu dziennego — zależnie od kompletności
            danych.
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
            <Button disabled={pending} onClick={submit}>
              {pending ? "Zapisywanie…" : "Zatwierdź wszystkie"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
