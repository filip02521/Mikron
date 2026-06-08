"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  filterMyOrderRows,
  partitionMyOrderRowsBySalesAction,
  type MyOrderInboxFilter,
} from "@/lib/orders/my-order-inbox-filter";
import {
  filterMyOrderRowsByClientKh,
  filterMyOrderRowsBySearch,
} from "@/lib/orders/my-order-search";
import { MojeClientKhFilterBanner } from "@/components/moje/MojeClientKhFilterBanner";
import { MojeOrdersSearchBar, MojeOrdersSearchEmptyHint } from "@/components/moje/MojeOrdersSearchBar";
import { useMojeOrdersSearch } from "@/components/moje/useMojeOrdersSearch";
import { sortMyOrderRows, summarizeMyOrdersInbox } from "@/lib/orders/my-order-sales-ui";
import { formatProsbaCount } from "@/lib/orders/my-order-plural";
import { INFORMACJA_FLOW_MY_ORDERS_HINT } from "@/lib/orders/informacja-flow-copy";
import { MICROCOPY } from "@/lib/ui/microcopy";
import { cn } from "@/lib/cn";
import { MyOrderArchiveSection } from "@/components/moje/MyOrderArchiveSection";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { MyOrdersInboxSummary } from "@/components/moje/MyOrdersInboxSummary";
import { MojeStickyPickupBar } from "@/components/moje/MojeStickyPickupBar";
import { MojeOrdersHelp } from "@/components/moje/MojeOrdersGuide";
import { MojeOrdersEmptyGuide } from "@/components/moje/MojeOrdersEmptyGuide";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconClipboardList,
  MojeSectionIcon,
  type MojeSectionIconKind,
  mojeSectionIconTileClass,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { brandLinkSubtleClass, salesTypography, sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { MojeOrdersSyncStrip } from "@/components/moje/MojeOrdersSyncStrip";
import { SubiektStatusBar } from "@/components/subiekt/SubiektStatusBar";
import type { SubiektAvailability } from "@/lib/subiekt/availability";

function cardDomId(rowId: string) {
  return `moje-card-${rowId}`;
}

const MOJE_INTRO =
  "Tu śledzisz swoje prośby — co jest do odbioru, co czeka u dostawcy i co obserwujemy na magazynie.";

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
  searchActive,
  archiveMatchCount = 0,
}: {
  shipmentCount: number;
  lineCount: number;
  activeFilter: MyOrderInboxFilter | null;
  filteredCount: number;
  searchActive: boolean;
  archiveMatchCount?: number;
}) {
  const narrowed = activeFilter || searchActive;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:px-4 lg:px-6">
      {narrowed ? (
        <p className={cn(salesTypography.chrome, "leading-relaxed")} aria-live="polite">
          Pokazano{" "}
          <span className={salesTypography.statValue}>{filteredCount}</span>
          {" z "}
          <span className={salesTypography.statValue}>{shipmentCount}</span>
          {activeFilter ? (
            <span className="ml-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-900">
              filtr
            </span>
          ) : null}
          {searchActive ? (
            <span className="ml-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
              szukaj
            </span>
          ) : null}
          {searchActive && archiveMatchCount ? (
            <span className="ml-2 text-slate-500">
              +{archiveMatchCount} w archiwum
            </span>
          ) : null}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-baseline gap-1.5">
            <span className={salesTypography.statValue}>{shipmentCount}</span>
            <span className={salesTypography.statLabel}>{prosbaUnitLabel(shipmentCount)}</span>
          </div>
          <span className="hidden h-3.5 w-px bg-slate-200 sm:block" aria-hidden />
          <div className="inline-flex items-baseline gap-1.5">
            <span className={salesTypography.statValue}>{lineCount}</span>
            <span className={salesTypography.statLabel}>{lineUnitLabel(lineCount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MojeSectionListLabel({
  title,
  hint,
  count,
  accent,
  icon,
}: {
  title: string;
  hint?: string;
  count?: number;
  accent?: "emerald" | "neutral";
  icon: MojeSectionIconKind;
}) {
  return (
    <SectionListLabel
      id={`moje-section-${icon}`}
      title={title}
      hint={hint}
      count={count}
      accent={accent ?? "neutral"}
      icon={<MojeSectionIcon kind={icon} size={17} />}
      tileClassName={mojeSectionIconTileClass(icon)}
    />
  );
}

function MyOrderShipmentBlock({
  rows,
  listKind,
  showProgress,
  canAcknowledge,
  suppliers,
  searchQuery,
  embedded = false,
  continuation = false,
  tourPreview = false,
  compactActionLayout = false,
}: {
  rows: MyOrderRow[];
  listKind: "zamowienie" | "informacja";
  showProgress: boolean;
  canAcknowledge: boolean;
  suppliers: OrderFormSupplierOption[];
  searchQuery?: string | null;
  embedded?: boolean;
  continuation?: boolean;
  tourPreview?: boolean;
  compactActionLayout?: boolean;
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
      searchQuery={searchQuery}
      embedded={embedded}
      continuation={continuation}
      tourPreview={tourPreview}
      compactActionLayout={compactActionLayout}
    />
  );
}

function MojeOrdersViewContent({
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
  initialSearchQuery,
  /** @deprecated użyj initialSearchQuery */
  initialClientQuery,
  initialClientKhId,
  initialClientKhLabel,
  initialClientZkWatchId,
  initialClientZkNumber,
  syncSearchUrl = true,
  tourPreview = false,
  showSalesSync = false,
}: {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  archiwumRecent?: MyOrderRow[];
  archiwumExtended?: MyOrderRow[];
  productLineCount?: number;
  canAcknowledge?: boolean;
  showProsbaCta?: boolean;
  suppliers?: OrderFormSupplierOption[];
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: React.ReactNode;
  subiektAvailability?: SubiektAvailability;
  initialSearchQuery?: string | null;
  initialClientQuery?: string | null;
  initialClientKhId?: number | null;
  /** Etykieta z ?klient= (link z notatnika / ZK). */
  initialClientKhLabel?: string | null;
  initialClientZkWatchId?: string | null;
  initialClientZkNumber?: string | null;
  syncSearchUrl?: boolean;
  tourPreview?: boolean;
  showSalesSync?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<MyOrderInboxFilter | null>(null);
  const clientKhFilter =
    initialClientKhId != null && initialClientKhId > 0 ? initialClientKhId : null;
  const clientLinkLabel = (initialClientKhLabel ?? initialClientQuery ?? "").trim() || null;
  const clientZkWatchId = initialClientZkWatchId?.trim() || null;
  const clientZkNumber = initialClientZkNumber?.trim() || null;
  const clientLinkFilterActive =
    clientKhFilter != null ||
    Boolean(clientLinkLabel) ||
    Boolean(clientZkWatchId) ||
    Boolean(clientZkNumber);
  /** Przy filtrze z notatnika (?kh= / ?zkWatch=) nie dubluj ?klient= w pasku szukaj. */
  const initialQ =
    clientLinkFilterActive
      ? (initialSearchQuery ?? "").trim()
      : (initialSearchQuery ?? initialClientQuery ?? "").trim();
  const { query: searchQuery, setQuery: setSearchQuery, trimmed: searchTrimmed } =
    useMojeOrdersSearch(initialQ, syncSearchUrl && !tourPreview);

  const sortedZamowienia = useMemo(() => sortMyOrderRows(zamowienia), [zamowienia]);
  const sortedInformacje = useMemo(() => sortMyOrderRows(informacje), [informacje]);

  const clientLinkFilterOpts = useMemo(
    () =>
      clientLinkFilterActive
        ? {
            khId: clientKhFilter,
            clientLabel: clientLinkLabel,
            zkWatchId: clientZkWatchId,
            zkNumber: clientZkNumber,
          }
        : undefined,
    [
      clientLinkFilterActive,
      clientKhFilter,
      clientLinkLabel,
      clientZkWatchId,
      clientZkNumber,
    ]
  );

  const khFilteredZamowienia = useMemo(
    () => filterMyOrderRowsByClientKh(sortedZamowienia, clientKhFilter, clientLinkFilterOpts),
    [sortedZamowienia, clientKhFilter, clientLinkFilterOpts]
  );
  const khFilteredInformacje = useMemo(
    () => filterMyOrderRowsByClientKh(sortedInformacje, clientKhFilter, clientLinkFilterOpts),
    [sortedInformacje, clientKhFilter, clientLinkFilterOpts]
  );

  const searchFilteredZamowienia = useMemo(
    () => filterMyOrderRowsBySearch(khFilteredZamowienia, searchQuery),
    [khFilteredZamowienia, searchQuery]
  );
  const searchFilteredInformacje = useMemo(
    () => filterMyOrderRowsBySearch(khFilteredInformacje, searchQuery),
    [khFilteredInformacje, searchQuery]
  );

  const filteredZamowienia = useMemo(
    () => filterMyOrderRows(searchFilteredZamowienia, activeFilter),
    [searchFilteredZamowienia, activeFilter]
  );
  const filteredInformacje = useMemo(
    () => filterMyOrderRows(searchFilteredInformacje, activeFilter),
    [searchFilteredInformacje, activeFilter]
  );

  const searchActive = searchTrimmed.length > 0;
  const clientKhFilterActive = clientLinkFilterActive;
  const searchMatchCount = searchFilteredZamowienia.length + searchFilteredInformacje.length;

  const archiveMatchCount = useMemo(() => {
    const ids = new Set<string>();
    const recentKh = filterMyOrderRowsByClientKh(
      archiwumRecent,
      clientKhFilter,
      clientLinkFilterOpts
    );
    const extendedKh = filterMyOrderRowsByClientKh(
      archiwumExtended,
      clientKhFilter,
      clientLinkFilterOpts
    );
    for (const row of filterMyOrderRowsBySearch(recentKh, searchQuery)) {
      ids.add(row.id);
    }
    for (const row of filterMyOrderRowsBySearch(extendedKh, searchQuery)) {
      ids.add(row.id);
    }
    return ids.size;
  }, [archiwumRecent, archiwumExtended, searchQuery, clientKhFilter, clientLinkFilterOpts]);

  const filteredLineCount = useMemo(() => {
    if (!searchActive) {
      return (
        productLineCount ??
        zamowienia.reduce((n, r) => n + r.lineCount, 0) +
          informacje.reduce((n, r) => n + r.lineCount, 0)
      );
    }
    return [...searchFilteredZamowienia, ...searchFilteredInformacje].reduce(
      (n, r) => n + r.lineCount,
      0
    );
  }, [
    searchActive,
    productLineCount,
    zamowienia,
    informacje,
    searchFilteredZamowienia,
    searchFilteredInformacje,
  ]);

  const splitByAction = !activeFilter || activeFilter === "action_group";

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
  const actionCount = actionZamowienia.length + actionInformacje.length;

  const hasArchiveData = archiwumRecent.length > 0 || archiwumExtended.length > 0;
  const archiwumRecentFiltered = useMemo(
    () => filterMyOrderRowsByClientKh(archiwumRecent, clientKhFilter, clientLinkFilterOpts),
    [archiwumRecent, clientKhFilter, clientLinkFilterOpts]
  );
  const archiwumExtendedFiltered = useMemo(
    () => filterMyOrderRowsByClientKh(archiwumExtended, clientKhFilter, clientLinkFilterOpts),
    [archiwumExtended, clientKhFilter, clientLinkFilterOpts]
  );
  const openArchiveForSearch =
    (searchActive || clientKhFilterActive) &&
    searchMatchCount === 0 &&
    archiveMatchCount > 0;

  const clientKhDisplayLabel = useMemo(() => {
    if (!clientKhFilter) return null;
    const urlLabel = (initialClientKhLabel ?? initialClientQuery ?? "").trim();
    const rows = [
      ...khFilteredZamowienia,
      ...khFilteredInformacje,
      ...archiwumRecentFiltered,
      ...archiwumExtendedFiltered,
    ];
    for (const row of rows) {
      for (const line of row.lines) {
        if (line.clientKhId === clientKhFilter && line.clientName?.trim()) {
          return line.clientName.trim();
        }
      }
    }
    return urlLabel || null;
  }, [
    clientKhFilter,
    initialClientKhLabel,
    initialClientQuery,
    khFilteredZamowienia,
    khFilteredInformacje,
    archiwumRecentFiltered,
    archiwumExtendedFiltered,
  ]);

  const clientKhBanner = clientLinkFilterActive ? (
    <Suspense fallback={null}>
      <MojeClientKhFilterBanner
        clientKhId={clientKhFilter}
        clientLabel={clientKhDisplayLabel}
        zkNumber={clientZkNumber}
        matchCount={searchMatchCount}
        syncUrl={syncSearchUrl && !tourPreview}
      />
    </Suspense>
  ) : null;

  const searchBar = (
    <Suspense
      fallback={
        <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
          <div className="h-11 animate-pulse rounded-md bg-slate-100" />
        </div>
      }
    >
      <MojeOrdersSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        matchCount={searchMatchCount}
        totalCount={shipmentCount}
        archiveMatchCount={archiveMatchCount}
        enableShortcut={!tourPreview}
      />
    </Suspense>
  );

  useEffect(() => {
    if (!activeFilter || filteredCount === 0) return;
    const first = filteredZamowienia[0]?.id ?? filteredInformacje[0]?.id;
    if (!first) return;
    const card = document.getElementById(cardDomId(first));
    const el =
      card?.querySelector<HTMLElement>("[data-moje-row-toggle]") ?? card;
    if (!(el instanceof HTMLElement)) return;
    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    el.focus({ preventScroll: true });
  }, [activeFilter, filteredCount, filteredZamowienia, filteredInformacje]);

  const cardDescription = pageDescription ?? MOJE_INTRO;
  const cardAction = (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      {headerActions}
      <MojeOrdersHelp />
    </div>
  );

  if (!shipmentCount) {
    return (
      <div className="space-y-5">
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="compact"
            title={pageTitle}
            description={cardDescription}
            leading={
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconClipboardList size={20} />
              </SectionHeadingIcon>
            }
            action={cardAction}
          />
          {!tourPreview && showSalesSync ? <MojeOrdersSyncStrip /> : null}
          {subiektAvailability ? (
            <SubiektStatusBar initial={subiektAvailability} embedded />
          ) : null}
          {hasArchiveData ? searchBar : null}
          {clientKhBanner}
          {searchActive && !archiveMatchCount ? (
            <MojeOrdersSearchEmptyHint query={searchTrimmed} onClear={() => setSearchQuery("")} />
          ) : null}
          <EmptyState
            title={MICROCOPY.empty.orders.title}
            description={
              hasArchiveData && searchActive && archiveMatchCount > 0
                ? "Brak aktywnych prośb pasujących do wyszukiwania — zobacz archiwum poniżej."
                : cardDescription ?? MICROCOPY.empty.orders.description
            }
            icon={<IconClipboardList size={28} strokeWidth={1.75} />}
          />
          {showProsbaCta ? (
            <div className="border-t border-slate-100 px-3 py-4 sm:px-4">
              <MojeOrdersEmptyGuide showActions embedded />
            </div>
          ) : null}
        </Card>
        {!showProsbaCta ? <MojeOrdersEmptyGuide showActions={false} /> : null}
        <MyOrderArchiveSection
          rowsRecent={archiwumRecentFiltered}
          rowsExtended={archiwumExtendedFiltered}
          defaultOpen={tourPreview}
          forceOpen={openArchiveForSearch}
          searchQuery={searchQuery}
        />
      </div>
    );
  }

  const compactActionRows = splitByAction || activeFilter === "pickup";

  const listProps = {
    canAcknowledge,
    suppliers,
    searchQuery,
    tourPreview,
    compactActionLayout: compactActionRows,
  };

  return (
    <div className="space-y-5">
      <Card padding={false}>
        <CardHeader
          inset
          density="compact"
          title={pageTitle}
          description={cardDescription}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconClipboardList size={20} />
            </SectionHeadingIcon>
          }
          action={cardAction}
        />

        {!tourPreview && showSalesSync ? <MojeOrdersSyncStrip /> : null}

        <MojeOrdersOverviewStats
          shipmentCount={shipmentCount}
          lineCount={filteredLineCount}
          activeFilter={activeFilter}
          filteredCount={filteredCount}
          searchActive={searchActive}
          archiveMatchCount={archiveMatchCount}
        />

        {subiektAvailability ? (
          <SubiektStatusBar initial={subiektAvailability} embedded />
        ) : null}

        {searchBar}
        {clientKhBanner}

        <MyOrdersInboxSummary
          summary={inboxSummary}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        <MojeStickyPickupBar
          count={
            !activeFilter &&
            splitByAction &&
            actionCount > 0
              ? 0
              : !activeFilter || activeFilter === "pickup" || activeFilter === "action_group"
                ? inboxSummary.pickupCount
                : 0
          }
          onShowPickup={() => setActiveFilter("pickup")}
        />

        {searchActive && searchMatchCount === 0 && !archiveMatchCount ? (
          <MojeOrdersSearchEmptyHint
            query={searchTrimmed}
            onClear={() => setSearchQuery("")}
            hasInboxFilter={!!activeFilter}
            onClearFilter={activeFilter ? () => setActiveFilter(null) : undefined}
          />
        ) : null}

        {searchActive && searchMatchCount === 0 && archiveMatchCount > 0 ? (
          <MojeOrdersSearchEmptyHint
            query={searchTrimmed}
            onClear={() => setSearchQuery("")}
            hasInboxFilter={!!activeFilter}
            onClearFilter={activeFilter ? () => setActiveFilter(null) : undefined}
            archiveOnly
          />
        ) : null}

        {activeFilter && filteredCount === 0 && !searchActive ? (
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

        {activeFilter && filteredCount === 0 && searchActive && searchMatchCount > 0 ? (
          <p className="border-b border-slate-100 px-3 py-3 text-sm text-slate-600 sm:px-4">
            Brak w tej kategorii przy aktywnym wyszukiwaniu.{" "}
            <button
              type="button"
              className={brandLinkSubtleClass}
              onClick={() => setActiveFilter(null)}
            >
              Pokaż wyniki wyszukiwania
            </button>
          </p>
        ) : null}

        <div className="space-y-3 p-3 sm:p-4">
        {splitByAction && actionCount > 0 ? (
          <div className={mojeShipmentSectionShellClass} aria-labelledby="moje-section-action">
            <MojeSectionListLabel
              title="Do potwierdzenia"
              hint="Strzałka — produkty · zielony przycisk — potwierdzenie"
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
              <MojeSectionListLabel
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
              <MojeSectionListLabel
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
        rowsRecent={archiwumRecentFiltered}
        rowsExtended={archiwumExtendedFiltered}
        defaultOpen={tourPreview}
        forceOpen={openArchiveForSearch}
        searchQuery={searchQuery}
      />
    </div>
  );
}

export function MojeOrdersView(
  props: React.ComponentProps<typeof MojeOrdersViewContent>
) {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Card padding={false} className="overflow-hidden">
            <CardHeader inset density="compact" title={props.pageTitle ?? "Moje zamówienia"} />
            <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4 lg:px-6">
              <div className="h-11 animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="px-4 py-12 text-center text-sm text-slate-500">Ładowanie…</div>
          </Card>
        </div>
      }
    >
      <MojeOrdersViewContent {...props} />
    </Suspense>
  );
}
