import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { isInformacjaAvailabilityPendingStatusTitle } from "@/lib/orders/informacja-flow-copy";

export type InformacjaProgressPhase =
  | "awaiting_procurement"
  | "ordered_awaiting_warehouse"
  | "direct_monitoring"
  | "other";

export type InformacjaPhaseSection = {
  phase: InformacjaProgressPhase;
  title: string;
  hint: string;
  rows: MyOrderRow[];
};

const PHASE_META: Record<
  InformacjaProgressPhase,
  { title: string; hint: string }
> = {
  awaiting_procurement: {
    title: "Czekamy na zamówienie u dostawcy",
    hint: "Dział zakupów złoży zamówienie u dostawcy. Gdy towar dotrze na magazyn, dostaniesz e-mail.",
  },
  ordered_awaiting_warehouse: {
    title: "Zamówione u dostawcy — czekamy na magazyn",
    hint: "Zamówienie u dostawcy jest złożone. Powiadomimy e-mailem, gdy towar pojawi się na magazynie.",
  },
  direct_monitoring: {
    title: "Informacja o dostępności",
    hint: "Magazyn obserwuje dostępność — powiadomimy e-mailem po dotarciu towaru na magazyn.",
  },
  other: {
    title: "Informacje — inne statusy",
    hint: "Np. weryfikacja danych lub status poza standardową ścieżką.",
  },
};

const PHASE_ORDER: InformacjaProgressPhase[] = [
  "awaiting_procurement",
  "ordered_awaiting_warehouse",
  "direct_monitoring",
  "other",
];

export function informacjaProgressPhase(row: MyOrderRow): InformacjaProgressPhase {
  if (row.kind !== "informacja") return "other";
  switch (row.statusTitle) {
    case "Czekamy na zamówienie u dostawcy":
      return "awaiting_procurement";
    case "Zamówione — czekamy na magazyn":
      return "ordered_awaiting_warehouse";
    default:
      if (isInformacjaAvailabilityPendingStatusTitle(row.statusTitle)) {
        return "direct_monitoring";
      }
      return "other";
  }
}

export function partitionInformacjaProgressRows(
  rows: MyOrderRow[]
): InformacjaPhaseSection[] {
  const buckets: Record<InformacjaProgressPhase, MyOrderRow[]> = {
    awaiting_procurement: [],
    ordered_awaiting_warehouse: [],
    direct_monitoring: [],
    other: [],
  };

  for (const row of rows) {
    buckets[informacjaProgressPhase(row)].push(row);
  }

  return PHASE_ORDER.filter((phase) => buckets[phase].length > 0).map((phase) => ({
    phase,
    title: PHASE_META[phase].title,
    hint: PHASE_META[phase].hint,
    rows: buckets[phase],
  }));
}

