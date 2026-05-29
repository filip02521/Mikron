import type {
  IndividualOrder,
  StatsMode,
  SupplierLocation,
  SupplierWithSchedule,
} from "@/types/database";
import { LOCATION_FLAGS } from "@/types/database";
import {
  formatDateString,
  getFridayOfWeek,
  getMondayOfWeek,
  parseDateOnly,
  toDateOnly,
} from "./dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { getVacationMessage } from "./colors";
import type { SummaryItem, SummaryStandardItem, SummaryView } from "./summary";
import {
  buildSalesCancelledNotices,
  type SalesCancelledNotice,
} from "@/lib/orders/sales-cancelled-notices";
import { mapOrderToForSomeoneLine } from "@/lib/orders/product-source";
import {
  canShowInForSomeoneLeft,
  isInformacjaQueueViaDailyPanel,
} from "@/lib/orders/informacja-via-daily-panel";
import { isSupplierOrderOnDemand } from "@/lib/orders/supplier-on-demand";
import {
  formatStockPeriod,
  formatSupplierInterval,
  locationLabel,
} from "@/lib/display-labels";
import {
  buildDailyPanelHiddenReport,
  type DailyPanelHiddenReport,
} from "@/lib/orders/daily-panel-hidden";

export type SupplierSummaryMeta = {
  id: string;
  name: string;
  location: SupplierLocation;
  mails: string;
  notes: string;
  extra_info: string;
  interval_raw: string | null;
  interval_weeks: number | null;
  stock_raw: string | null;
  stock: number | null;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  order_on_demand: boolean;
  is_active: boolean;
  order_date: string | null;
  shift_date: string | null;
  computed_next_date: string | null;
  vacation_note: string | null;
  stats_mode: StatsMode;
  subiekt_kh_id: number | null;
};

export type ForSomeoneLine = {
  id: string;
  products: string;
  symbol: string;
  mikranCode?: string | null;
  quantity: string;
  fromSubiekt: boolean;
  subiektTwId?: number | null;
  /** Informacja z opcją „najpierw panel Dziś”. */
  informacjaViaPanel?: boolean;
};

export type SummaryForSomeoneEnriched = {
  kind: "forSomeone";
  supplierId: string;
  salesPersonId: string;
  supplierName: string;
  flaggedName: string;
  location: SupplierLocation;
  person: string;
  displayText: string;
  hoverNote: string;
  lines: ForSomeoneLine[];
  orderIds: string[];
  shift: "[DLA KOGOŚ]";
  status: string;
  nextDate: Date;
};

export type WeekDayPlan = {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
  isToday: boolean;
  isPast: boolean;
  items: SummaryStandardItem[];
};

export type SummaryInformacjaEnriched = Omit<SummaryForSomeoneEnriched, "kind"> & {
  kind: "informacja";
};

export type OnDemandSupplierRow = {
  supplierId: string;
  supplierName: string;
  location: SupplierLocation;
  locationLabel: string;
  stockLabel: string;
  intervalLabel: string;
  mails: string;
  notes: string;
};

export type SummaryWorkspaceData = SummaryView & {
  supplierMeta: Record<string, SupplierSummaryMeta>;
  onDemandSuppliers: OnDemandSupplierRow[];
  thisWeekDays: WeekDayPlan[];
  nextWeekDays: WeekDayPlan[];
  forSomeoneLeft: SummaryForSomeoneEnriched[];
  informacjaLeft: SummaryInformacjaEnriched[];
  salesCancelledNotices: SalesCancelledNotice[];
  panelHidden: DailyPanelHiddenReport;
};

const DAY_NAMES = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

function flagName(name: string, location: SupplierLocation): string {
  return `${LOCATION_FLAGS[location]}${name}`;
}

type TargetRow = {
  supplier: SupplierWithSchedule;
  nextDate: Date;
  vacationNote: string | null;
};

