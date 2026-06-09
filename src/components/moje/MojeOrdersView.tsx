"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useCallback, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  filterMyOrderRows,
  inboxFilterLabel,
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
import { MICROCOPY } from "@/lib/ui/microcopy";
import { cn } from "@/lib/cn";
import { MyOrderPickupShelfDialogProvider } from "@/components/moje/MyOrderPickupShelfDialogProvider";
import {
  MyOrderShipmentUndoProvider,
  MyOrderShipmentUndoToast,
} from "@/components/moje/MyOrderShipmentUndoProvider";
import { MyOrderArchiveSection } from "@/components/moje/MyOrderArchiveSection";
import { MyOrderBulkPickupBar } from "@/components/moje/MyOrderBulkPickupBar";
import { SalesDayStartPanel } from "@/components/moje/SalesDayStartPanel";
import type { SalesDayStartSnapshot } from "@/lib/sales/sales-day-start";
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
import {
  deriveMyOrderSectionDisplayState,
  type MyOrderSectionPatternId,
} from "@/lib/orders/my-order-section-callout";
import {
  MY_ORDER_ACTION_SECTION_COPY,
  MY_ORDER_INFORMACJA_SECTION_COPY,
  MY_ORDER_PROGRESS_SECTION_COPY,
  MY_ORDER_PROGRESS_SECTION_EMPTY,
  partitionMyOrderProgressRows,
  type MyOrderProgressSectionId,
} from "@/lib/orders/my-order-inbox-sections";
import { MyOrderSectionNoticeList } from "@/components/moje/MyOrderSectionCallout";
import { MyOrderSectionEmptyState } from "@/components/moje/MyOrderSectionEmptyState";
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

import type { SectionListAccent } from "@/components/ui/SectionListLabel";
import type { MyOrderSectionAccent } from "@/lib/orders/my-order-section-accent";

function toSectionListAccent(accent: MyOrderSectionAccent): SectionListAccent {
  return accent;
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
  accent: MyOrderSectionAccent;
  icon: MojeSectionIconKind;
}) {
  return (
    <SectionListLabel
      id={`moje-section-${icon}`}
      title={title}
      hint={hint}
      count={count}
      accent={toSectionListAccent(accent)}
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
  suppressedSectionPatterns,
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
  suppressedSectionPatterns?: Set<MyOrderSectionPatternId>;
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
      suppressedSectionPatterns={suppressedSectionPatterns}
    />
  );
}

function useMyOrderSectionCallouts(
  rows: MyOrderRow[],
  activeFilter: MyOrderInboxFilter | null
) {
  return useMemo(
    () => deriveMyOrderSectionDisplayState(rows, activeFilter),
    [rows, activeFilter]
  );
}

function MyOrderZamowieniaProgressSection({
  sectionId,
  rows,
  showSectionLabel,
  showWhenEmpty,
  listProps,
}: {
  sectionId: MyOrderProgressSectionId;
  rows: MyOrderRow[];
  showSectionLabel: boolean;
  showWhenEmpty?: boolean;
  listProps: Omit<
    ComponentProps<typeof MyOrderShipmentBlock>,
    "rows" | "listKind" | "showProgress" | "embedded" | "suppressedSectionPatterns"
  >;
}) {
  const sectionCallouts = useMyOrderSectionCallouts(rows, null);
  if (rows.length === 0 && !showWhenEmpty) return null;

  const copy = MY_ORDER_PROGRESS_SECTION_COPY[sectionId];

  return (
    <div className={mojeShipmentSectionShellClass}>
      {showSectionLabel ? (
        <MojeSectionListLabel
          title={copy.title}
          hint={copy.hint}
          count={rows.length}
          icon={copy.icon}
          accent={copy.accent}
        />
      ) : null}
      <MyOrderSectionNoticeList
        callouts={sectionCallouts.callouts}
        singleHints={sectionCallouts.singleHints}
      />
      {rows.length > 0 ? (
        <MyOrderShipmentBlock
          embedded
          rows={rows}
          listKind="zamowienie"
          showProgress
          suppressedSectionPatterns={sectionCallouts.suppressedPatterns}
          {...listProps}
        />
      ) : (
        <MyOrderSectionEmptyState message={MY_ORDER_PROGRESS_SECTION_EMPTY[sectionId]} />
      )}
    </div>
  );
}

