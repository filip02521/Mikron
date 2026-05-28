import { formatDateString, toDateOnly } from "@/lib/orders/dates";
import { vacationNoteLabel } from "@/lib/display-labels";
import { todayInWarsaw } from "@/lib/time/warsaw";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import type {
  SummaryForSomeoneEnriched,
  SummaryInformacjaEnriched,
  SummaryWorkspaceData,
} from "@/lib/orders/summary-workspace";
import type { MyOrderHeadlineTone } from "@/lib/orders/my-order-sales-ui";

export type ProcurementHeadlineTone = MyOrderHeadlineTone;

export type ProcurementRequestUi = {
  headline: string;
  subline: string | null;
  headlineTone: ProcurementHeadlineTone;
  statusTitle: string;
  statusDetail: string | null;
};

export type DailyInboxSummary = {
  overdueCount: number;
  todayCount: number;
  forSomeoneGroupCount: number;
  forSomeoneLineCount: number;
  weekPlanCount: number;
  onDemandCount: number;
  vacationSupplierCount: number;
  hiddenScheduleCount: number;
};

/** Licznik menu: tylko otwarte prośby indywidualne (zamówienie, status Nowe) — bez harmonogramu i informacji. */
export function countDailyPanelNavBadge(workspace: SummaryWorkspaceData): number {
  return summarizeDailyInbox(workspace).forSomeoneLineCount;
}

/** Liczba pozycji na zakładce Wyjątki (badge). */
export function countDailyPanelExceptions(
  workspace: Pick<
    SummaryWorkspaceData,
    "panelHidden" | "informacjaLeft" | "onDemandSuppliers" | "salesCancelledNotices"
  >
): number {
  return (
    workspace.panelHidden.suppliers.length +
    workspace.informacjaLeft.length +
    workspace.onDemandSuppliers.length +
    workspace.salesCancelledNotices.length
  );
}

export function summarizeDailyInbox(workspace: SummaryWorkspaceData): DailyInboxSummary {
  const todayStr = formatDateString(todayInWarsaw());
  let overdueCount = 0;
  let todayCount = 0;

  for (const item of workspace.left) {
    if (item.kind !== "standard") continue;
    const d = formatDateString(item.nextDate);
    if (d < todayStr) overdueCount++;
    else todayCount++;
  }

  const forSomeoneLineCount = workspace.forSomeoneLeft.reduce(
    (n, g) => n + g.lines.length,
    0
  );
  const weekPlanCount = workspace.thisWeekDays.reduce((n, d) => n + d.items.length, 0);
  const vacationSupplierCount = Object.values(workspace.supplierMeta).filter(
    (m) => m.vacation_note
  ).length;

  return {
    overdueCount,
    todayCount,
    forSomeoneGroupCount: workspace.forSomeoneLeft.length,
    forSomeoneLineCount,
    weekPlanCount,
    onDemandCount: workspace.onDemandSuppliers.length,
    vacationSupplierCount,
    hiddenScheduleCount: workspace.panelHidden.suppliers.length,
  };
}

function parseUrgentNote(item: SummaryStandardItem): string | null {
  const raw = item.notes?.trim();
  if (!raw) return null;
  if (raw.startsWith("PO TERMINIE")) return null;
  if (raw === "DO ZAMÓWIENIA DZIŚ") return null;
  if (item.vacationNote) return null;
  return raw.replace(/\s*·\s*/g, " · ");
}

/** Zrozumiały opis wpływu urlopu na pozycję harmonogramu (panel dzienny). */
export function formatUrgentVacationHint(item: SummaryStandardItem): string | null {
  if (!item.vacationNote) return null;
  const dateLabel = formatDateString(item.nextDate, "dd.MM");
  switch (item.vacationNote) {
    case "PRZESUNIETE_PO":
      return `Termin na liście (${dateLabel}) jest po urlopie dostawcy — kolejne zamówienie wypada już po przerwie.`;
    case "PRZYSPIESZONE_PRZED":
      return `Zamówienie na ${dateLabel} jest przed urlopem — wcześniejszy termin niż zwykle.`;
    case "OSTATNIE_ZAMOWIENIE":
      return `Ostatnie zamówienie przed urlopem (plan: ${dateLabel}) — potem dostawca ma przerwę w harmonogramie.`;
    default:
      return vacationNoteLabel(item.vacationNote);
  }
}

