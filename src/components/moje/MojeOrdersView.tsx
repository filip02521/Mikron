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
import { Alert } from "@/components/ui/Alert";
import { MyOrderArchiveSection } from "@/components/moje/MyOrderArchiveSection";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { MyOrdersInboxSummary } from "@/components/moje/MyOrdersInboxSummary";
import { MojeStickyPickupBar } from "@/components/moje/MojeStickyPickupBar";
import { MojeOrdersHelp } from "@/components/moje/MojeOrdersGuide";
import { MojeOrdersEmptyGuide } from "@/components/moje/MojeOrdersEmptyGuide";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconClipboardList,
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6">
      {narrowed ? (
        <p className="text-xs leading-relaxed text-slate-600" aria-live="polite">
          Pokazano{" "}
          <span className="font-semibold tabular-nums text-slate-900">{filteredCount}</span>
          {" z "}
          <span className="font-semibold tabular-nums text-slate-900">{shipmentCount}</span>
          {activeFilter ? (
            <span className="ml-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-900">
              filtr
            </span>
          ) : null}
          {searchActive ? (
            <span className="ml-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
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
          id={`moje-section-${icon}`}
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
  searchQuery,
  embedded = false,
  continuation = false,
  tourPreview = false,
}: {
  rows: MyOrderRow[];
  listKind: "zamowienie" | "informacja";
  showProgress: boolean;
  canAcknowledge: boolean;
  suppliers: { id: string; name: string }[];
  searchQuery?: string | null;
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
      searchQuery={searchQuery}
      embedded={embedded}
      continuation={continuation}
      tourPreview={tourPreview}
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
  syncSearchUrl = true,
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
  initialSearchQuery?: string | null;
  initialClientQuery?: string | null;
  initialClientKhId?: number | null;
  /** Etykieta z ?klient= (link z notatnika ZK). */
  initialClientKhLabel?: string | null;
  syncSearchUrl?: boolean;
  tourPreview?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<MyOrderInboxFilter | null>(null);
  const initialQ = (initialSearchQuery ?? initialClientQuery ?? "").trim();
  const clientKhFilter =
    initialClientKhId != null && initialClientKhId > 0 ? initialClientKhId : null;
  const { query: searchQuery, setQuery: setSearchQuery, trimmed: searchTrimmed } =
    useMojeOrdersSearch(initialQ, syncSearchUrl && !tourPreview);

  const sortedZamowienia = useMemo(() => sortMyOrderRows(zamowienia), [zamowienia]);
  const sortedInformacje = useMemo(() => sortMyOrderRows(informacje), [informacje]);

  const khFilteredZamowienia = useMemo(
    () => filterMyOrderRowsByClientKh(sortedZamowienia, clientKhFilter),
    [sortedZamowienia, clientKhFilter]
  );
  const khFilteredInformacje = useMemo(
    () => filterMyOrderRowsByClientKh(sortedInformacje, clientKhFilter),
    [sortedInformacje, clientKhFilter]
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
  const clientKhFilterActive = clientKhFilter != null;
  const searchMatchCount = searchFilteredZamowienia.length + searchFilteredInformacje.length;

  const archiveMatchCount = useMemo(() => {
    const ids = new Set<string>();
    const recentKh = filterMyOrderRowsByClientKh(archiwumRecent, clientKhFilter);
    const extendedKh = filterMyOrderRowsByClientKh(archiwumExtended, clientKhFilter);
    for (const row of filterMyOrderRowsBySearch(recentKh, searchQuery)) {
      ids.add(row.id);
    }
    for (const row of filterMyOrderRowsBySearch(extendedKh, searchQuery)) {
      ids.add(row.id);
    }
    return ids.size;
  }, [archiwumRecent, archiwumExtended, searchQuery, clientKhFilter]);

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
    () => filterMyOrderRowsByClientKh(archiwumRecent, clientKhFilter),
    [archiwumRecent, clientKhFilter]
  );
  const archiwumExtendedFiltered = useMemo(
    () => filterMyOrderRowsByClientKh(archiwumExtended, clientKhFilter),
    [archiwumExtended, clientKhFilter]
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

  const clientKhBanner =
    clientKhFilterActive && clientKhFilter != null ? (
      <Suspense fallback={null}>
        <MojeClientKhFilterBanner
          clientKhId={clientKhFilter}
          clientLabel={clientKhDisplayLabel}
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
    const el =
      document.querySelector<HTMLElement>(`#${cardDomId(first)} [data-moje-row-toggle]`) ??
      document.getElementById(cardDomId(first));
    if (!(el instanceof HTMLElement)) return;
    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    el.focus({ preventScroll: true });
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
          {hasArchiveData ? searchBar : null}
          {clientKhBanner}
          {searchActive && !archiveMatchCount ? (
            <MojeOrdersSearchEmptyHint query={searchTrimmed} onClear={() => setSearchQuery("")} />
          ) : null}
          <EmptyState
            title="Brak aktywnych prośb"
            description={
              hasArchiveData && searchActive && archiveMatchCount > 0
                ? "Brak aktywnych prośb pasujących do wyszukiwania — zobacz archiwum poniżej."
                : cardDescription
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
  };

  return (
    <div className="space-y-5">
      <Card padding={false}>
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
            !activeFilter || activeFilter === "pickup" || activeFilter === "action_group"
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

        <div className="space-y-4 p-3 sm:p-4">
        {splitByAction && actionCount > 0 ? (
          <div className={mojeShipmentSectionShellClass} aria-labelledby="moje-section-action">
            <ListSectionLabel
              title="Do potwierdzenia"
              hint="Kliknij strzałkę przy wierszu, żeby zobaczyć produkty. Potwierdź odbiór lub powiadomienie zielonym przyciskiem."
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
            <CardHeader inset title={props.pageTitle ?? "Moje zamówienia"} />
            <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
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
