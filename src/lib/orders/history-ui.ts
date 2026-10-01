import { classifyHistoriaAction } from "@/lib/orders/historia-schedule-actions";
import { isHistoryTerminalStatus } from "@/lib/orders/history-retention";
import type { IndividualOrder } from "@/types/database";

export type HistoryStatusBadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "info"
  | "danger";

const INDIVIDUAL_STATUS_LABELS: Record<string, string> = {
  Nowe: "Nowe",
  Zamowione: "Zamówione",
  Czesciowo_zrealizowane: "Częściowo",
  Zrealizowane: "Zrealizowane",
  Anulowane: "Anulowane",
};

export function individualHistoryStatusLabel(status: string): string {
  return INDIVIDUAL_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function individualHistoryStatusBadgeVariant(
  status: string
): HistoryStatusBadgeVariant {
  switch (status) {
    case "Zrealizowane":
      return "success";
    case "Czesciowo_zrealizowane":
      return "warning";
    case "Zamowione":
      return "info";
    case "Anulowane":
      return "danger";
    default:
      return "default";
  }
}

/** Wiersz historii — bez kolorowych akcentów; anulowane wyszarzone. */
export function individualHistoryRowClass(status: string): string {
  return status === "Anulowane" ? "opacity-70" : "";
}

export function normalHistoryActionPresentation(action: string): {
  label: string;
  badgeVariant: HistoryStatusBadgeVariant;
  emphasize: boolean;
} {
  const kind = classifyHistoriaAction(action);
  if (kind === "ordered") {
    return { label: action, badgeVariant: "info", emphasize: true };
  }
  if (kind === "shift") {
    return { label: action, badgeVariant: "warning", emphasize: true };
  }
  return { label: action, badgeVariant: "default", emphasize: false };
}

export function historySectionSummary(individual: IndividualOrder[], normalCount: number) {
  const completed = individual.filter((o) => o.status === "Zrealizowane").length;
  const open = individual.filter((o) => !isHistoryTerminalStatus(o.status)).length;
  return {
    individualTotal: individual.length,
    individualOpen: open,
    individualCompleted: completed,
    normalTotal: normalCount,
  };
}