function toMeta(s: SupplierWithSchedule): SupplierSummaryMeta {
  const sch = s.schedule;
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    mails: s.mails ?? "",
    notes: s.notes ?? "",
    extra_info: s.extra_info ?? "",
    interval_raw: s.interval_raw ?? null,
    interval_weeks: s.interval_weeks != null ? Number(s.interval_weeks) : null,
    stock_raw: s.stock_raw ?? null,
    stock: s.stock != null ? Number(s.stock) : null,
    pickup_mikran: s.pickup_mikran,
    pickup_pallet: s.pickup_pallet,
    order_on_demand: isSupplierOrderOnDemand(s),
    is_active: s.is_active !== false,
    order_date: sch?.order_date ?? null,
    shift_date: sch?.shift_date ?? null,
    computed_next_date: sch?.computed_next_date ?? null,
    vacation_note: sch?.vacation_note ?? null,
    stats_mode: (s.stats_mode ?? "LACZNIE") as StatsMode,
    subiekt_kh_id: s.subiekt_kh_id ?? null,
  };
}

function toStandardItem(t: TargetRow, note: string): SummaryStandardItem {
  return {
    kind: "standard",
    supplierId: t.supplier.id,
    supplierName: t.supplier.name,
    flaggedName: flagName(t.supplier.name, t.supplier.location),
    location: t.supplier.location,
    nextDate: t.nextDate,
    vacationNote: t.vacationNote,
    notes: note,
    shift: "-",
    status: "-",
    sourceSheet: t.supplier.location,
    scheduleId: t.supplier.schedule?.id ?? "",
  };
}

function buildWeekDays(
  allTarget: TargetRow[],
  weekMonday: Date,
  today: Date,
  leftSupplierIds: Set<string>
): WeekDayPlan[] {
  const days: WeekDayPlan[] = [];
  const todayStr = formatDateString(today);

  for (let i = 0; i < 5; i++) {
    const d = new Date(weekMonday);
    d.setDate(weekMonday.getDate() + i);
    const dateKey = formatDateString(d);
    const dow = d.getDay();

    const items = allTarget
      .filter((t) => {
        const itemDateStr = formatDateString(t.nextDate);
        const onDay = itemDateStr === dateKey;
        const isOverdueInTodayColumn =
          dateKey === todayStr &&
          leftSupplierIds.has(t.supplier.id) &&
          itemDateStr < todayStr;
        if (!onDay && !isOverdueInTodayColumn) return false;
        // Na liście pilnej — w kolumnie „dziś”; na innych dniach tygodnia nie duplikuj.
        if (leftSupplierIds.has(t.supplier.id) && dateKey !== todayStr && onDay) {
          return false;
        }
        return true;
      })
      .map((t) => {
        const itemDateStr = formatDateString(t.nextDate);
        const showAsOverdueToday =
          dateKey === todayStr &&
          leftSupplierIds.has(t.supplier.id) &&
          itemDateStr < todayStr;
        let note: string;
        if (showAsOverdueToday) {
          note =
            getVacationMessage(t.vacationNote as never, t.nextDate) ||
            `PO TERMINIE (${formatDateString(t.nextDate, "dd.MM")})`;
        } else {
          const dayLabel = `${DAY_NAMES[dow]} (${formatDateString(t.nextDate, "dd.MM")})`;
          note = dayLabel;
          const vacMsg = getVacationMessage(t.vacationNote as never, null).replace(
            / \(.+\)/,
            ""
          );
          if (vacMsg) {
            note = `${note} · ${vacMsg.replace(/Termin (przyspieszony|przesunięty) /g, "")}`;
          }
        }
        return toStandardItem(t, note);
      })
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName, "pl"));

    days.push({
      dateKey,
      weekdayLabel: DAY_NAMES[dow],
      dateLabel: formatDateString(d, "dd.MM"),
      isToday: dateKey === todayStr,
      isPast: d < today && dateKey !== todayStr,
      items,
    });
  }
  return days;
}

