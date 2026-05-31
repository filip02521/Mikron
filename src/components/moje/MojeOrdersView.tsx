"use client";

import { useEffect, useMemo, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  filterMyOrderRows,
  partitionMyOrderRowsBySalesAction,
  type MyOrderInboxFilter,
} from "@/lib/orders/my-order-inbox-filter";
import { filterMyOrderRowsByClient } from "@/lib/orders/my-order-client-filter";
import { sortMyOrderRows, summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import { INFORMACJA_FLOW_MY_ORDERS_HINT } from "@/lib/orders/informacja-flow-copy";
import { Alert } from "@/components/ui/Alert";
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
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { SubiektStatusBar } from "@/components/subiekt/SubiektStatusBar";
import type { SubiektAvailability } from "@/lib/subiekt/availability";

function cardDomId(rowId: string) {
  return `moje-card-${rowId}`;
}

const MOJE_INTRO =
  "Tu śledzisz swoje prośby — co jest do odbioru, co czeka u dostawcy i co obserwujemy na magazynie.";

function formatProsbaCount(n: number): string {
  if (n === 1) return "1 prośba";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} prośby`;
  return `${n} prośb`;
}

function prosbaUnitLabel(n: number): string {
  return formatProsbaCount(n).replace(/^\d+\s+/, "");
}

function lineUnitLabel(n: number): string {
  if (n === 1) return "pozycja";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "pozycje";
  return "pozycji";
}

function MojeOrdersOverviewStats({
  shipmentCount,
  lineCount,
  activeFilter,
  filteredCount,
}: {
  shipmentCount: number;
  lineCount: number;
  activeFilter: MyOrderInboxFilter | null;
  filteredCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6">
      {activeFilter ? (
        <p className="text-xs leading-relaxed text-slate-600">
          Pokazano{" "}
          <span className="font-semibold tabular-nums text-slate-900">{filteredCount}</span>
          {" z "}
          <span className="font-semibold tabular-nums text-slate-900">{shipmentCount}</span>
          <span className="ml-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-900">
            filtr aktywny
          </span>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-baseline gap-1.5">
            <span className="text-base font-semibold tabular-nums text-slate-900">
              {shipmentCount}
            </span>
            <span className="text-xs text-slate-500">{prosbaUnitLabel(shipmentCount)}</span>
          </div>
          <span className="hidden h-3.5 w-px bg-slate-200 sm:block" aria-hidden />
          <div className="inline-flex items-baseline gap-1.5">
            <span className="text-base font-semibold tabular-nums text-slate-900">{lineCount}</span>
            <span className="text-xs text-slate-500">{lineUnitLabel(lineCount)}</span>
          </div>
        </div>
      )}
    </div>
  );
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
  embedded = false,
  continuation = false,
  tourPreview = false,
}: {
  rows: MyOrderRow[];
  listKind: "zamowienie" | "informacja";
  showProgress: boolean;
  canAcknowledge: boolean;
  suppliers: { id: string; name: string }[];
  embedded?: boolean;
  continuation?: boolean;
  tourPreview?: boolean;
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
      embedded={embedded}
      continuation={continuation}
      tourPreview={tourPreview}
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
  initialClientQuery,
  tourPreview = false,
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
  initialClientQuery?: string | null;
  tourPreview?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<MyOrderInboxFilter | null>(null);
  const clientQuery = initialClientQuery?.trim() || null;

  const sortedZamowienia = useMemo(() => sortMyOrderRows(zamowienia), [zamowienia]);
  const sortedInformacje = useMemo(() => sortMyOrderRows(informacje), [informacje]);

  const clientFilteredZamowienia = useMemo(
    () => filterMyOrderRowsByClient(sortedZamowienia, clientQuery),
    [sortedZamowienia, clientQuery]
  );
  const clientFilteredInformacje = useMemo(
    () => filterMyOrderRowsByClient(sortedInformacje, clientQuery),
    [sortedInformacje, clientQuery]
  );

  const filteredZamowienia = useMemo(
    () => filterMyOrderRows(clientFilteredZamowienia, activeFilter),
    [clientFilteredZamowienia, activeFilter]
  );
  const filteredInformacje = useMemo(
    () => filterMyOrderRows(clientFilteredInformacje, activeFilter),
    [clientFilteredInformacje, activeFilter]
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
          {subiektAvailability ? (
            <SubiektStatusBar initial={subiektAvailability} embedded />
          ) : null}
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
          defaultOpen={tourPreview}
        />
      </div>
    );
  }

  const listProps = {
    canAcknowledge,
    suppliers,
    tourPreview,
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

        <MojeOrdersOverviewStats
          shipmentCount={shipmentCount}
          lineCount={lineCount}
          activeFilter={activeFilter}
          filteredCount={filteredCount}
        />

        {subiektAvailability ? (
          <SubiektStatusBar initial={subiektAvailability} embedded />
        ) : null}

        {clientQuery ? (
          <div className="border-b border-slate-100 px-3 py-2 sm:px-4">
            <Alert tone="info">
              Filtr klienta: <span className="font-semibold">{clientQuery}</span>
            </Alert>
          </div>
        ) : null}

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

        <div className="space-y-4 p-3 sm:p-4">
        {splitByAction && actionCount > 0 ? (
          <div className={mojeShipmentSectionShellClass}>
            <ListSectionLabel
              title="Do potwierdzenia"
              hint="Kliknij strzałkę przy wierszu, żeby zobaczyć produkty. Potwierdź odbiór lub powiadomienie zielonym przyciskiem po prawej."
              count={actionCount}
              accent="emerald"
              icon="action"
            />
            <MyOrderShipmentBlock
              embedded
              rows={actionZamowienia}
              listKind="zamowienie"
              showProgress
              {...listProps}
            />
            <MyOrderShipmentBlock
              embedded
              continuation
              rows={actionInformacje}
              listKind="informacja"
              showProgress={false}
              {...listProps}
            />
          </div>
        ) : null}

        {zamowieniaListRows.length > 0 ? (
          <div className={mojeShipmentSectionShellClass}>
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
              embedded
              rows={zamowieniaListRows}
              listKind="zamowienie"
              showProgress
              {...listProps}
            />
          </div>
        ) : null}

        {informacjeListRows.length > 0 ? (
          <div className={mojeShipmentSectionShellClass}>
            {showKindSectionLabels ? (
              <ListSectionLabel
                title={
                  activeFilter ? "Informacje o dostępności" : "Tylko sprawdzamy dostępność"
                }
                hint={
                  activeFilter ? undefined : INFORMACJA_FLOW_MY_ORDERS_HINT
                }
                count={informacjeListRows.length}
                icon="informacja"
              />
            ) : null}
            <MyOrderShipmentBlock
              embedded
              rows={informacjeListRows}
              listKind="informacja"
              showProgress={false}
              {...listProps}
            />
          </div>
        ) : null}
        </div>
      </Card>

      <MyOrderArchiveSection
        rowsRecent={archiwumRecent}
        rowsExtended={archiwumExtended}
        defaultOpen={tourPreview}
      />
    </div>
  );
}