function MyOrderFilteredZamowieniaSection({
  rows,
  activeFilter,
  showSectionLabel,
  listProps,
}: {
  rows: MyOrderRow[];
  activeFilter: MyOrderInboxFilter | null;
  showSectionLabel: boolean;
  listProps: Omit<
    ComponentProps<typeof MyOrderShipmentBlock>,
    "rows" | "listKind" | "showProgress" | "embedded" | "suppressedSectionPatterns"
  >;
}) {
  const sectionCallouts = useMyOrderSectionCallouts(rows, activeFilter);
  if (rows.length === 0) return null;

  return (
    <div className={mojeShipmentSectionShellClass}>
      {showSectionLabel ? (
        <MojeSectionListLabel
          title={activeFilter ? inboxFilterLabel(activeFilter) : "Zamówienia u dostawcy"}
          count={rows.length}
          icon="zamowienie"
          accent="slate"
        />
      ) : null}
      <MyOrderSectionNoticeList
        callouts={sectionCallouts.callouts}
        singleHints={sectionCallouts.singleHints}
      />
      <MyOrderShipmentBlock
        embedded
        rows={rows}
        listKind="zamowienie"
        showProgress
        suppressedSectionPatterns={sectionCallouts.suppressedPatterns}
        {...listProps}
      />
    </div>
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
  dayStartSnapshot = null,
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
  dayStartSnapshot?: SalesDayStartSnapshot | null;
}) {
  const router = useRouter();
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
    return {
      actionZamowienia: sortMyOrderRows(needsAction),
      progressZamowienia: sortMyOrderRows(inProgress),
    };
  }, [splitByAction, filteredZamowienia]);

  const { actionInformacje, progressInformacje } = useMemo(() => {
    if (!splitByAction) {
      return { actionInformacje: [] as MyOrderRow[], progressInformacje: filteredInformacje };
    }
    const { needsAction, inProgress } = partitionMyOrderRowsBySalesAction(filteredInformacje);
    return {
      actionInformacje: sortMyOrderRows(needsAction),
      progressInformacje: sortMyOrderRows(inProgress),
    };
  }, [splitByAction, filteredInformacje]);

  const zamowieniaListRows = splitByAction ? progressZamowienia : filteredZamowienia;
  const informacjeListRows = splitByAction ? progressInformacje : filteredInformacje;
  const { beforeOrder: beforeOrderZamowienia, orderedProgress: orderedProgressZamowienia } =
    useMemo(
      () => partitionMyOrderProgressRows(zamowieniaListRows),
      [zamowieniaListRows]
    );
  const showZamowieniaProgressSplit =
    splitByAction && !activeFilter && zamowieniaListRows.length > 0;
  const showKindSectionLabels =
    !activeFilter ||
    (zamowieniaListRows.length > 0 && informacjeListRows.length > 0);
  const showProgressSectionLabels = showZamowieniaProgressSplit || showKindSectionLabels;

  const actionSectionRows = useMemo(
    () => [...actionZamowienia, ...actionInformacje],
    [actionZamowienia, actionInformacje]
  );
  const bulkPickupRows = useMemo(
    () =>
      [...filteredZamowienia, ...filteredInformacje].filter(
        (r) => r.acknowledgeMode === "pickup" && r.pickupPendingIds.length > 0
      ),
    [filteredZamowienia, filteredInformacje]
  );
  const actionSectionCallouts = useMyOrderSectionCallouts(actionSectionRows, activeFilter);
  const informacjeSectionCallouts = useMyOrderSectionCallouts(
    informacjeListRows,
    activeFilter
  );

  const allRows = useMemo(
    () => [...sortedZamowienia, ...sortedInformacje],
    [sortedZamowienia, sortedInformacje]
  );
  const inboxSummary = summarizeMyOrdersInbox(allRows);

  /** Pełna liczba pozycji wymagających reakcji — niezależna od filtra/wyszukiwania. */
  const needsActionTotal = useMemo(
    () => partitionMyOrderRowsBySalesAction(allRows).needsAction.length,
    [allRows]
  );
  const dayStartActionCount = dayStartSnapshot?.totalActionCount ?? needsActionTotal;

  const handleDayStartInboxFilter = useCallback(
    (filter: MyOrderInboxFilter, scrollTarget?: string) => {
      setActiveFilter(filter);
      requestAnimationFrame(() => {
        document
          .getElementById(scrollTarget ?? "moje-section-action")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    []
  );

  const handleDayStartBreakdown = useCallback(
    (key: "orders" | "notepad" | "board") => {
      if (key === "orders") {
        handleDayStartInboxFilter("action_group", "moje-section-action");
        return;
      }
      if (key === "notepad") {
        router.push("/notatnik");
        return;
      }
      router.push("/tablica");
    },
    [handleDayStartInboxFilter, router]
  );

  const dayStartPanel =
    canAcknowledge && dayStartSnapshot ? (
      <Suspense fallback={null}>
        <SalesDayStartPanel
          snapshot={dayStartSnapshot}
          onInboxFilter={handleDayStartInboxFilter}
          onBreakdownSelect={handleDayStartBreakdown}
          tourPreview={tourPreview}
        />
      </Suspense>
    ) : null;

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

  const documentTitleBaseRef = useRef<string | null>(null);

  useEffect(() => {
    if (tourPreview || !canAcknowledge) return;
    if (documentTitleBaseRef.current === null) {
      documentTitleBaseRef.current = document.title.replace(/^\(\d+\)\s*/, "");
    }
    const base = documentTitleBaseRef.current;
    document.title = dayStartActionCount > 0 ? `(${dayStartActionCount}) ${base}` : base;
    return () => {
      if (documentTitleBaseRef.current) {
        document.title = documentTitleBaseRef.current;
      }
    };
  }, [dayStartActionCount, tourPreview, canAcknowledge]);

  const showSplitSections = splitByAction && !activeFilter && !searchActive;

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
        {dayStartPanel}
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
      {dayStartPanel}
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
          sectionsVisible={showSplitSections}
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
          <p className="border-b border-slate-100 px-3 py-4 text-sm text-slate-600 sm:px-4">
            Brak pozycji w kategorii{" "}
            <span className="font-medium text-slate-800">
              „{inboxFilterLabel(activeFilter)}”
            </span>
            .{" "}
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
          <p className="border-b border-slate-100 px-3 py-4 text-sm text-slate-600 sm:px-4">
            Brak pozycji w kategorii{" "}
            <span className="font-medium text-slate-800">
              „{inboxFilterLabel(activeFilter)}”
            </span>{" "}
            przy aktywnym wyszukiwaniu.{" "}
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
        <MyOrderShipmentUndoToast />
        <MyOrderBulkPickupBar
          rows={bulkPickupRows}
          enabled={canAcknowledge}
          tourPreview={tourPreview}
        />
        {splitByAction && actionCount > 0 ? (
          <div className={mojeShipmentSectionShellClass} aria-labelledby="moje-section-action">
            <MojeSectionListLabel
              title={MY_ORDER_ACTION_SECTION_COPY.title}
              hint={MY_ORDER_ACTION_SECTION_COPY.hint}
              count={actionCount}
              accent={MY_ORDER_ACTION_SECTION_COPY.accent}
              icon={MY_ORDER_ACTION_SECTION_COPY.icon}
            />
            <MyOrderSectionNoticeList
              callouts={actionSectionCallouts.callouts}
              singleHints={actionSectionCallouts.singleHints}
            />
            <MyOrderShipmentBlock
              embedded
              rows={actionZamowienia}
              listKind="zamowienie"
              showProgress
              suppressedSectionPatterns={actionSectionCallouts.suppressedPatterns}
              {...listProps}
            />
            <MyOrderShipmentBlock
              embedded
              continuation
              rows={actionInformacje}
              listKind="informacja"
              showProgress={false}
              suppressedSectionPatterns={actionSectionCallouts.suppressedPatterns}
              {...listProps}
            />
          </div>
        ) : null}

        {showZamowieniaProgressSplit ? (
          <>
            <MyOrderZamowieniaProgressSection
              sectionId="ordered_progress"
              rows={orderedProgressZamowienia}
              showSectionLabel={showProgressSectionLabels}
              showWhenEmpty={showZamowieniaProgressSplit}
              listProps={listProps}
            />
            <MyOrderZamowieniaProgressSection
              sectionId="before_order"
              rows={beforeOrderZamowienia}
              showSectionLabel={showProgressSectionLabels}
              showWhenEmpty={showZamowieniaProgressSplit}
              listProps={listProps}
            />
          </>
        ) : (
          <MyOrderFilteredZamowieniaSection
            rows={zamowieniaListRows}
            activeFilter={activeFilter}
            showSectionLabel={showKindSectionLabels}
            listProps={listProps}
          />
        )}

        {informacjeListRows.length > 0 ? (
          <div className={mojeShipmentSectionShellClass}>
            {showKindSectionLabels ? (
              <MojeSectionListLabel
                title={
                  activeFilter
                    ? MY_ORDER_INFORMACJA_SECTION_COPY.titleFiltered
                    : MY_ORDER_INFORMACJA_SECTION_COPY.title
                }
                hint={activeFilter ? undefined : MY_ORDER_INFORMACJA_SECTION_COPY.hint}
                count={informacjeListRows.length}
                icon={MY_ORDER_INFORMACJA_SECTION_COPY.icon}
                accent={MY_ORDER_INFORMACJA_SECTION_COPY.accent}
              />
            ) : null}
            <MyOrderSectionNoticeList
              callouts={informacjeSectionCallouts.callouts}
              singleHints={informacjeSectionCallouts.singleHints}
            />
            <MyOrderShipmentBlock
              embedded
              rows={informacjeListRows}
              listKind="informacja"
              showProgress={false}
              suppressedSectionPatterns={informacjeSectionCallouts.suppressedPatterns}
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
  const { tourPreview = false, canAcknowledge = false } = props;
  return (
    <MyOrderPickupShelfDialogProvider>
      <MyOrderShipmentUndoProvider disabled={tourPreview || !canAcknowledge}>
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
      </MyOrderShipmentUndoProvider>
    </MyOrderPickupShelfDialogProvider>
  );
}
