"use client";

import { useEffect, useMemo, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  filterMyOrderRows,
  partitionMyOrderRowsBySalesAction,
  type MyOrderInboxFilter,
} from "@/lib/orders/my-order-inbox-filter";
import { sortMyOrderRows, summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import { MyOrderArchiveSection } from "@/components/moje/MyOrderArchiveSection";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { MyOrdersInboxSummary } from "@/components/moje/MyOrdersInboxSummary";
import { MojeOrdersHelp } from "@/components/moje/MojeOrdersGuide";
import { MojeOrdersEmptyGuide } from "@/components/moje/MojeOrdersEmptyGuide";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconClipboardList,
  IconPackageCheck,
  MojeSectionIcon,
  type MojeSectionIconKind,
  mojeSectionIconTileClass,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { brandLinkSubtleClass, sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import { SubiektStatusBar } from "@/components/subiekt/SubiektStatusBar";
import type { SubiektAvailability } from "@/lib/subiekt/availability";

function cardDomId(rowId: string) {
  return `moje-card-${rowId}`;
}

const MOJE_INTRO =
  "Tu widzisz, co dzieje się z Twoimi prośbami — co jest do odbioru, co czeka u dostawcy i co tylko monitorujemy.";

function formatProsbaCount(n: number): string {
  if (n === 1) return "1 prośba";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} prośby`;
  return `${n} prośb`;
}

function ListSectionLabel({
  title,
  hint,
  count,
  accent,
  icon,
}: {
  title: string;
  hint?: string;
  count?: number;
  accent?: "emerald";
  icon: MojeSectionIconKind;
}) {
  return (
    <div
      className={
        accent === "emerald"
          ? "flex items-start justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3 py-2.5 sm:px-4"
          : "flex items-start justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4"
      }
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <SectionHeadingIcon tileClassName={mojeSectionIconTileClass(icon)}>
          <MojeSectionIcon kind={icon} size={17} />
        </SectionHeadingIcon>
        <div className="min-w-0">
        <h3
          className={
            accent === "emerald"
              ? "text-xs font-semibold uppercase tracking-wide text-emerald-900"
              : "text-xs font-semibold uppercase tracking-wide text-slate-600"
          }
        >
          {title}
        </h3>
        {hint ? (
          <p
            className={
              accent === "emerald"
                ? "mt-1 text-xs leading-relaxed text-emerald-800/90"
                : "mt-1 text-xs leading-relaxed text-slate-500"
            }
          >
            {hint}
          </p>
        ) : null}
        </div>
      </div>
      {count !== undefined && count > 0 ? (
        <span
          className={
            accent === "emerald"
              ? "shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-900"
              : "shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600"
          }
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}

function MyOrderShipmentBlock({
  rows,
  listKind,
  showProgress,
  canAcknowledge,
  suppliers,
}: {
  rows: MyOrderRow[];
  listKind: "zamowienie" | "informacja";
  showProgress: boolean;
  canAcknowledge: boolean;
  suppliers: { id: string; name: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <MyOrderShipmentList
      rows={rows}
      listKind={listKind}
      showProgress={showProgress}
      canAcknowledge={canAcknowledge}
      cardIdPrefix={cardDomId}
      suppliers={suppliers}
    />
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
  pageTitle = "Moje zamówienia",
  pageDescription,
  headerActions,
  subiektAvailability,
}: {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  archiwumRecent?: MyOrderRow[];
  archiwumExtended?: MyOrderRow[];
  productLineCount?: number;
  canAcknowledge?: boolean;
  showProsbaCta?: boolean;
  suppliers?: { id: string; name: string }[];
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: React.ReactNode;
  subiektAvailability?: SubiektAvailability;
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

  const splitByAction = !activeFilter;

  const { actionZamowienia, progressZamowienia } = useMemo(() => {
    if (!splitByAction) {
      return { actionZamowienia: [] as MyOrderRow[], progressZamowienia: filteredZamowienia };
    }
    const { needsAction, inProgress } = partitionMyOrderRowsBySalesAction(filteredZamowienia);
    return { actionZamowienia: needsAction, progressZamowienia: inProgress };
  }, [splitByAction, filteredZamowienia]);

  const { actionInformacje, progressInformacje } = useMemo(() => {
    if (!splitByAction) {
      return { actionInformacje: [] as MyOrderRow[], progressInformacje: filteredInformacje };
    }
    const { needsAction, inProgress } = partitionMyOrderRowsBySalesAction(filteredInformacje);
    return { actionInformacje: needsAction, progressInformacje: inProgress };
  }, [splitByAction, filteredInformacje]);

  const zamowieniaListRows = splitByAction ? progressZamowienia : filteredZamowienia;
  const informacjeListRows = splitByAction ? progressInformacje : filteredInformacje;
  const showKindSectionLabels =
    !activeFilter ||
    (zamowieniaListRows.length > 0 && informacjeListRows.length > 0);

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

  const actionCount = actionZamowienia.length + actionInformacje.length;

  useEffect(() => {
    if (!activeFilter || filteredCount === 0) return;
    const first = filteredZamowienia[0]?.id ?? filteredInformacje[0]?.id;
    if (!first) return;
    document.getElementById(cardDomId(first))?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeFilter, filteredCount, filteredZamowienia, filteredInformacje]);

  const cardDescription = pageDescription ?? MOJE_INTRO;
  const cardAction = (
    <>
      {headerActions}
      <MojeOrdersHelp />
    </>
  );

  if (!shipmentCount) {
    return (
      <div className="space-y-5">
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            title={pageTitle}
            leading={
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconClipboardList size={20} />
              </SectionHeadingIcon>
            }
            action={cardAction}
          />
          <EmptyState
            title="Brak aktywnych prośb"
            description={cardDescription}
            icon={<IconClipboardList size={28} strokeWidth={1.75} />}
          />
        </Card>
        <MojeOrdersEmptyGuide showActions={showProsbaCta} />
        <MyOrderArchiveSection
          rowsRecent={archiwumRecent}
          rowsExtended={archiwumExtended}
        />
      </div>
    );
  }

  const activeDescription = activeFilter
    ? `${filteredCount} z ${shipmentCount} · filtr włączony`
    : `${formatProsbaCount(shipmentCount)} · ${lineCount} ${lineCount === 1 ? "pozycja" : "pozycji"}`;

  const listProps = {
    canAcknowledge,
    suppliers,
  };

  return (
    <div className="space-y-5">
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          title={pageTitle}
          description={cardDescription}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconClipboardList size={20} />
            </SectionHeadingIcon>
          }
          action={cardAction}
        />

        <p className="border-b border-slate-100 px-3 pb-2.5 text-xs text-slate-500 sm:px-6">
          {activeDescription}
        </p>

        <MyOrdersInboxSummary
          summary={inboxSummary}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {inboxSummary.pickupCount > 0 && !activeFilter ? (
          <p className="flex items-start gap-2 border-b border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-900 sm:px-4">
            <IconPackageCheck
              size={16}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-emerald-700"
            />
            <span>
            {inboxSummary.pickupCount === 1
              ? "1 prośba do odbioru — potwierdź odbiór zielonym przyciskiem po prawej stronie wiersza."
              : `${formatProsbaCount(inboxSummary.pickupCount)} do odbioru — filtr „Odbiór” zawęzi listę.`}
            </span>
          </p>
        ) : null}

        {activeFilter && filteredCount === 0 ? (
          <p className="border-b border-slate-100 px-3 py-3 text-sm text-slate-600 sm:px-4">
            Brak w tej kategorii.{" "}
            <button
              type="button"
              className={brandLinkSubtleClass}
              onClick={() => setActiveFilter(null)}
            >
              Pokaż wszystkie
            </button>
          </p>
        ) : null}

        {splitByAction && actionCount > 0 ? (
          <>
            <ListSectionLabel
              title="Od Ciebie zależy"
              hint="Potwierdź odbiór lub powiadomienie — zielony przycisk po prawej stronie wiersza."
              count={actionCount}
              accent="emerald"
              icon="action"
            />
            <MyOrderShipmentBlock
              rows={actionZamowienia}
              listKind="zamowienie"
              showProgress
              {...listProps}
            />
            <MyOrderShipmentBlock
              rows={actionInformacje}
              listKind="informacja"
              showProgress={false}
              {...listProps}
            />
          </>
        ) : null}

        {zamowieniaListRows.length > 0 ? (
          <>
            {showKindSectionLabels ? (
              <ListSectionLabel
                title={
                  activeFilter ? "Zamówienia u dostawcy" : "Zamówiliśmy u dostawcy"
                }
                hint={
                  activeFilter
                    ? undefined
                    : "Składamy zamówienie — dostaniesz informację o odbiorze, gdy towar będzie na magazynie."
                }
                count={zamowieniaListRows.length}
                icon="zamowienie"
              />
            ) : null}
            <MyOrderShipmentBlock
              rows={zamowieniaListRows}
              listKind="zamowienie"
              showProgress
              {...listProps}
            />
          </>
        ) : null}

        {informacjeListRows.length > 0 ? (
          <>
            {showKindSectionLabels ? (
              <ListSectionLabel
                title={
                  activeFilter
                    ? "Informacje o dostępności"
                    : "Tylko sprawdzamy dostępność"
                }
                hint={
                  activeFilter
                    ? undefined
                    : "Nie składamy zamówienia u dostawcy — powiadomimy e-mailem, gdy towar pojawi się na magazynie."
                }
                count={informacjeListRows.length}
                icon="informacja"
              />
            ) : null}
            <MyOrderShipmentBlock
              rows={informacjeListRows}
              listKind="informacja"
              showProgress={false}
              {...listProps}
            />
          </>
        ) : null}
      </Card>

      <MyOrderArchiveSection
        rowsRecent={archiwumRecent}
        rowsExtended={archiwumExtended}
      />

      {subiektAvailability ? (
        <SubiektStatusBar initial={subiektAvailability} className="mt-2" />
      ) : null}
    </div>
  );
}