export function buildSummaryWorkspace(
  schedules: SupplierWithSchedule[],
  newOrders: IndividualOrder[],
  today: Date = todayInWarsaw(),
  salesPeople: { id: string; name: string }[] = [],
  salesCancelledOrders: IndividualOrder[] = []
): SummaryWorkspaceData {
  const salesById = new Map(salesPeople.map((p) => [p.id, p.name]));
  const supplierById = new Map(schedules.map((s) => [s.id, s.name]));
  const todayStr = formatDateString(today);
  const monday = getMondayOfWeek(today);
  const friday = getFridayOfWeek(monday);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const supplierMeta: Record<string, SupplierSummaryMeta> = {};
  for (const s of schedules) {
    supplierMeta[s.id] = toMeta(s);
  }

  const onDemandSuppliers: OnDemandSupplierRow[] = schedules
    .filter((s) => isSupplierOrderOnDemand(s))
    .map((s) => ({
      supplierId: s.id,
      supplierName: s.name,
      location: s.location,
      locationLabel: locationLabel(s.location),
      stockLabel: formatStockPeriod(s.stock_raw, s.stock != null ? Number(s.stock) : null),
      intervalLabel: formatSupplierInterval(s.interval_raw, s.interval_weeks),
      mails: s.mails ?? "",
      notes: s.notes ?? "",
    }))
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName, "pl"));

  const allTarget: TargetRow[] = [];
  for (const s of schedules) {
    if (isSupplierOrderOnDemand(s)) continue;
    const next = parseDateOnly(s.schedule?.computed_next_date ?? null);
    if (!next) continue;
    allTarget.push({
      supplier: s,
      nextDate: next,
      vacationNote: s.schedule?.vacation_note ?? null,
    });
  }

  function buildRequestGroups<K extends "forSomeone" | "informacja">(
    orders: IndividualOrder[],
    shiftLabel: string,
    kind: K
  ) {
    const grouped: Record<
      string,
      { supplier: string; person: string; salesPersonId: string; items: IndividualOrder[] }
    > = {};
    for (const o of orders) {
      if (o.status !== "Nowe") continue;
      if (kind === "forSomeone" && !canShowInForSomeoneLeft(o)) continue;
      if (kind === "informacja" && isInformacjaQueueViaDailyPanel(o)) continue;
      const key = `${o.supplier_id}|${o.sales_person_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          supplier:
            o.supplier?.name ??
            (o.supplier_id ? supplierById.get(o.supplier_id) : undefined) ??
            "",
          person:
            o.sales_person?.name ?? salesById.get(o.sales_person_id) ?? "",
          salesPersonId: o.sales_person_id,
          items: [],
        };
      }
      grouped[key].items.push(o);
    }

    return Object.values(grouped).map((g) => {
    const supplierId = g.items[0]?.supplier_id ?? "";
    const supplierRow = schedules.find(
      (s) => s.id === supplierId || s.name === g.supplier
    );
    const supplierName =
      g.supplier?.trim() ||
      supplierRow?.name ||
      "Nieznany dostawca";
    const loc = supplierRow?.location ?? "POLSKA";
    const personName = g.person?.trim() || "Handlowiec nieprzypisany";
    const count = g.items.length;
    const countLabel =
      count === 1 ? "produkt" : count > 1 && count < 5 ? "produkty" : "produktów";
    const lines = g.items.map((item) => mapOrderToForSomeoneLine(item));
    const hoverNote = lines
      .map((l) => `${l.symbol}: ${l.products} (${l.quantity})`)
      .join("\n");
    return {
      kind,
      supplierId,
      salesPersonId: g.salesPersonId,
      supplierName,
      flaggedName: flagName(supplierName, loc),
      location: loc,
      person: personName,
      displayText: `${personName} · ${count} ${countLabel}`,
      hoverNote,
      lines,
      orderIds: g.items.map((i) => i.id),
      shift: shiftLabel,
      status: "-",
      nextDate: new Date(8640000000000000),
    };
    });
  }

  const zamowienieNew = newOrders.filter(
    (o) => (o.request_kind ?? "zamowienie") === "zamowienie"
  );
  const informacjaNew = newOrders.filter((o) => o.request_kind === "informacja");
  const informacjaViaPanel = informacjaNew.filter((o) =>
    isInformacjaQueueViaDailyPanel(o)
  );
  const informacjaDirect = informacjaNew.filter(
    (o) => !isInformacjaQueueViaDailyPanel(o)
  );

  const forSomeoneLeft = [
    ...buildRequestGroups(zamowienieNew, "[DLA KOGOŚ]", "forSomeone"),
    ...buildRequestGroups(informacjaViaPanel, "[INFO→ZD]", "forSomeone"),
  ] as SummaryForSomeoneEnriched[];

  const informacjaLeft = buildRequestGroups(
    informacjaDirect,
    "[INFO]",
    "informacja"
  ) as SummaryInformacjaEnriched[];

  const standardLeft: SummaryStandardItem[] = allTarget
    .filter((t) => formatDateString(t.nextDate) <= todayStr)
    .map((t) => {
      let note =
        getVacationMessage(t.vacationNote as never, t.nextDate) ||
        (formatDateString(t.nextDate) < todayStr
          ? `PO TERMINIE (${formatDateString(t.nextDate, "dd.MM")})`
          : "DO ZAMÓWIENIA DZIŚ");
      return toStandardItem(t, note);
    });

  const leftSupplierIds = new Set(standardLeft.map((o) => o.supplierId));

  const left: SummaryItem[] = [
    ...standardLeft,
    ...forSomeoneLeft,
  ].sort((a, b) => {
    if (a.kind === "forSomeone" && b.kind !== "forSomeone") return 1;
    if (b.kind === "forSomeone" && a.kind !== "forSomeone") return -1;
    const da = "nextDate" in a ? a.nextDate.getTime() : 0;
    const db = "nextDate" in b ? b.nextDate.getTime() : 0;
    return da - db;
  });

  let rightHeader: SummaryView["rightHeader"] = "ZAMÓWIENIA (TEN TYDZIEŃ)";
  let right: SummaryStandardItem[] = allTarget
    .filter((t) => {
      if (leftSupplierIds.has(t.supplier.id)) return false;
      const d = toDateOnly(t.nextDate);
      return d > today && d >= monday && d <= friday;
    })
    .map((t) => {
      const dayNames = DAY_NAMES;
      let note = `${dayNames[t.nextDate.getDay()]} (${formatDateString(t.nextDate, "dd.MM")})`;
      const vacMsg = getVacationMessage(t.vacationNote as never, null).replace(
        / \(.+\)/,
        ""
      );
      if (vacMsg) {
        note = `${note} (${vacMsg.replace(/Termin (przyspieszony|przesunięty) /g, "")})`;
      }
      return toStandardItem(t, note);
    })
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  const dayOfWeek = ((today.getDay() + 6) % 7) + 1;
  if (dayOfWeek === 5 && right.length === 0) {
    rightHeader = "ZAMÓWIENIA (NASTĘPNY TYDZIEŃ)";
  }

  const thisWeekDays = buildWeekDays(allTarget, monday, today, leftSupplierIds);
  const nextWeekDays = buildWeekDays(allTarget, nextMonday, today, leftSupplierIds);

  const salesCancelledNotices = buildSalesCancelledNotices(
    salesCancelledOrders,
    salesById
  );

  const panelHidden = buildDailyPanelHiddenReport(schedules, { informacjaLeft });

  return {
    left,
    right,
    rightHeader,
    supplierMeta,
    onDemandSuppliers,
    thisWeekDays,
    nextWeekDays,
    forSomeoneLeft,
    informacjaLeft,
    salesCancelledNotices,
    panelHidden,
  };
}
