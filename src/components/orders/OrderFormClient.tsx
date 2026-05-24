"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { Field, Select } from "@/components/ui/Field";
import type { DeliveryStats, IndividualRequestKind, StatsMode } from "@/types/database";
import { SupplierLeadTimeHint } from "@/components/orders/SupplierLeadTimeHint";
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
}) {
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

  return (
    <div className="relative space-y-6">
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {msg ? (
        <Toast
          message={msg.text}
          tone={msg.tone}
          onDismiss={dismissToast}
          action={
            msg.tone === "success" && singleGroup && lockedSalesPerson ? (
              <Link
                href={
                  submitForOther
                    ? `/moje?dla=${lockedSalesPerson.id}`
                    : "/moje"
                }
              >
                <Button variant="secondary" className="w-full">
                  {submitForOther ? "Panel handlowca" : "Moje zamówienia"}
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : null}

      <Card>
        <CardHeader
          title="Rodzaj prośby"
          description="Wybierz, czy zamawiamy u dostawcy, czy tylko informujemy o dostawie na magazyn"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 sm:w-auto sm:min-w-[min(100%,18rem)]">
            <input
              type="radio"
              name="requestKind"
              checked={requestKind === "zamowienie"}
              onChange={() => setRequestKind("zamowienie")}
            />
            <span className="text-sm font-medium text-slate-800">
              Zamówienie u dostawcy
            </span>
          </label>
          <label className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-xl border border-sky-200 px-4 py-3 has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50 sm:w-auto sm:min-w-[min(100%,18rem)]">
            <input
              type="radio"
              name="requestKind"
              checked={requestKind === "informacja"}
              onChange={() => setRequestKind("informacja")}
            />
            <span className="text-sm font-medium text-slate-800">
              Informacja gdy dotarło na magazyn
              <span className="mt-0.5 block text-xs font-normal text-sky-800/80">
                Bez ilości — tylko czy towar jest na stanie
              </span>
            </span>
          </label>
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
                  <Select
                    value={group[0]?.supplierId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGroups((g) =>
                        g.map((gr, i) =>
                          i === gi ? gr.map((row) => ({ ...row, supplierId: v })) : gr
                        )
                      );
                    }}
                  >
                    <option value="">Wybierz dostawcę</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
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

      <div className="flex flex-wrap gap-3">
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
          {pending ? "Zapisywanie…" : singleGroup ? "Wyślij prośbę" : "Zatwierdź wszystkie"}
        </Button>
      </div>
    </div>
  );
}
