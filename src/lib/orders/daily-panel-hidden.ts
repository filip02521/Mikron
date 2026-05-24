import { locationLabel } from "@/lib/display-labels";
import { parseDateOnly, resolveSupplierInterval } from "@/lib/orders/dates";
import { isSupplierOrderOnDemand } from "@/lib/orders/supplier-on-demand";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type { SupplierLocation, SupplierWithSchedule } from "@/types/database";

export type DailyPanelHiddenReason =
  | "on_demand"
  | "missing_last_order"
  | "missing_interval"
  | "no_computed_date";

export type DailyPanelHiddenSupplier = {
  supplierId: string;
  supplierName: string;
  location: SupplierLocation;
  locationLabel: string;
  reason: DailyPanelHiddenReason;
  title: string;
  detail: string;
  nextDateLabel: string | null;
};

export type DailyPanelHiddenReport = {
  suppliers: DailyPanelHiddenSupplier[];
  informacjaGroupCount: number;
  informacjaLineCount: number;
};

const REASON_ORDER: DailyPanelHiddenReason[] = [
  "missing_last_order",
  "missing_interval",
  "no_computed_date",
  "on_demand",
];

export const DAILY_PANEL_HIDDEN_REASON_META: Record<
  DailyPanelHiddenReason,
  { sectionTitle: string; sectionHint: string }
> = {
  missing_last_order: {
    sectionTitle: "Brak daty ostatniego zamówienia",
    sectionHint:
      "Bez daty ostatniego zamówienia (lub przesunięcia) system nie wyliczy kolejnego terminu.",
  },
  missing_interval: {
    sectionTitle: "Brak interwału zamówień",
    sectionHint: "Uzupełnij częstotliwość w karcie dostawcy lub w Terminach zamówień.",
  },
  no_computed_date: {
    sectionTitle: "Brak wyliczonego terminu",
    sectionHint:
      "Dane są częściowo uzupełnione, ale termin się nie liczy — sprawdź kartę lub użyj „Przelicz terminy”.",
  },
  on_demand: {
    sectionTitle: "W razie potrzeby",
    sectionHint:
      "Celowo poza harmonogramem — zamawiasz ręcznie, gdy towar jest potrzebny (lista w sekcji planu).",
  },
};

function classifyNoComputedDate(s: SupplierWithSchedule): Omit<
  DailyPanelHiddenSupplier,
  "supplierId" | "supplierName" | "location" | "locationLabel" | "nextDateLabel"
> {
  const sch = s.schedule;
  const hasOrder = Boolean(sch?.order_date?.trim());
  const hasShift = Boolean(sch?.shift_date?.trim());
  const interval = resolveSupplierInterval(s.interval_raw, s.interval_weeks);

  if (!hasOrder && !hasShift) {
    return {
      reason: "missing_last_order",
      title: "Brak daty ostatniego zamówienia",
      detail: "Uzupełnij datę ostatniego zamówienia w Terminach zamówień lub w karcie dostawcy.",
    };
  }
  if (!interval) {
    return {
      reason: "missing_interval",
      title: "Brak interwału",
      detail: "Ustaw częstotliwość zamówień (np. co 2 tygodnie) w karcie dostawcy.",
    };
  }
  return {
    reason: "no_computed_date",
    title: "Nie wyliczono terminu",
    detail:
      "Sprawdź urlopy i daty w harmonogramie, potem użyj „Przelicz terminy” na górze panelu.",
  };
}

export function buildDailyPanelHiddenReport(
  schedules: SupplierWithSchedule[],
  workspace: Pick<SummaryWorkspaceData, "informacjaLeft">
): DailyPanelHiddenReport {
  const suppliers: DailyPanelHiddenSupplier[] = [];

  for (const s of schedules) {
    const locLabel = locationLabel(s.location);
    const base = {
      supplierId: s.id,
      supplierName: s.name,
      location: s.location,
      locationLabel: locLabel,
      nextDateLabel: null as string | null,
    };

    if (isSupplierOrderOnDemand(s)) {
      suppliers.push({
        ...base,
        reason: "on_demand",
        title: "Zamówienie na żądanie",
        detail: "Nie ma stałego terminu w harmonogramie — tylko lista „W razie potrzeby”.",
      });
      continue;
    }

    const next = parseDateOnly(s.schedule?.computed_next_date ?? null);
    if (!next) {
      const classified = classifyNoComputedDate(s);
      suppliers.push({ ...base, ...classified });
    }
  }

  suppliers.sort((a, b) => {
    const ra = REASON_ORDER.indexOf(a.reason);
    const rb = REASON_ORDER.indexOf(b.reason);
    if (ra !== rb) return ra - rb;
    return a.supplierName.localeCompare(b.supplierName, "pl");
  });

  const informacjaLineCount = workspace.informacjaLeft.reduce(
    (n, g) => n + g.lines.length,
    0
  );

  return {
    suppliers,
    informacjaGroupCount: workspace.informacjaLeft.length,
    informacjaLineCount,
  };
}

export function groupHiddenSuppliersByReason(
  suppliers: DailyPanelHiddenSupplier[]
): { reason: DailyPanelHiddenReason; items: DailyPanelHiddenSupplier[] }[] {
  const groups: { reason: DailyPanelHiddenReason; items: DailyPanelHiddenSupplier[] }[] = [];
  for (const reason of REASON_ORDER) {
    const items = suppliers.filter((s) => s.reason === reason);
    if (items.length) groups.push({ reason, items });
  }
  return groups;
}
