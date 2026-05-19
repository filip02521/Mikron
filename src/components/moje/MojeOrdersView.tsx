"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  filterMyOrderRows,
  type MyOrderInboxFilter,
} from "@/lib/orders/my-order-inbox-filter";
import { summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import { MyOrderArchiveSection } from "@/components/moje/MyOrderArchiveSection";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { MyOrdersInboxSummary } from "@/components/moje/MyOrdersInboxSummary";
import { MojeOrdersGuide } from "@/components/moje/MojeOrdersGuide";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

function cardDomId(rowId: string) {
  return `moje-card-${rowId}`;
}

export function MojeOrdersView({
  zamowienia,
  informacje,
  archiwumRecent = [],
  archiwumExtended = [],
  productLineCount,
  canAcknowledge = false,
  showProsbaCta = false,
  suppliers = [],
}: {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  archiwumRecent?: MyOrderRow[];
  archiwumExtended?: MyOrderRow[];
  productLineCount?: number;
  canAcknowledge?: boolean;
  showProsbaCta?: boolean;
  suppliers?: { id: string; name: string }[];
}) {
  const [activeFilter, setActiveFilter] = useState<MyOrderInboxFilter | null>(null);

  const allRows = useMemo(
    () => [...zamowienia, ...informacje],
    [zamowienia, informacje]
  );
  const filteredZamowienia = useMemo(
    () => filterMyOrderRows(zamowienia, activeFilter),
    [zamowienia, activeFilter]
  );
  const filteredInformacje = useMemo(
    () => filterMyOrderRows(informacje, activeFilter),
    [informacje, activeFilter]
  );

  const shipmentCount = zamowienia.length + informacje.length;
  const filteredCount = filteredZamowienia.length + filteredInformacje.length;
  const lineCount =
    productLineCount ??
    zamowienia.reduce((n, r) => n + r.lineCount, 0) +
      informacje.reduce((n, r) => n + r.lineCount, 0);

  const inboxSummary = summarizeMyOrdersInbox(allRows);

  useEffect(() => {
    if (!activeFilter || filteredCount === 0) return;
    const first =
      filteredZamowienia[0]?.id ?? filteredInformacje[0]?.id;
    if (!first) return;
    const el = document.getElementById(cardDomId(first));
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeFilter, filteredCount, filteredZamowienia, filteredInformacje]);

  if (!shipmentCount) {
    return (
      <div className="space-y-6">
        <MojeOrdersGuide pickupCount={0} />
        <EmptyState
          title="Brak aktywnych prośb"
          description="Zgłoś prośbę — tutaj zobaczysz status i powiadomienie, gdy towar będzie do odbioru."
          action={
            showProsbaCta ? (
              <Link href="/prosba">
                <Button>Zgłoś pierwszą prośbę</Button>
              </Link>
            ) : undefined
          }
        />
        <MyOrderArchiveSection
          rowsRecent={archiwumRecent}
          rowsExtended={archiwumExtended}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MojeOrdersGuide pickupCount={inboxSummary.pickupCount} />

      <MyOrdersInboxSummary
        summary={inboxSummary}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {activeFilter && filteredCount === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Brak kart w tej kategorii.{" "}
          <button
            type="button"
            className="cursor-pointer font-medium text-indigo-600 underline"
            onClick={() => setActiveFilter(null)}
          >
            Pokaż całą listę
          </button>
        </p>
      ) : null}

      <Card padding={false}>
        <CardHeader
          inset
          title="Zamówienia u dostawcy"
          description={
            activeFilter
              ? `${filteredZamowienia.length} z ${zamowienia.length} · filtr aktywny`
              : zamowienia.length
                ? `${zamowienia.length} ${zamowienia.length === 1 ? "dostawa" : "dostaw"} · ${lineCount} ${lineCount === 1 ? "produkt" : "produktów"} — rozwiń kartę po szczegóły i akcje`
                : "Brak aktywnych zamówień"
          }
        />
        {filteredZamowienia.length > 0 ? (
          <MyOrderShipmentList
            rows={filteredZamowienia}
            showProgress
            canAcknowledge={canAcknowledge}
            cardIdPrefix={cardDomId}
            suppliers={suppliers}
          />
        ) : !zamowienia.length ? (
          <div className="p-6">
            <EmptyState
              title="Brak zamówień u dostawcy"
              description="Zgłoś prośbę typu „Zamówienie u dostawcy” — pojawi się tutaj z terminem i postępem."
            />
          </div>
        ) : null}
      </Card>

      {informacje.length ? (
        <Card padding={false} className="border-sky-200">
          <CardHeader
            inset
            title="Tylko informacja o dostępności"
            description={
              activeFilter
                ? `${filteredInformacje.length} z ${informacje.length} · filtr aktywny`
                : `${informacje.length} ${informacje.length === 1 ? "prośba" : "prośby"} — e-mail gdy towar dotrze, bez zamawiania u dostawcy`
            }
          />
          {filteredInformacje.length ? (
            <MyOrderShipmentList
              rows={filteredInformacje}
              showProgress={false}
              canAcknowledge={canAcknowledge}
              cardIdPrefix={cardDomId}
              suppliers={suppliers}
            />
          ) : activeFilter ? (
            <p className="px-4 pb-4 text-sm text-slate-500">
              Brak prośb informacyjnych w tej kategorii.
            </p>
          ) : null}
        </Card>
      ) : null}

      <MyOrderArchiveSection
        rowsRecent={archiwumRecent}
        rowsExtended={archiwumExtended}
      />
    </div>
  );
}
