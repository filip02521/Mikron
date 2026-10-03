"use client";

import { SupplierOrderFormList } from "@/components/summary/SupplierOrderFormList";
import { findSupplierFormTemplate } from "@/lib/supplier-forms/templates";
import {
  buildZdEstimateLaunchHref,
  type SupplierSubiektScopeInfo,
} from "@/lib/orders/zd-estimate-supplier-scope";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import {
  formatPlDate,
  formatStockPeriod,
  formatSupplierInterval,
  locationLabel,
  vacationNoteLabel,
} from "@/lib/display-labels";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ShiftMenu } from "@/components/summary/ShiftMenu";
import { actionFetchSupplierRecentHistory, actionMarkOrdered, actionShiftOrder } from "@/app/actions/admin";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { cn } from "@/lib/cn";
import { sidePanelBackdropClass, sidePanelShellClass, sidePanelCloseButtonClass, sidePanelHeaderClass, sidePanelContentClass } from "@/lib/ui/surfaces";
import {
  IconX,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconTruck,
  IconDownload,
  IconPackageCheck,
  IconLink,
  IconLinkOff,
  IconCircleCheck,
  IconSun,
  IconMail,
  IconClipboardList,
  IconArchive,
  IconChevronRight,
  IconPencil,
} from "@/components/icons/StrokeIcons";
import { warsawTodayDateKey } from "@/lib/warehouse/delivery-receipts-shared";
import {
  formatSupplierMinOrder,
  supplierDueInfo,
  type SupplierDueTone,
} from "@/lib/orders/supplier-drawer-view";
import { useSupplierHubContext } from "@/components/layout/AppRoleContext";
import { supplierCardsHref } from "@/lib/supplier-hub";
import { TeethDualLaneNotice } from "@/components/teeth/TeethDualLaneNotice";
import type { TeethSupplierLaneSnapshot } from "@/lib/data/teeth-schedule-shared";
import { TEETH_DUAL_LANE_COPY } from "@/lib/teeth/teeth-supplier-dual-lane";
import { SupplierDrawerLeadTime } from "@/components/summary/SupplierDrawerLeadTime";
import type { DeliveryStats, StatsMode } from "@/types/database";
import { supplierHistoriaHref } from "@/lib/orders/historia-links";
import {
  DAILY_PANEL_MARK_ORDERED_LABEL,
  DAILY_PANEL_MARK_ORDERED_PENDING,
  DAILY_PANEL_MARK_ORDERED_PENDING_OVERLAY,
  dailyPanelMarkOrderedConfirmLabel,
  dailyPanelMarkOrderedConfirmMessage,
  dailyPanelMarkOrderedConfirmTitle,
  dailyPanelMarkOrderedToastTitle,
} from "@/lib/orders/daily-panel-mark-ordered-copy";
import {
  formatSupplierVacationRangeCompact,
  formatSupplierVacationRangeTitle,
  type SupplierOnVacationWindow,
} from "@/lib/orders/procurement-supplier-vacation";

type HistoryRow = {
  action_at: string;
  action: string;
  user_email: string;
  next_date: string | null;
};

const SUPPLIER_HISTORY_CACHE_TTL_MS = 60_000;
const supplierHistoryCache = new Map<
  string,
  { at: number; rows: HistoryRow[] }
>();

