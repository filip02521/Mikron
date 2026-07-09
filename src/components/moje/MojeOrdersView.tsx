"use client";

import { Suspense, useEffect, useMemo, useRef, useCallback, useState, type ComponentProps } from "react";
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
import { sortMyOrderRows } from "@/lib/orders/my-order-sales-ui";
import { formatProsbaCount } from "@/lib/orders/my-order-plural";
import { MICROCOPY } from "@/lib/ui/microcopy";
import { cn } from "@/lib/cn";
import { MyOrderPickupShelfDialogProvider } from "@/components/moje/MyOrderPickupShelfDialogProvider";
import {
  MyOrderShipmentUndoProvider,
} from "@/components/moje/MyOrderShipmentUndoProvider";
import { MyOrderArchiveSection } from "@/components/moje/MyOrderArchiveSection";
import { MojeAnnouncementsSection } from "@/components/moje/MojeAnnouncementsSection";
import { ZdFulfillmentDeadlineChangeAutoAck } from "@/components/moje/ZdFulfillmentDeadlineChangeAutoAck";
import { type SalesDayStartContext } from "@/lib/sales/sales-day-start";
import { useSalesInbox } from "@/components/sales/SalesInboxContext";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { MyOrdersRowLegend } from "@/components/moje/MyOrdersRowLegend";
import { MojeOrdersHelp } from "@/components/moje/MojeOrdersGuide";
import { MojeOrdersEmptyGuide } from "@/components/moje/MojeOrdersEmptyGuide";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconClipboardList,
  MojeSectionIcon,
  type MojeSectionIconKind,
  mojeSectionIconTileClass,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { salesChromeInsetClass, salesTypography, sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { MyOrderSectionPatternId } from "@/lib/orders/my-order-section-callout";
import { deriveMyOrderSectionDisplayState } from "@/lib/orders/my-order-section-callout";
import { useMojeScrollManagement } from "@/components/moje/useMojeScrollManagement";
import { parseMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import { sortInformacjaProgressRows } from "@/lib/orders/my-order-informacja-progress-sort";
import { MojeSectionShell } from "@/components/moje/MojeSectionShell";
import {
  mojeSectionHeadingDomId,
} from "@/lib/orders/moje-section-focus";
import {
  MY_ORDER_ACTION_SECTION_COPY,
  MY_ORDER_TEETH_ACTION_SECTION_COPY,
  MY_ORDER_MIXED_ACTION_SECTION_COPY,
  MY_ORDER_DISMISS_SECTION_COPY,
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
import type { DepartmentBoardAnnouncementsSlice } from "@/lib/data/department-board";

function cardDomId(rowId: string) {
  return `moje-card-${rowId}`;
}

import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";

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
  searchActive,
  clientLinkFilterActive = false,
  className,
}: {
  shipmentCount: number;
  lineCount: number;
  filteredCount: number;
  searchActive: boolean;
  clientLinkFilterActive?: boolean;
  archiveMatchCount?: number;
  className?: string;
}) {
  if (searchActive) return null;
  if (clientLinkFilterActive) return null;
  return (
    <div className={cn("min-w-0 flex-1", className)}>
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
    </div>
  );
}

/** Statystyki listy (lewo) + legenda kolorów wierszy (prawo) w jednym pasku. */
function MojeOrdersListMetaStrip({
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
  const stats = (
    <MojeOrdersOverviewStats
      shipmentCount={shipmentCount}
      lineCount={lineCount}
      filteredCount={filteredCount}
      searchActive={searchActive}
      clientLinkFilterActive={clientLinkFilterActive}
      archiveMatchCount={archiveMatchCount}
    />
  );

  return (
    <div
      className={cn(
        salesChromeInsetClass,
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200/80 bg-slate-50/35 py-2.5",
        stats ? "justify-between" : "justify-start"
      )}
    >
      {stats}
      <MyOrdersRowLegend className={stats ? "shrink-0 sm:justify-end" : undefined} />
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
      hintMode="tooltip"
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
  preserveRowOrder = false,
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
  preserveRowOrder?: boolean;
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
      preserveRowOrder={preserveRowOrder}
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
          preserveRowOrder={sectionId === "ordered_progress"}
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
        title="Czekamy na dostawę"
        hint={MY_ORDER_PROGRESS_SECTION_COPY.ordered_progress.hint}
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
  canEdit: canEditProp,
  showProsbaCta = false,
  suppliers = [],
  pageTitle = "Moje zamówienia",
  pageDescription,
  headerActions,
  subiektAvailability,
  subiektReachable = true,
  onSubiektStatusChange,
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
  boardAnnouncements = null,
  boardAnnouncementsError = null,
  focusAnnouncementId = null,
}: {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  archiwumRecent?: MyOrderRow[];
  archiwumExtended?: MyOrderRow[];
  productLineCount?: number;
  canAcknowledge?: boolean;
  canEdit?: boolean;
  showProsbaCta?: boolean;
  suppliers?: OrderFormSupplierOption[];
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: React.ReactNode;
  subiektAvailability?: SubiektAvailability;
  subiektReachable?: boolean;
  onSubiektStatusChange?: (status: SubiektAvailability) => void;
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
  boardAnnouncements?: DepartmentBoardAnnouncementsSlice | null;
  boardAnnouncementsError?: string | null;
  focusAnnouncementId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [imperativeAnnouncementId] = useState<string | null>(
    null
  );
  const [imperativeFocusOrderIds] = useState<string[]>([]);
  const validImperativeAnnouncementId =
    imperativeAnnouncementId &&
    boardAnnouncements?.announcements.some((row) => row.id === imperativeAnnouncementId)
      ? imperativeAnnouncementId
      : null;
  const effectiveFocusAnnouncementId =
    focusAnnouncementId ?? validImperativeAnnouncementId;
  const clientKhFilter =
    initialClientKhId != null && initialClientKhId > 0 ? initialClientKhId : null;
  const clientLinkLabel = (initialClientKhLabel ?? initialClientQuery ?? "").trim() || null;
  const clientZkWatchId = initialClientZkWatchId?.trim() || null;
  const clientZkNumber = initialClientZkNumber?.trim() || null;
  const focusOrderIds = useMemo(() => {
    const fromUrl = parseMojeFocusOrderIds(initialFocusOrderIds);
    if (fromUrl.length) return fromUrl;
    return imperativeFocusOrderIds;
  }, [initialFocusOrderIds, imperativeFocusOrderIds]);
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
  const { query: searchQuery, setQuery: setSearchQuery, trimmed: filterQuery } =
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
    () => filterMyOrderRowsBySearch(khFilteredZamowienia, filterQuery),
    [khFilteredZamowienia, filterQuery]
  );
  const searchFilteredInformacje = useMemo(
    () => filterMyOrderRowsBySearch(khFilteredInformacje, filterQuery),
    [khFilteredInformacje, filterQuery]
  );

  const filteredZamowienia = searchFilteredZamowienia;
  const filteredInformacje = searchFilteredInformacje;

  const searchActive = filterQuery.length > 0;
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
    for (const row of filterMyOrderRowsBySearch(recentKh, filterQuery)) {
      ids.add(row.id);
    }
    for (const row of filterMyOrderRowsBySearch(extendedKh, filterQuery)) {
      ids.add(row.id);
    }
    return ids.size;
  }, [archiwumRecent, archiwumExtended, filterQuery, clientKhFilter, clientLinkFilterOpts]);

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

  const { actionShelfZamowienia, actionTeethZamowienia, actionMixedZamowienia, actionDismissZamowienia } = useMemo(() => {
    const shelf: typeof actionZamowienia = [];
    const teeth: typeof actionZamowienia = [];
    const mixed: typeof actionZamowienia = [];
    const dismiss: typeof actionZamowienia = [];
    for (const row of actionZamowienia) {
      if (row.acknowledgeMode === "mixed_pickup") mixed.push(row);
      else if (row.acknowledgeMode === "teeth_handover") teeth.push(row);
      else if (row.acknowledgeMode === "cancel_notice" || row.acknowledgeMode === "cancelled") dismiss.push(row);
      else shelf.push(row);
    }
    return {
      actionShelfZamowienia: shelf,
      actionTeethZamowienia: teeth,
      actionMixedZamowienia: mixed,
      actionDismissZamowienia: dismiss,
    };
  }, [actionZamowienia]);

  const { actionInformacje, progressInformacje } = useMemo(() => {
    const { needsAction, inProgress } = partitionMyOrderRowsBySalesAction(filteredInformacje);
    return {
      actionInformacje: needsAction,
      progressInformacje: sortInformacjaProgressRows(inProgress),
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

  const actionShelfSectionCallouts = useMyOrderSectionCallouts(actionShelfZamowienia);
  const actionTeethSectionCallouts = useMyOrderSectionCallouts(actionTeethZamowienia);
  const actionMixedSectionCallouts = useMyOrderSectionCallouts(actionMixedZamowienia);
  const informacjeSectionCallouts = useMyOrderSectionCallouts(informacjeListRows);

  const allRows = useMemo(
    () => [...sortedZamowienia, ...sortedInformacje],
    [sortedZamowienia, sortedInformacje]
  );

  /** Pełna liczba pozycji wymagających reakcji — z systemu powiadomień (dzwonek). */
  const inbox = useSalesInbox();
  const needsActionTotal = useMemo(
    () => partitionMyOrderRowsBySalesAction(allRows).needsAction.length,
    [allRows]
  );
  const dayStartActionCount = inbox?.count ?? needsActionTotal;

  const shellPinnedAnnouncementIds = useMemo(
    () =>
      dayStartContext?.boardAttention?.pinnedAnnouncements.map((row) => row.id) ?? [],
    [dayStartContext]
  );

  const announcementsPanel = boardAnnouncementsError ? (
    <Alert tone="error">{boardAnnouncementsError}</Alert>
  ) : boardAnnouncements && boardAnnouncements.announcements.length > 0 ? (
      <MojeAnnouncementsSection
        announcements={boardAnnouncements.announcements}
        readAnnouncementIds={boardAnnouncements.readAnnouncementIds}
        focusAnnouncementId={effectiveFocusAnnouncementId}
        tourDemo={tourPreview}
        shellPinnedAnnouncementIds={shellPinnedAnnouncementIds}
      />
    ) : null;

  const zdDeadlineAutoAck =
    canAcknowledge && !tourPreview ? (
      <ZdFulfillmentDeadlineChangeAutoAck rows={allRows} canAcknowledge={canAcknowledge} />
    ) : null;

  const shipmentCount = zamowienia.length + informacje.length;
  const filteredCount = filteredZamowienia.length + filteredInformacje.length;
  const actionCount = actionZamowienia.length + actionInformacje.length;
  const actionShelfCount = actionShelfZamowienia.length + actionInformacje.length;
  const actionTeethCount = actionTeethZamowienia.length;
  const actionMixedCount = actionMixedZamowienia.length;
  const actionDismissCount = actionDismissZamowienia.length;

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
        matchCount={searchActive ? undefined : searchMatchCount}
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

  const { focusRowIds } = useMojeScrollManagement({
    focusOrderIds,
    initialFocusOrderIds: initialFocusOrderIds ?? null,
    searchActive,
    searchTrimmed: filterQuery,
    searchMatchCount,
    archiveMatchCount,
    filteredZamowienia,
    filteredInformacje,
    archiwumRecentFiltered,
    archiwumExtendedFiltered,
    searchQuery: filterQuery,
  });

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

  const cardDescription = pageDescription;
  const cardHint = pageDescription ? undefined : SALES_PAGE_HEADER_HINTS.moje;
  const cardHeaderAction = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {headerActions}
      <MojeOrdersHelp />
    </div>
  );

  if (!shipmentCount) {
    return (
      <div className="space-y-5">
        {announcementsPanel}
        {zdDeadlineAutoAck}
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="compact"
            title={pageTitle}
            hint={cardHint}
            hintAriaLabel="O liście prośb"
            description={cardDescription}
            action={cardHeaderAction}
            leading={
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconClipboardList size={20} />
              </SectionHeadingIcon>
            }
          />
          {!tourPreview && showSalesSync ? <MojeOrdersSyncStrip /> : null}
          {subiektAvailability ? (
            <SubiektStatusBar
              initial={subiektAvailability}
              embedded
              onStatusChange={onSubiektStatusChange}
            />
          ) : null}
          {hasArchiveData ? searchBar : null}
          {clientKhBanner}
          {searchActive && !archiveMatchCount ? (
            <MojeOrdersSearchEmptyHint query={filterQuery} onClear={() => setSearchQuery("")} />
          ) : null}
          <EmptyState
            title={MICROCOPY.empty.orders.title}
            description={
              hasArchiveData && searchActive && archiveMatchCount > 0
                ? "Brak aktywnych prośb pasujących do wyszukiwania — zobacz archiwum poniżej."
                : SALES_PAGE_HEADER_HINTS.moje
            }
            icon={<IconClipboardList size={28} strokeWidth={1.75} />}
          />
          <div className="border-t border-slate-100 px-3 py-4 sm:px-4">
            <MojeOrdersEmptyGuide showActions={showProsbaCta} embedded />
          </div>
        </Card>
        <MyOrderArchiveSection
          rowsRecent={archiwumRecentFiltered}
          rowsExtended={archiwumExtendedFiltered}
          defaultOpen={tourPreview}
          forceOpen={openArchiveForSearch}
          searchQuery={searchQuery}
          cardIdPrefix={cardDomId}
        />
        <AppBrandContentFooter mobileOnly variant="page" />
      </div>
    );
  }

  const listProps = {
    canAcknowledge,
    canEdit: canEditProp ?? canAcknowledge,
    suppliers,
    searchQuery,
    tourPreview,
    compactActionLayout: true,
    focusRowIds: focusRowIds.size > 0 ? focusRowIds : undefined,
    subiektReachable,
  };

  return (
    <div className="space-y-5">
      {announcementsPanel}
      {zdDeadlineAutoAck}
      <Card padding={false}>
        <CardHeader
          inset
          density="compact"
          title={pageTitle}
          hint={cardHint}
          hintAriaLabel="O liście prośb"
          description={cardDescription}
          action={cardHeaderAction}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconClipboardList size={20} />
            </SectionHeadingIcon>
          }
        />

        {clientKhBanner}

        {!tourPreview && showSalesSync ? <MojeOrdersSyncStrip /> : null}

        {subiektAvailability ? (
          <SubiektStatusBar
            initial={subiektAvailability}
            embedded
            onStatusChange={onSubiektStatusChange}
          />
        ) : null}

        {searchBar}

        <MojeOrdersListMetaStrip
          shipmentCount={shipmentCount}
          lineCount={filteredLineCount}
          filteredCount={filteredCount}
          searchActive={searchActive}
          clientLinkFilterActive={clientLinkFilterActive}
          archiveMatchCount={archiveMatchCount}
        />

        {searchActive && searchMatchCount === 0 && !archiveMatchCount ? (
          <MojeOrdersSearchEmptyHint query={filterQuery} onClear={() => setSearchQuery("")} />
        ) : null}

        {searchActive && searchMatchCount === 0 && archiveMatchCount > 0 ? (
          <MojeOrdersSearchEmptyHint
            query={filterQuery}
            onClear={() => setSearchQuery("")}
            archiveOnly
          />
        ) : null}

        <div className="space-y-3 p-3 sm:p-4">
        {actionCount > 0 ? (
          <div className="space-y-3">
            {actionShelfCount > 0 ? (
              <MojeSectionShell sectionIcon={MY_ORDER_ACTION_SECTION_COPY.icon}>
                <MojeSectionListLabel
                  title={MY_ORDER_ACTION_SECTION_COPY.title}
                  hint={MY_ORDER_ACTION_SECTION_COPY.hint}
                  count={actionShelfCount}
                  accent={MY_ORDER_ACTION_SECTION_COPY.accent}
                  icon={MY_ORDER_ACTION_SECTION_COPY.icon}
                />
                <MyOrderSectionNoticeList
                  callouts={actionShelfSectionCallouts.callouts}
                  singleHints={actionShelfSectionCallouts.singleHints}
                />
                <MyOrderShipmentBlock
                  embedded
                  rows={actionShelfZamowienia}
                  listKind="zamowienie"
                  showProgress
                  suppressedSectionPatterns={actionShelfSectionCallouts.suppressedPatterns}
                  {...listProps}
                />
                <MyOrderShipmentBlock
                  embedded
                  continuation
                  rows={actionInformacje}
                  listKind="informacja"
                  showProgress={false}
                  suppressedSectionPatterns={actionShelfSectionCallouts.suppressedPatterns}
                  {...listProps}
                />
              </MojeSectionShell>
            ) : null}
            {actionMixedCount > 0 ? (
              <MojeSectionShell sectionIcon={MY_ORDER_MIXED_ACTION_SECTION_COPY.icon}>
                <MojeSectionListLabel
                  title={MY_ORDER_MIXED_ACTION_SECTION_COPY.title}
                  hint={MY_ORDER_MIXED_ACTION_SECTION_COPY.hint}
                  count={actionMixedCount}
                  accent={MY_ORDER_MIXED_ACTION_SECTION_COPY.accent}
                  icon={MY_ORDER_MIXED_ACTION_SECTION_COPY.icon}
                />
                <MyOrderSectionNoticeList
                  callouts={actionMixedSectionCallouts.callouts}
                  singleHints={actionMixedSectionCallouts.singleHints}
                />
                <MyOrderShipmentBlock
                  embedded
                  rows={actionMixedZamowienia}
                  listKind="zamowienie"
                  showProgress
                  suppressedSectionPatterns={actionMixedSectionCallouts.suppressedPatterns}
                  {...listProps}
                />
              </MojeSectionShell>
            ) : null}
            {actionTeethCount > 0 ? (
              <MojeSectionShell sectionIcon={MY_ORDER_TEETH_ACTION_SECTION_COPY.icon}>
                <MojeSectionListLabel
                  title={MY_ORDER_TEETH_ACTION_SECTION_COPY.title}
                  hint={MY_ORDER_TEETH_ACTION_SECTION_COPY.hint}
                  count={actionTeethCount}
                  accent={MY_ORDER_TEETH_ACTION_SECTION_COPY.accent}
                  icon={MY_ORDER_TEETH_ACTION_SECTION_COPY.icon}
                />
                <MyOrderSectionNoticeList
                  callouts={actionTeethSectionCallouts.callouts}
                  singleHints={actionTeethSectionCallouts.singleHints}
                />
                <MyOrderShipmentBlock
                  embedded
                  rows={actionTeethZamowienia}
                  listKind="zamowienie"
                  showProgress
                  suppressedSectionPatterns={actionTeethSectionCallouts.suppressedPatterns}
                  {...listProps}
                />
              </MojeSectionShell>
            ) : null}
            {actionDismissCount > 0 ? (
              <MojeSectionShell sectionIcon={MY_ORDER_DISMISS_SECTION_COPY.icon}>
                <MojeSectionListLabel
                  title={MY_ORDER_DISMISS_SECTION_COPY.title}
                  hint={MY_ORDER_DISMISS_SECTION_COPY.hint}
                  count={actionDismissCount}
                  accent={MY_ORDER_DISMISS_SECTION_COPY.accent}
                  icon={MY_ORDER_DISMISS_SECTION_COPY.icon}
                />
                <MyOrderShipmentBlock
                  embedded
                  rows={actionDismissZamowienia}
                  listKind="zamowienie"
                  showProgress={false}
                  {...listProps}
                />
              </MojeSectionShell>
            ) : null}
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
              preserveRowOrder
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
        cardIdPrefix={cardDomId}
      />
      <AppBrandContentFooter mobileOnly variant="page" />
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
