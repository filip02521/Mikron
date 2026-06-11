"use client";

import { Suspense, useEffect, useMemo, useRef, useCallback, type ComponentProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { partitionMyOrderRowsBySalesAction } from "@/lib/orders/my-order-inbox-filter";
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
import {
  buildSalesDayStartSnapshot,
  type SalesDayStartContext,
} from "@/lib/sales/sales-day-start";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { MyOrdersRowLegend } from "@/components/moje/MyOrdersRowLegend";
import { MojeOrdersHelp } from "@/components/moje/MojeOrdersGuide";
import { SalesDayStartHelp } from "@/components/moje/SalesDayStartHelp";
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
import { salesTypography, sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import {
  deriveMyOrderSectionDisplayState,
  type MyOrderSectionPatternId,
} from "@/lib/orders/my-order-section-callout";
import {
  findMyOrderRowIdsForFocusOrderIds,
  parseMojeFocusOrderIds,
} from "@/lib/orders/moje-order-focus";
import { MojeSectionShell } from "@/components/moje/MojeSectionShell";
import {
  flashMojeCard,
  mojeSectionHeadingDomId,
  parseMojeSectionHash,
  scrollToMojeSection,
  scrollToMojeSectionWhenReady,
} from "@/lib/orders/moje-section-focus";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { INFORMACJA_FLOW_MY_ORDERS_HINT } from "@/lib/orders/informacja-flow-copy";
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
  filteredCount,
  searchActive,
  clientLinkFilterActive = false,
  archiveMatchCount = 0,
}: {
  shipmentCount: number;
  lineCount: number;
  filteredCount: number;
  searchActive: boolean;
  clientLinkFilterActive?: boolean;
  archiveMatchCount?: number;
}) {
  const narrowed = searchActive;
  if (clientLinkFilterActive && !narrowed) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:px-4 lg:px-6">
      {narrowed ? (
        <p className={cn(salesTypography.chrome, "leading-relaxed")} aria-live="polite">
          Pokazano{" "}
          <span className={salesTypography.statValue}>{filteredCount}</span>
          {" z "}
          <span className={salesTypography.statValue}>{shipmentCount}</span>
          <span className="ml-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
            szukaj
          </span>
          {archiveMatchCount ? (
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
      id={mojeSectionHeadingDomId(icon)}
      title={title}
      hint={hint}
      count={count}
      accent={toSectionListAccent(accent)}
      icon={<MojeSectionIcon kind={icon} size={17} />}
      tileClassName={mojeSectionIconTileClass(icon)}
    />
  );
}

function useMyOrderSectionCallouts(rows: MyOrderRow[]) {
  return useMemo(() => deriveMyOrderSectionDisplayState(rows), [rows]);
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
  focusRowIds,
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
  focusRowIds?: ReadonlySet<string>;
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
      focusRowIds={focusRowIds}
    />
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
  const sectionCallouts = useMyOrderSectionCallouts(rows);
  if (rows.length === 0 && !showWhenEmpty) return null;

  const copy = MY_ORDER_PROGRESS_SECTION_COPY[sectionId];

  return (
    <MojeSectionShell sectionIcon={copy.icon}>
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
    </MojeSectionShell>
  );
}

function MyOrderZamowieniaFlatSection({
  rows,
  listProps,
}: {
  rows: MyOrderRow[];
  listProps: Omit<
    ComponentProps<typeof MyOrderShipmentBlock>,
    "rows" | "listKind" | "showProgress" | "embedded" | "suppressedSectionPatterns"
  >;
}) {
  const sectionCallouts = useMyOrderSectionCallouts(rows);
  if (rows.length === 0) return null;

  return (
    <MojeSectionShell sectionIcon="zamowienie">
      <MojeSectionListLabel
        title="Zamówienia u dostawcy"
        count={rows.length}
        icon="zamowienie"
        accent="slate"
      />
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
    </MojeSectionShell>
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
  initialFocusOrderIds,
  syncSearchUrl = true,
  tourPreview = false,
  showSalesSync = false,
  dayStartContext = null,
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
  initialFocusOrderIds?: string | null;
  syncSearchUrl?: boolean;
  tourPreview?: boolean;
  showSalesSync?: boolean;
  dayStartContext?: SalesDayStartContext | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clientKhFilter =
    initialClientKhId != null && initialClientKhId > 0 ? initialClientKhId : null;
  const clientLinkLabel = (initialClientKhLabel ?? initialClientQuery ?? "").trim() || null;
  const clientZkWatchId = initialClientZkWatchId?.trim() || null;
  const clientZkNumber = initialClientZkNumber?.trim() || null;
  const focusOrderIds = useMemo(
    () => parseMojeFocusOrderIds(initialFocusOrderIds),
    [initialFocusOrderIds]
  );
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

  const filteredZamowienia = searchFilteredZamowienia;
  const filteredInformacje = searchFilteredInformacje;

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

  const { actionZamowienia, progressZamowienia } = useMemo(() => {
    const { needsAction, inProgress } = partitionMyOrderRowsBySalesAction(filteredZamowienia);
    return {
      actionZamowienia: sortMyOrderRows(needsAction),
      progressZamowienia: sortMyOrderRows(inProgress),
    };
  }, [filteredZamowienia]);

  const { actionInformacje, progressInformacje } = useMemo(() => {
    const { needsAction, inProgress } = partitionMyOrderRowsBySalesAction(filteredInformacje);
    return {
      actionInformacje: [] as MyOrderRow[],
      progressInformacje: sortMyOrderRows([...needsAction, ...inProgress]),
    };
  }, [filteredInformacje]);

  const zamowieniaListRows = progressZamowienia;
  const informacjeListRows = progressInformacje;
  const { beforeOrder: beforeOrderZamowienia, orderedProgress: orderedProgressZamowienia } =
    useMemo(
      () => partitionMyOrderProgressRows(zamowieniaListRows),
      [zamowieniaListRows]
    );
  const showZamowieniaProgressSplit =
    !searchActive && zamowieniaListRows.length > 0;
  const showProgressSectionLabels = showZamowieniaProgressSplit;

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
  const actionSectionCallouts = useMyOrderSectionCallouts(actionSectionRows);
  const informacjeSectionCallouts = useMyOrderSectionCallouts(informacjeListRows);

  const allRows = useMemo(
    () => [...sortedZamowienia, ...sortedInformacje],
    [sortedZamowienia, sortedInformacje]
  );

  const dayStartSnapshot = useMemo(() => {
    if (!dayStartContext) return null;
    return buildSalesDayStartSnapshot({
      rows: allRows,
      watches: dayStartContext.watches,
      notes: dayStartContext.notes,
      boardAttention: dayStartContext.boardAttention,
      previewDla: dayStartContext.previewDla,
    });
  }, [allRows, dayStartContext]);

  const inboxSummary = summarizeMyOrdersInbox(allRows);

  /** Pełna liczba pozycji wymagających reakcji — niezależna od wyszukiwania. */
  const needsActionTotal = useMemo(
    () => partitionMyOrderRowsBySalesAction(allRows).needsAction.length,
    [allRows]
  );
  const dayStartActionCount = dayStartSnapshot?.totalActionCount ?? needsActionTotal;

  const handleDayStartScrollToSection = useCallback(
    (scrollTarget: string, fallbackHref: string) => {
      const previewDla = searchParams.get("dla");
      scrollToMojeSectionWhenReady(scrollTarget, () => {
        router.push(hrefWithSalesPreviewFromUrl(fallbackHref, previewDla));
      });
    },
    [router, searchParams]
  );

  const showDayStart =
    canAcknowledge && dayStartSnapshot != null && !dayStartSnapshot.cleared;

  const dayStartPanel = showDayStart ? (
    <Suspense fallback={null}>
      <SalesDayStartPanel
        snapshot={dayStartSnapshot}
        onScrollToSection={handleDayStartScrollToSection}
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

  const focusRowIds = useMemo(() => {
    if (!focusOrderIds.length) return new Set<string>();
    const sourceRows = [
      ...searchFilteredZamowienia,
      ...searchFilteredInformacje,
      ...archiwumRecentFiltered,
      ...archiwumExtendedFiltered,
    ];
    return new Set(findMyOrderRowIdsForFocusOrderIds(sourceRows, focusOrderIds));
  }, [
    focusOrderIds,
    searchFilteredZamowienia,
    searchFilteredInformacje,
    archiwumRecentFiltered,
    archiwumExtendedFiltered,
  ]);

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

  const clearNotepadClientFilter = useCallback(() => {
    if (tourPreview) return;
    setSearchQuery("");
    if (syncSearchUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("kh");
      params.delete("klient");
      params.delete("zkWatch");
      params.delete("zk");
      params.delete("focusOrders");
      params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [tourPreview, setSearchQuery, syncSearchUrl, searchParams, router, pathname]);

  const clientKhBanner = clientLinkFilterActive ? (
    <Suspense fallback={null}>
      <MojeClientKhFilterBanner
        clientLabel={clientKhDisplayLabel ?? clientLinkLabel}
        zkNumber={clientZkNumber}
        zkWatchId={clientZkWatchId}
        salesPersonId={zamowienia[0]?.salesPersonId ?? informacje[0]?.salesPersonId ?? null}
        matchCount={searchMatchCount}
        totalCount={shipmentCount}
        onClear={clearNotepadClientFilter}
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

  const sectionHashDoneRef = useRef(false);

  useEffect(() => {
    if (sectionHashDoneRef.current || focusOrderIds.length > 0) return;
    const sectionId = parseMojeSectionHash(window.location.hash);
    if (!sectionId) return;

    const markDoneIfScrolled = () => {
      if (scrollToMojeSection(sectionId)) {
        sectionHashDoneRef.current = true;
        return true;
      }
      return false;
    };

    if (markDoneIfScrolled()) return;
    window.setTimeout(markDoneIfScrolled, 120);
  }, [focusOrderIds.length]);

  const focusScrollDoneRef = useRef(false);

  useEffect(() => {
    if (focusScrollDoneRef.current || focusRowIds.size === 0) return;

    const visibleRows = [...filteredZamowienia, ...filteredInformacje];
    const targetRowId = visibleRows.find((row) => focusRowIds.has(row.id))?.id;
    if (!targetRowId) return;

    focusScrollDoneRef.current = true;
    window.setTimeout(() => {
      const card = document.getElementById(cardDomId(targetRowId));
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      flashMojeCard(card);
      const toggle = card.querySelector<HTMLElement>("[data-moje-row-toggle]");
      toggle?.focus({ preventScroll: true });
    }, 120);
  }, [focusRowIds, filteredZamowienia, filteredInformacje]);

  useEffect(() => {
    focusScrollDoneRef.current = false;
  }, [initialFocusOrderIds]);

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

  const cardDescription = pageDescription ?? MOJE_INTRO;
  const pageToolbar = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {headerActions}
      {dayStartPanel ? <SalesDayStartHelp /> : null}
      <MojeOrdersHelp />
    </div>
  );

  if (!shipmentCount) {
    return (
      <div className="space-y-5">
        {pageToolbar}
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

  const listProps = {
    canAcknowledge,
    suppliers,
    searchQuery,
    tourPreview,
    compactActionLayout: true,
    focusRowIds: focusRowIds.size > 0 ? focusRowIds : undefined,
  };

  return (
    <div className="space-y-5">
      {pageToolbar}
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
        />

        {clientKhBanner}

        {!tourPreview && showSalesSync ? <MojeOrdersSyncStrip /> : null}

        <MojeOrdersOverviewStats
          shipmentCount={shipmentCount}
          lineCount={filteredLineCount}
          filteredCount={filteredCount}
          searchActive={searchActive}
          clientLinkFilterActive={clientLinkFilterActive}
          archiveMatchCount={archiveMatchCount}
        />

        {subiektAvailability ? (
          <SubiektStatusBar initial={subiektAvailability} embedded />
        ) : null}

        {searchBar}

        <div className="space-y-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 sm:px-4 lg:px-6">
          <MyOrdersRowLegend />
          {inboxSummary.availabilityPendingCount > 0 ? (
            <p className="text-xs leading-snug text-slate-500">{INFORMACJA_FLOW_MY_ORDERS_HINT}</p>
          ) : null}
        </div>

        {searchActive && searchMatchCount === 0 && !archiveMatchCount ? (
          <MojeOrdersSearchEmptyHint query={searchTrimmed} onClear={() => setSearchQuery("")} />
        ) : null}

        {searchActive && searchMatchCount === 0 && archiveMatchCount > 0 ? (
          <MojeOrdersSearchEmptyHint
            query={searchTrimmed}
            onClear={() => setSearchQuery("")}
            archiveOnly
          />
        ) : null}

        <div className="space-y-3 p-3 sm:p-4">
        <MyOrderBulkPickupBar
          rows={bulkPickupRows}
          enabled={canAcknowledge}
          tourPreview={tourPreview}
        />
        {actionCount > 0 ? (
          <MojeSectionShell sectionIcon={MY_ORDER_ACTION_SECTION_COPY.icon}>
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
          </MojeSectionShell>
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
          <MyOrderZamowieniaFlatSection rows={zamowieniaListRows} listProps={listProps} />
        )}

        {informacjeListRows.length > 0 ? (
          <MojeSectionShell sectionIcon={MY_ORDER_INFORMACJA_SECTION_COPY.icon}>
            <MojeSectionListLabel
              title={MY_ORDER_INFORMACJA_SECTION_COPY.title}
              hint={MY_ORDER_INFORMACJA_SECTION_COPY.hint}
              count={informacjeListRows.length}
              icon={MY_ORDER_INFORMACJA_SECTION_COPY.icon}
              accent={MY_ORDER_INFORMACJA_SECTION_COPY.accent}
            />
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
          </MojeSectionShell>
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
        <MyOrderShipmentUndoToast />
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
