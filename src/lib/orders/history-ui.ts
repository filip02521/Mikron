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

/** Delikatny akcent wiersza — bez pełnego tła w starym stylu arkusza. */
export function individualHistoryRowClass(status: string): string {
  switch (status) {
    case "Zamowione":
      return "border-l-2 border-l-indigo-200/90";
    case "Czesciowo_zrealizowane":
      return "border-l-2 border-l-amber-300/90";
    case "Zrealizowane":
      return "border-l-2 border-l-emerald-200/80";
    case "Anulowane":
      return "opacity-70";
    default:
      return "border-l-2 border-l-slate-200/80";
  }
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
