"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  filterMyOrderRows,
  type MyOrderInboxFilter,
} from "@/lib/orders/my-order-inbox-filter";
import { sortMyOrderRows, summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import { MyOrderArchiveSection } from "@/components/moje/MyOrderArchiveSection";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { MyOrdersInboxSummary } from "@/components/moje/MyOrdersInboxSummary";
import { MojeOrdersHelp } from "@/components/moje/MojeOrdersGuide";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

function cardDomId(rowId: string) {
  return `moje-card-${rowId}`;
}

function ListSectionLabel({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      {count !== undefined && count > 0 ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
          {count}
        </span>
      ) : null}
    </div>
  );
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

  const sortedZamowienia = useMemo(() => sortMyOrderRows(zamowienia), [zamowienia]);
  const sortedInformacje = useMemo(() => sortMyOrderRows(informacje), [informacje]);

  const filteredZamowienia = useMemo(
    () => filterMyOrderRows(sortedZamowienia, activeFilter),
    [sortedZamowienia, activeFilter]
  );
  const filteredInformacje = useMemo(
    () => filterMyOrderRows(sortedInformacje, activeFilter),
    [sortedInformacje, activeFilter]
  );

  const allRows = useMemo(
    () => [...sortedZamowienia, ...sortedInformacje],
    [sortedZamowienia, sortedInformacje]
  );
  const inboxSummary = summarizeMyOrdersInbox(allRows);

  const shipmentCount = zamowienia.length + informacje.length;
  const filteredCount = filteredZamowienia.length + filteredInformacje.length;
  const lineCount =
    productLineCount ??
    zamowienia.reduce((n, r) => n + r.lineCount, 0) +
      informacje.reduce((n, r) => n + r.lineCount, 0);

  useEffect(() => {
    if (!activeFilter || filteredCount === 0) return;
    const first = filteredZamowienia[0]?.id ?? filteredInformacje[0]?.id;
    if (!first) return;
    document.getElementById(cardDomId(first))?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeFilter, filteredCount, filteredZamowienia, filteredInformacje]);

  if (!shipmentCount) {
    return (
      <div className="space-y-5">
        <EmptyState
          title="Brak aktywnych prośb"
          description="Zgłoś prośbę — tutaj zobaczysz status i powiadomienie o odbiorze."
          action={
            showProsbaCta ? (
              <Link href="/prosba">
                <Button>Zgłoś prośbę</Button>
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

  const activeDescription = activeFilter
    ? `${filteredCount} z ${shipmentCount} · filtr włączony`
    : `${shipmentCount} ${shipmentCount === 1 ? "dostawa" : "dostaw"} · ${lineCount} ${lineCount === 1 ? "pozycja" : "pozycji"}`;

  return (
    <div className="space-y-5">
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          title="Aktywne prośby"
          description={activeDescription}
          action={<MojeOrdersHelp />}
        />

        <MyOrdersInboxSummary
          summary={inboxSummary}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {inboxSummary.pickupCount > 0 && !activeFilter ? (
          <p className="border-b border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-900 sm:px-4">
            {inboxSummary.pickupCount === 1
              ? "1 dostawa do odbioru — użyj „Potwierdź odbiór” na wierszu lub rozwiń kartę."
              : `${inboxSummary.pickupCount} dostaw do odbioru — filtr „Odbiór” pokaże tylko te pozycje.`}
          </p>
        ) : null}

        {activeFilter && filteredCount === 0 ? (
          <p className="border-b border-slate-100 px-3 py-3 text-sm text-slate-600 sm:px-4">
            Brak w tej kategorii.{" "}
            <button
              type="button"
              className="font-medium text-indigo-600 underline"
              onClick={() => setActiveFilter(null)}
            >
              Pokaż wszystkie
            </button>
          </p>
        ) : null}

        {filteredZamowienia.length > 0 ? (
          <>
            {informacje.length > 0 ? (
              <ListSectionLabel title="Zamówienia u dostawcy" count={filteredZamowienia.length} />
            ) : null}
            <MyOrderShipmentList
              rows={filteredZamowienia}
              showProgress
              canAcknowledge={canAcknowledge}
              cardIdPrefix={cardDomId}
              suppliers={suppliers}
            />
          </>
        ) : null}

        {filteredInformacje.length > 0 ? (
          <>
            <ListSectionLabel
              title="Tylko informacja o dostępności"
              count={filteredInformacje.length}
            />
            <MyOrderShipmentList
              rows={filteredInformacje}
              showProgress={false}
              canAcknowledge={canAcknowledge}
              cardIdPrefix={cardDomId}
              suppliers={suppliers}
            />
          </>
        ) : informacje.length > 0 && activeFilter ? null : null}
      </Card>

      <MyOrderArchiveSection
        rowsRecent={archiwumRecent}
        rowsExtended={archiwumExtended}
      />
    </div>
  );
}