export function SupplierDrawer({
  supplier,
  vacationWindow = null,
  teethLane,
  subiektScope = null,
  deliveryStats,
  statsMode = "LACZNIE",
  leadTimeDisplay,
  onClose,
  isScopePending,
  run,
  onVacation,
  onEdit,
  canPrepareZd = false,
  mode = "panel",
}: {
  supplier: SupplierSummaryMeta | null;
  /** Aktywne okno urlopu obejmujące dziś (kalendarz) — z datami. */
  vacationWindow?: SupplierOnVacationWindow | null;
  teethLane?: TeethSupplierLaneSnapshot | null;
  /** Powiązanie z grupą albo cechą Subiekta (null = brak mapowania). */
  subiektScope?: SupplierSubiektScopeInfo | null;
  /** Statystyki z `delivery_stats` — średni czas dostawy (SSR panelu). */
  deliveryStats?: DeliveryStats | null;
  statsMode?: StatsMode;
  leadTimeDisplay?: import("@/lib/orders/delivery-eta").LeadTimeDisplayOptions;
  onClose: () => void;
  /** Wymagane w trybie „panel” (akcje panelu dziennego). */
  isScopePending?: (supplierId: string) => boolean;
  run?: DailyPanelRunFn;
  onVacation?: () => void;
  onEdit?: () => void;
  /** Przygotuj ZD / kreator ZD — operacje dostaw (admin + zakupy). */
  canPrepareZd?: boolean;
  /**
   * „panel” — szuflada panelu dziennego z akcjami (Zamówione, Przesuń, Urlop…).
   * „preview” — sam podgląd nad innym oknem (np. podsumowanie ZD): bez akcji zmieniających
   * termin, z przejściem do panelu dziennego; warstwa nad modalem, Escape zamyka tylko podgląd.
   */
  mode?: "panel" | "preview";
}) {
  const preview = mode === "preview";
  const hubContext = useSupplierHubContext();
  useBodyScrollLock(Boolean(supplier));
  const supplierId = supplier?.id ?? null;
  /** Confirm „Zamówione” — powiązany z id; zmiana dostawcy zamyka dialog bez effectu. */
  const [markConfirmForId, setMarkConfirmForId] = useState<string | null>(null);
  const markConfirmOpen = Boolean(supplierId && markConfirmForId === supplierId);
  const [historyState, setHistoryState] = useState<{
    supplierId: string | null;
    rows: HistoryRow[];
    loading: boolean;
  }>({ supplierId: null, rows: [], loading: false });
  /** Rozwinięta pełna historia — per dostawca, zmiana dostawcy zwija. */
  const [historyExpandedFor, setHistoryExpandedFor] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Podgląd nad modalem: Escape zamyka tylko podgląd, a Tab nie trafia do pułapki fokusu
  // modalu pod spodem (listenery w fazie przechwytywania, przed modalem).
  useEffect(() => {
    if (!preview || !supplierId) return;
    const raf = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [preview, supplierId]);

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    const cached = supplierHistoryCache.get(supplierId);
    if (cached && Date.now() - cached.at < SUPPLIER_HISTORY_CACHE_TTL_MS) {
      queueMicrotask(() => {
        if (!cancelled) {
          setHistoryState({ supplierId, rows: cached.rows, loading: false });
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setHistoryState({ supplierId, rows: [], loading: true });
      }
    });
    actionFetchSupplierRecentHistory(supplierId)
      .then((rows) => {
        if (!cancelled) {
          supplierHistoryCache.set(supplierId, { at: Date.now(), rows });
          setHistoryState({ supplierId, rows, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryState({ supplierId, rows: [], loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  useEffect(() => {
    if (!supplier || preview || !isScopePending) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key !== "z" && e.key !== "Z") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (markConfirmOpen) return;
      if (isScopePending(supplier.id)) return;
      e.preventDefault();
      setMarkConfirmForId(supplier.id);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supplier, markConfirmOpen, isScopePending, preview]);

  if (!supplier) return null;

  const history = historyState.supplierId === supplier.id ? historyState.rows : [];
  const historyLoading = historyState.supplierId === supplier.id && historyState.loading;

  const rowPending = isScopePending?.(supplier.id) ?? false;
  const scope = { scope: supplier.id };
  const scheduleHref = `/lokalizacje/${supplier.location}?q=${encodeURIComponent(supplier.name)}`;
  const cardsHref = supplierCardsHref(hubContext, {
    q: supplier.name,
    ...(supplier.subiekt_kh_id == null ? { powiaz: true as const } : {}),
  });

  const confirmMarkOrdered = () => {
    if (rowPending || !run) return;
    run(
      () => actionMarkOrdered(supplier.id),
      dailyPanelMarkOrderedToastTitle(supplier.name),
      DAILY_PANEL_MARK_ORDERED_PENDING_OVERLAY,
      {
        ...scope,
        onSuccess: () => {
          setMarkConfirmForId(null);
          onClose();
        },
        onError: () => {
          setMarkConfirmForId(null);
        },
      }
    );
  };

  const due = supplierDueInfo(supplier.computed_next_date, warsawTodayDateKey());
  const minOrder = formatSupplierMinOrder(supplier.min_order_value, supplier.min_order_currency);
  const hasPickup = supplier.pickup_mikran || supplier.pickup_pallet;
  const historyExpanded = historyExpandedFor === supplier.id;
  const shownHistory = historyExpanded ? history : history.slice(0, HISTORY_PREVIEW);

  const drawer = (
    <>
      <ConfirmDialog
        open={markConfirmOpen && !preview}
        title={dailyPanelMarkOrderedConfirmTitle()}
        message={dailyPanelMarkOrderedConfirmMessage(supplier.name)}
        confirmLabel={dailyPanelMarkOrderedConfirmLabel()}
        pending={rowPending}
        tier="raised"
        onCancel={() => {
          if (rowPending) return;
          setMarkConfirmForId(null);
        }}
        onConfirm={confirmMarkOrdered}
      />
      <button
        type="button"
        className={cn(sidePanelBackdropClass, "panel-slide-backdrop-enter", preview && "z-[70]")}
        aria-label="Zamknij panel"
        onClick={() => {
          if (markConfirmOpen || rowPending) return;
          onClose();
        }}
      />
      <aside
        className={cn(sidePanelShellClass, "panel-slide-enter", preview && "z-[71]")}
        aria-labelledby="supplier-drawer-title"
        role={preview ? "dialog" : undefined}
        aria-modal={preview ? true : undefined}
      >
        <header className={sidePanelHeaderClass}>
          {/* Tożsamość + stan dostawcy */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="neutral" icon={<IconBuilding size={12} />}>
                  {locationLabel(supplier.location)}
                </Chip>
                {supplier.order_on_demand ? (
                  <Chip tone="violet" icon={<IconPackageCheck size={12} />} title="Bez stałego terminu w planie tygodnia">
                    Na żądanie
                  </Chip>
                ) : null}
                {vacationWindow ? (
                  <Chip
                    tone="amber"
                    icon={<IconSun size={12} />}
                    title={`Urlop ${formatSupplierVacationRangeTitle(vacationWindow)}`}
                  >
                    Urlop {formatSupplierVacationRangeCompact(vacationWindow)}
                  </Chip>
                ) : null}
                {supplier.vacation_note ? (
                  <Chip tone="neutral" icon={<IconCalendar size={12} />}>
                    {vacationNoteLabel(supplier.vacation_note)}
                  </Chip>
                ) : null}
              </div>
              <h2
                id="supplier-drawer-title"
                className="mt-1.5 truncate text-lg font-semibold text-slate-900"
                title={supplier.name}
              >
                {supplier.name}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className={sidePanelCloseButtonClass}
              onClick={() => {
                if (rowPending) return;
                setMarkConfirmForId(null);
                onClose();
              }}
              aria-label="Zamknij"
              disabled={rowPending}
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Najważniejsze: kiedy zamówić */}
          <div
            className={cn(
              "mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset",
              DUE_TONE_CLASS[due.tone],
            )}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide opacity-75">
                {supplier.order_on_demand ? "Zamówienie na żądanie" : "Następne zamówienie"}
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">
                {supplier.computed_next_date ? formatPlDate(supplier.computed_next_date) : "—"}
                {due.relative ? (
                  <span className="ml-2 text-sm font-medium opacity-80">· {due.relative}</span>
                ) : null}
              </p>
            </div>
            {supplier.shift_date ? (
              <span
                className="shrink-0 rounded-md bg-white/70 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
                title="Termin przesunięty ręcznie"
              >
                przesunięte ręcznie
              </span>
            ) : null}
          </div>

          {preview ? (
            // Podgląd: termin i plan zmienia się w krokach okna, z którego otwarto podgląd —
            // tu tylko przejścia do pełnych widoków.
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link
                href={`/podsumowanie?view=dzis&supplierId=${encodeURIComponent(supplier.id)}`}
                className="block w-full"
              >
                <Button variant="secondary" size="sm" className="w-full justify-center">
                  <IconCalendar size={15} className="shrink-0" />
                  Otwórz w panelu dziennym
                </Button>
              </Link>
              <Link href={cardsHref} className="block w-full">
                <Button variant="ghost" size="sm" className="w-full justify-center">
                  <IconPencil size={15} className="shrink-0" />
                  Karta dostawcy
                </Button>
              </Link>
            </div>
          ) : (
            <>
          {/* Akcje: główne duże, pomocnicze mniejsze */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                variant="primary"
                size="sm"
                disabled={rowPending}
                aria-busy={rowPending}
                className={cn("w-full justify-center", !canPrepareZd && "sm:col-span-2")}
                onClick={() => setMarkConfirmForId(supplier.id)}
                title="Skrót klawiszowy: Z"
              >
                <IconCircleCheck size={15} className={cn("shrink-0", rowPending && "animate-pulse")} />
                {rowPending ? DAILY_PANEL_MARK_ORDERED_PENDING : DAILY_PANEL_MARK_ORDERED_LABEL}
                {!rowPending ? (
                  <kbd className="ml-1 hidden rounded border border-white/30 px-1 text-[10px] font-semibold leading-4 sm:inline">
                    Z
                  </kbd>
                ) : null}
              </Button>
              {canPrepareZd ? (
                <Link
                  href={buildZdEstimateLaunchHref(supplier.id)}
                  className="block w-full"
                >
                  <Button variant="secondary" size="sm" className="w-full justify-center">
                    <IconClipboardList size={15} className="shrink-0" />
                    Przygotuj ZD
                  </Button>
                </Link>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ShiftMenu
                disabled={rowPending}
                onShiftWeeks={(w) =>
                  run?.(
                    () => actionShiftOrder(supplier.id, w, null),
                    `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
                    `Przesuwanie terminu…`,
                    scope
                  )
                }
                onShiftDate={(iso) =>
                  run?.(
                    () => actionShiftOrder(supplier.id, null, iso),
                    "Ustawiono datę przesunięcia",
                    "Zapisywanie daty…",
                    scope
                  )
                }
              />
              <Button variant="ghost" size="sm" disabled={rowPending} onClick={onVacation}>
                <IconSun size={14} className="shrink-0" />
                Urlop
              </Button>
              <Button variant="ghost" size="sm" disabled={rowPending} onClick={onEdit}>
                <IconPencil size={14} className="shrink-0" />
                Edytuj dane
              </Button>
            </div>
            </>
          )}
        </header>

        <div
          className={cn(sidePanelContentClass, "space-y-6")}
          {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
        >
          <DrawerSection
            title="Jak zamówić"
            hint="Kontakt, sposób składania i warunki"
            icon={<IconMail size={14} />}
          >
            <SupplierContactActions
              notes={supplier.notes}
              mails={supplier.mails}
              extraInfo={supplier.extra_info}
            />
            <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200/70">
              <Row label="Minimum zamówienia" value={minOrder ?? "brak"} muted={!minOrder} />
              {supplier.extra_info?.trim() && supplier.mails?.trim() ? (
                <Row label="Uwagi" value={supplier.extra_info} multiline />
              ) : null}
            </dl>
          </DrawerSection>

          {findSupplierFormTemplate(supplier.name) ? (
            <DrawerSection
              title="Formularz zamówienia"
              hint="Formularz dostawcy (PDF) wypełniony pozycjami z ZD — gotowy do wysłania"
              icon={<IconDownload size={14} />}
            >
              <SupplierOrderFormList supplierId={supplier.id} />
            </DrawerSection>
          ) : null}

          <DrawerSection
            title="Terminy i rytm"
            hint={TEETH_DUAL_LANE_COPY.dailyPanelScheduleCaption}
            icon={<IconCalendar size={14} />}
            action={
              <Link href={scheduleHref} className={sectionLinkClass}>
                Plan terminów
                <IconChevronRight size={13} />
              </Link>
            }
          >
            <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200/70">
              <Row label="Ostatnie zamówienie" value={formatPlDate(supplier.order_date)} />
              <Row
                label="Następne zamówienie"
                value={supplier.computed_next_date ? formatPlDate(supplier.computed_next_date) : "—"}
                strong
              />
              {supplier.shift_date ? (
                <Row label="Ręczne przesunięcie" value={formatPlDate(supplier.shift_date)} />
              ) : null}
              <Row
                label="Częstotliwość"
                value={
                  supplier.order_on_demand
                    ? "na żądanie"
                    : formatSupplierInterval(supplier.interval_raw, supplier.interval_weeks)
                }
              />
              <Row label="Zapas" value={formatStockPeriod(supplier.stock_raw, supplier.stock)} />
            </dl>
            <SupplierDrawerLeadTime
              className="mt-2.5"
              stats={deliveryStats}
              statsMode={supplier.stats_mode ?? statsMode}
              leadTimeDisplay={leadTimeDisplay}
            />
            {teethLane ? <TeethDualLaneNotice lane={teethLane} /> : null}
          </DrawerSection>

          <DrawerSection title="Odbiór towaru" hint="Kto odbiera dostawę" icon={<IconTruck size={14} />}>
            {hasPickup ? (
              <div className="flex flex-wrap gap-2">
                {supplier.pickup_mikran ? (
                  <Chip tone="indigo" icon={<IconTruck size={12} />}>
                    Kierowca Mikran
                  </Chip>
                ) : null}
                {supplier.pickup_pallet ? (
                  <Chip tone="indigo" icon={<IconPackageCheck size={12} />}>
                    Zlecenie odbioru palety
                  </Chip>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Dostawca wysyła sam — bez zlecanego odbioru.</p>
            )}
          </DrawerSection>

          <DrawerSection
            title="Powiązania z Subiektem"
            hint="Od tego zależy auto-dostawca i zakres „Przygotuj ZD”"
            icon={<IconLink size={14} />}
          >
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200/70">
              <LinkRow
                ok={supplier.subiekt_kh_id != null}
                label="Kontrahent"
                value={
                  supplier.subiekt_kh_id != null ? `powiązany · kh_Id ${supplier.subiekt_kh_id}` : "brak powiązania"
                }
                hint={
                  supplier.subiekt_kh_id != null
                    ? "Auto-dostawca na ZD trafia poprawnie."
                    : "Auto-dostawca na ZD może nie trafić."
                }
                action={
                  <Link href={cardsHref} className={sectionLinkClass}>
                    {supplier.subiekt_kh_id != null ? "Zmień" : "Powiąż"}
                  </Link>
                }
              />
              <LinkRow
                ok={Boolean(subiektScope)}
                label={subiektScope ? (subiektScope.mode === "cecha" ? "Cecha towarów" : "Grupa towarów") : "Grupa / cecha"}
                value={
                  subiektScope
                    ? `${subiektScope.label || "bez nazwy"} · ${subiektScope.mode === "cecha" ? "ctw_Id" : "grt_Id"} ${subiektScope.id}${
                        subiektScope.extraLabels?.length
                          ? ` + ${subiektScope.extraLabels.join(", ")}`
                          : ""
                      }`
                    : "brak powiązania"
                }
                hint={
                  subiektScope
                    ? subiektScope.extraLabels?.length
                      ? `„Przygotuj ZD” liczy razem ${subiektScope.extraLabels.length + 1} zakresy dostawcy.`
                      : `„Przygotuj ZD” liczy towary z tej ${subiektScope.mode === "cecha" ? "cechy" : "grupy"}.`
                    : "„Przygotuj ZD” spróbuje dopasować po nazwie dostawcy."
                }
              />
            </div>
          </DrawerSection>

          <DrawerSection
            title="Historia"
            hint="Ostatnie akcje w panelu dziennym"
            icon={<IconClock size={14} />}
          >
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="h-3 w-3 animate-pulse rounded-full bg-slate-300" />
                Ładowanie historii…
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400">Brak zapisów w historii.</p>
            ) : (
              <>
                <ol className="relative space-y-3 pl-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-slate-200">
                  {shownHistory.map((h, i) => (
                    <li key={`${h.action_at}-${i}`} className="relative">
                      <span className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-2 ring-white" />
                      <p className="text-sm font-medium text-slate-800">
                        {h.action}
                        {h.next_date ? (
                          <span className="font-normal text-slate-500">
                            {" "}→ następne {formatPlDate(h.next_date)}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className="tabular-nums">{formatPlDate(h.action_at.slice(0, 10))}</span>
                        <span className="text-slate-300"> · </span>
                        {h.user_email}
                      </p>
                    </li>
                  ))}
                </ol>
                {history.length > HISTORY_PREVIEW ? (
                  <button
                    type="button"
                    onClick={() => setHistoryExpandedFor(historyExpanded ? null : supplier.id)}
                    className={cn(sectionLinkClass, "mt-2")}
                  >
                    {historyExpanded ? "Pokaż mniej" : `Pokaż wszystkie (${history.length})`}
                  </button>
                ) : null}
              </>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link
                href={supplierHistoriaHref("normal", { id: supplier.id, name: supplier.name })}
                title="Zamówienia z panelu dziennego u tego dostawcy"
                className={historyLinkClass}
              >
                <IconArchive size={14} className="shrink-0 text-slate-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">Zamówienia standardowe</span>
                  <span className="block text-[11px] text-slate-500">z panelu dziennego</span>
                </span>
              </Link>
              <Link
                href={supplierHistoriaHref("individual", { id: supplier.id, name: supplier.name })}
                title="Prośby handlowców u tego dostawcy"
                className={historyLinkClass}
              >
                <IconClipboardList size={14} className="shrink-0 text-slate-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">Prośby indywidualne</span>
                  <span className="block text-[11px] text-slate-500">od handlowców</span>
                </span>
              </Link>
            </div>
          </DrawerSection>
        </div>
      </aside>
    </>
  );
  // Podgląd nad modalem: portal do <body> — <main> ma własny kontekst warstw (isolate),
  // w którym szuflada zostałaby pod oknem renderowanym portalem.
  return preview ? createPortal(drawer, document.body) : drawer;
}

const HISTORY_PREVIEW = 4;

const DUE_TONE_CLASS: Record<SupplierDueTone, string> = {
  overdue: "bg-red-50 text-red-900 ring-red-200",
  today: "bg-indigo-50 text-indigo-900 ring-indigo-200",
  soon: "bg-sky-50 text-sky-900 ring-sky-200",
  later: "bg-slate-50 text-slate-800 ring-slate-200",
  none: "bg-slate-50 text-slate-700 ring-slate-200",
};

const sectionLinkClass =
  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 hover:text-indigo-900";

const historyLinkClass =
  "flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50";

const CHIP_TONE: Record<"neutral" | "amber" | "violet" | "indigo", string> = {
  neutral: "bg-slate-50 text-slate-700 ring-slate-200/80",
  amber: "bg-amber-50 text-amber-900 ring-amber-200/80",
  violet: "bg-violet-50 text-violet-900 ring-violet-200/80",
  indigo: "bg-indigo-50 text-indigo-900 ring-indigo-200/80",
};

function Chip({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof CHIP_TONE;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        CHIP_TONE[tone],
      )}
    >
      {icon ? <span className="shrink-0 opacity-70">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function DrawerSection({
  title,
  hint,
  icon,
  action,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            {icon ? <span className="text-slate-400">{icon}</span> : null}
            {title}
          </h3>
          {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  multiline,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={cn("flex gap-3 px-3 py-2", multiline ? "flex-col gap-0.5" : "items-baseline justify-between")}>
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd
        className={cn(
          "text-sm",
          multiline ? "whitespace-pre-line text-slate-700" : "text-right tabular-nums",
          strong ? "font-semibold text-slate-900" : muted ? "text-slate-400" : "font-medium text-slate-800",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function LinkRow({
  ok,
  label,
  value,
  hint,
  action,
}: {
  ok: boolean;
  label: string;
  value: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
        )}
        aria-hidden
      >
        {ok ? <IconLink size={13} /> : <IconLinkOff size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cn("text-sm font-medium", ok ? "text-slate-900" : "text-amber-800")}>{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
