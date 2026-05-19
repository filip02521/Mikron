import type { IndividualOrder, SupplierLocation, SupplierWithSchedule } from "@/types/database";
import { LOCATION_FLAGS } from "@/types/database";
import {
  formatDateString,
  getFridayOfWeek,
  getMondayOfWeek,
  parseDateOnly,
  toDateOnly,
} from "./dates";
import { getVacationMessage } from "./colors";

export interface SummaryStandardItem {
  kind: "standard";
  supplierId: string;
  supplierName: string;
  flaggedName: string;
  location: SupplierLocation;
  nextDate: Date;
  vacationNote: string | null;
  notes: string;
  shift: string;
  status: string;
  sourceSheet: SupplierLocation;
  scheduleId: string;
}

export interface SummaryForSomeoneItem {
  kind: "forSomeone";
  supplierId: string;
  supplierName: string;
  flaggedName: string;
  location: SupplierLocation;
  person: string;
  displayText: string;
  hoverNote: string;
  orderIds: string[];
  shift: "[DLA KOGOŚ]";
  status: string;
}

export type SummaryItem = SummaryStandardItem | SummaryForSomeoneItem;

export interface SummaryView {
  left: SummaryItem[];
  right: SummaryItem[];
  rightHeader: "ZAMÓWIENIA (TEN TYDZIEŃ)" | "ZAMÓWIENIA (NASTĘPNY TYDZIEŃ)";
}

function flagName(name: string, location: SupplierLocation): string {
  return `${LOCATION_FLAGS[location]}${name}`;
}

type TargetRow = {
  supplier: SupplierWithSchedule;
  nextDate: Date;
  vacationNote: string | null;
};

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

export function buildSummary(
  schedules: SupplierWithSchedule[],
  newOrders: IndividualOrder[],
  today: Date = toDateOnly(new Date())
): SummaryView {
  const todayStr = formatDateString(today);
  const monday = getMondayOfWeek(today);
  const friday = getFridayOfWeek(monday);

  const allTarget: Array<{
    supplier: SupplierWithSchedule;
    nextDate: Date;
    vacationNote: string | null;
  }> = [];

  for (const s of schedules) {
    const next = parseDateOnly(s.schedule?.computed_next_date ?? null);
    if (!next) continue;
    allTarget.push({
      supplier: s,
      nextDate: next,
      vacationNote: s.schedule?.vacation_note ?? null,
    });
  }

  const grouped: Record<string, { supplier: string; person: string; items: IndividualOrder[] }> = {};
  for (const o of newOrders) {
    if (o.status !== "Nowe") continue;
    const key = `${o.supplier_id}|${o.sales_person_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        supplier: o.supplier?.name ?? "",
        person: o.sales_person?.name ?? "",
        items: [],
      };
    }
    grouped[key].items.push(o);
  }

  const forSomeoneItems: SummaryForSomeoneItem[] = Object.values(grouped).map((g) => {
    const loc = schedules.find((s) => s.name === g.supplier)?.location ?? "POLSKA";
    const count = g.items.length;
    const countLabel =
      count === 1 ? "produkt" : count > 1 && count < 5 ? "produkty" : "produktów";
    const hoverNote = g.items
      .slice(0, 10)
      .map((item) => {
        let line = `• ${item.products}`;
        if (item.symbol && item.symbol !== "-") line += ` (Symbol: ${item.symbol})`;
        line += ` - Ilość: ${item.quantity || "b/d"}`;
        return line;
      })
      .join("\n");
    const extra =
      count > 10 ? `\n... i ${count - 10} kolejnych pozycji.` : "";
    return {
      kind: "forSomeone",
      supplierId: g.items[0]?.supplier_id ?? "",
      supplierName: g.supplier,
      flaggedName: flagName(g.supplier, loc),
      location: loc,
      person: g.person,
      displayText: `Indywidualne: ${g.person} (${count} ${countLabel})`,
      hoverNote: hoverNote + extra,
      orderIds: g.items.map((i) => i.id),
      shift: "[DLA KOGOŚ]",
      status: "-",
    };
  });

  const standardLeft: SummaryStandardItem[] = allTarget
    .filter((t) => formatDateString(t.nextDate) <= todayStr)
    .map((t) => {
      let note =
        getVacationMessage(t.vacationNote as never, t.nextDate) ||
        (formatDateString(t.nextDate) < todayStr
          ? `PO TERMINIE (${formatDateString(t.nextDate, "dd.MM")})`
          : "");
      return toStandardItem(t, note);
    });

  const left: SummaryItem[] = [
    ...standardLeft,
    ...forSomeoneItems.map((f) => ({ ...f, nextDate: new Date(8640000000000000) } as SummaryItem)),
  ].sort((a, b) => {
    const da = "nextDate" in a ? a.nextDate.getTime() : 0;
    const db = "nextDate" in b ? b.nextDate.getTime() : 0;
    return da - db;
  });

  const addedSuppliers = new Set(
    standardLeft.map((o) => o.supplierName.toUpperCase())
  );

  let rightHeader: SummaryView["rightHeader"] = "ZAMÓWIENIA (TEN TYDZIEŃ)";
  let rangeStart = monday;
  let rangeEnd = friday;

  let right: SummaryStandardItem[] = allTarget
    .filter((t) => {
      if (addedSuppliers.has(t.supplier.name.toUpperCase())) return false;
      const d = toDateOnly(t.nextDate);
      return d > today && d >= rangeStart && d <= rangeEnd;
    })
    .map((t) => {
      const dayNames = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
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
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    const nextFriday = new Date(friday);
    nextFriday.setDate(friday.getDate() + 7);
    rangeStart = nextMonday;
    rangeEnd = nextFriday;
    right = allTarget
      .filter((t) => {
        if (addedSuppliers.has(t.supplier.name.toUpperCase())) return false;
        const d = toDateOnly(t.nextDate);
        return d >= rangeStart && d <= rangeEnd;
      })
      .map((t) => {
        const dayNames = ["Niedz", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];
        const note = `${dayNames[t.nextDate.getDay()]} (${formatDateString(t.nextDate, "dd.MM")})`;
        return toStandardItem(t, note);
      })
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
  }

  return { left, right, rightHeader };
}