export function countUrgentItemsWithVacation(items: SummaryStandardItem[]): number {
  return items.filter((i) => i.vacationNote).length;
}

export function enrichUrgentItem(item: SummaryStandardItem): ProcurementRequestUi {
  const todayStr = formatDateString(todayInWarsaw());
  const dateStr = formatDateString(item.nextDate);
  const isOverdue = dateStr < todayStr;
  const dateLabel = formatDateString(item.nextDate, "dd.MM");
  const vacationHint = formatUrgentVacationHint(item);
  const detail =
    vacationHint ??
    parseUrgentNote(item) ??
    (isOverdue ? `Termin planowy: ${dateLabel}` : null);

  if (isOverdue) {
    return {
      headline: "Po terminie",
      subline: detail ?? `Termin planowy: ${dateLabel}`,
      headlineTone: "warning",
      statusTitle: "Zaległe",
      statusDetail: detail,
    };
  }

  return {
    headline: "Na dziś",
    subline: detail ?? null,
    headlineTone: "neutral",
    statusTitle: "Na dziś",
    statusDetail: detail,
  };
}

export function enrichForSomeoneGroup(
  group: SummaryForSomeoneEnriched
): ProcurementRequestUi {
  const count = group.lines.length;
  const countLabel =
    count === 1 ? "1 produkt" : count < 5 ? `${count} produkty` : `${count} produktów`;

  return {
    headline: group.person,
    subline: `${group.supplierName} · ${countLabel}`,
    headlineTone: "neutral",
    statusTitle: "Do zamówienia",
    statusDetail: null,
  };
}

export function enrichInformacjaGroup(
  group: SummaryInformacjaEnriched
): ProcurementRequestUi {
  const count = group.lines.length;
  const countLabel =
    count === 1 ? "1 produkt" : count < 5 ? `${count} produkty` : `${count} produktów`;

  return {
    headline: "Tylko informacja o dostępności",
    subline: `${group.person} · ${countLabel} · powiadomienie e-mail po przyjęciu na magazyn`,
    headlineTone: "info",
    statusTitle: "Bez zamówienia",
    statusDetail: null,
  };
}

export function sortForSomeoneGroups(
  groups: SummaryForSomeoneEnriched[]
): SummaryForSomeoneEnriched[] {
  return [...groups].sort(
    (a, b) =>
      a.supplierName.localeCompare(b.supplierName, "pl") ||
      a.person.localeCompare(b.person, "pl")
  );
}

export function sortInformacjaGroups(
  groups: SummaryInformacjaEnriched[]
): SummaryInformacjaEnriched[] {
  return [...groups].sort(
    (a, b) =>
      a.supplierName.localeCompare(b.supplierName, "pl") ||
      a.person.localeCompare(b.person, "pl")
  );
}

/** Skraca notatkę w kalendarzu tygodnia (bez powtórzenia dnia w nagłówku kolumny). */
export function formatPlannerNote(notes: string | null | undefined): string | null {
  const raw = notes?.trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^(Niedz|Pon|Wt|Śr|Czw|Pt|Sob)\s*\(\d{2}\.\d{2}\)\s*·?\s*/i, "")
    .replace(/\s*·\s*/g, " · ")
    .trim();
  return cleaned || null;
}

export function splitUrgentItems(items: SummaryStandardItem[]) {
  const todayStr = formatDateString(todayInWarsaw());
  const overdue: SummaryStandardItem[] = [];
  const todayList: SummaryStandardItem[] = [];

  for (const item of items) {
    const d = formatDateString(item.nextDate);
    if (d < todayStr) overdue.push(item);
    else todayList.push(item);
  }

  overdue.sort(
    (a, b) =>
      a.nextDate.getTime() - b.nextDate.getTime() ||
      a.supplierName.localeCompare(b.supplierName, "pl")
  );
  todayList.sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName, "pl")
  );

  return { overdue, todayList };
}
