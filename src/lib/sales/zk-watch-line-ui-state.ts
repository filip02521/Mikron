import type { ZkWatchLineCoverage } from "@/lib/sales/zk-watch-order-link";

export type ZkWatchLineUiState =
  | "new"
  | "uncovered"
  | "in_request"
  | "partial"
  | "delivered"
  | "arrived"
  | "in_stock";

export type ZkWatchLineUiStateMeta = {
  label: string;
  shortLabel: string;
  badgeClass: string;
  rowTintClass: string | null;
  icon: "new" | "alert" | "clock" | "truck" | "package" | "check" | "warehouse" | null;
};

export function resolveZkWatchLineUiState(input: {
  coverage?: ZkWatchLineCoverage;
  isNewLine: boolean;
  arrived: boolean;
  inStock?: boolean;
}): ZkWatchLineUiState {
  if (input.inStock) return "in_stock";
  if (input.isNewLine) return "new";
  if (input.arrived) return "arrived";
  switch (input.coverage) {
    case "delivered":
      return "delivered";
    case "partial":
      return "partial";
    case "open":
      return "in_request";
    default:
      return "uncovered";
  }
}

export function zkWatchLineUiStateMeta(state: ZkWatchLineUiState): ZkWatchLineUiStateMeta {
  switch (state) {
    case "new":
      return {
        label: "Nowa pozycja w ZK — jeszcze nie ma prośby",
        shortLabel: "Nowa",
        badgeClass: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80",
        rowTintClass: "bg-amber-50/60",
        icon: "new",
      };
    case "in_request":
      return {
        label: "Pozycja jest już w aktywnej prośbie",
        shortLabel: "W prośbie",
        badgeClass: "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/70",
        rowTintClass: "bg-indigo-50/35",
        icon: "clock",
      };
    case "partial":
      return {
        label: "Część ilości została już dostarczona",
        shortLabel: "Częściowo",
        badgeClass: "bg-sky-100 text-sky-900 ring-1 ring-sky-200/70",
        rowTintClass: "bg-sky-50/40",
        icon: "truck",
      };
    case "delivered":
      return {
        label: "Prośba zrealizowana — towar dostarczony",
        shortLabel: "Dostarczona",
        badgeClass: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/70",
        rowTintClass: "bg-emerald-50/35",
        icon: "package",
      };
    case "arrived":
      return {
        label: "Oznaczono jako dotarło do klienta",
        shortLabel: "Na miejscu",
        badgeClass: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/60",
        rowTintClass: null,
        icon: "check",
      };
    case "in_stock":
      return {
        label: "Mamy na stanie — nie wymaga prośby",
        shortLabel: "Na stanie",
        badgeClass: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80",
        rowTintClass: "bg-slate-50/70",
        icon: "warehouse",
      };
    case "uncovered":
    default:
      return {
        label: "Brak prośby — możesz dodać do nowej lub uzupełniającej",
        shortLabel: "Do prośby",
        badgeClass: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
        rowTintClass: null,
        icon: "alert",
      };
  }
}

export type ZkWatchProsbaCardAction =
  | { kind: "none" }
  | { kind: "setup_required"; label: string }
  | { kind: "view_open"; label: string }
  | { kind: "covered"; label: string }
  | { kind: "new_prosba"; label: string; lineKeys?: string[] }
  | { kind: "supplement"; label: string; lineKeys: string[] };

/** Etykieta i tryb przycisku prośby na karcie ZK. */
export function deriveZkWatchProsbaCardAction(input: {
  lineCount: number;
  uncoveredLineKeys: string[];
  openProsbaLineKeys: string[];
  newLineKeys: string[];
  hasOpenMatchingProsba: boolean;
  prosbaScopeConfigured: boolean;
  /** Tylko dla świeżo dodanego ZK — wymusza modal wyboru pozycji. */
  forceProsbaScopeSetup?: boolean;
}): ZkWatchProsbaCardAction {
  const {
    lineCount,
    uncoveredLineKeys,
    openProsbaLineKeys,
    newLineKeys,
    hasOpenMatchingProsba,
    prosbaScopeConfigured,
    forceProsbaScopeSetup = false,
  } = input;

  if (lineCount > 0 && forceProsbaScopeSetup && !prosbaScopeConfigured) {
    return { kind: "setup_required", label: "Wybierz pozycje" };
  }

  if (lineCount <= 0) {
    return { kind: "new_prosba", label: "Utwórz prośbę" };
  }

  if (uncoveredLineKeys.length === 0) {
    if (hasOpenMatchingProsba || openProsbaLineKeys.length > 0) {
      return { kind: "view_open", label: "Otwórz prośbę" };
    }
    return { kind: "covered", label: "Komplet" };
  }

  const newSet = new Set(newLineKeys);
  const newUncovered = uncoveredLineKeys.filter((key) => newSet.has(key));
  const count = uncoveredLineKeys.length;

  if (newUncovered.length === count) {
    return {
      kind: "supplement",
      label: count === 1 ? "Uzupełnij (1)" : `Uzupełnij (${count})`,
      lineKeys: uncoveredLineKeys,
    };
  }

  if (openProsbaLineKeys.length > 0 || hasOpenMatchingProsba) {
    return {
      kind: "supplement",
      label: count === 1 ? "Uzupełnij (1)" : `Uzupełnij (${count})`,
      lineKeys: uncoveredLineKeys,
    };
  }

  return {
    kind: "new_prosba",
    label: count === lineCount ? "Utwórz prośbę" : `Utwórz prośbę (${count})`,
    lineKeys: count === lineCount ? undefined : uncoveredLineKeys,
  };
}

export function formatZkWatchLineStatusSummary(input: {
  uncoveredLineKeys: string[];
  openProsbaLineKeys: string[];
  newLineKeys: string[];
  deliveredCount: number;
  inStockCount?: number;
  prosbaScopeConfigured?: boolean;
  forceProsbaScopeSetup?: boolean;
}): string | null {
  if (input.forceProsbaScopeSetup && input.prosbaScopeConfigured === false) {
    return "Wybierz pozycje do zamówienia";
  }

  const parts: string[] = [];
  if (input.openProsbaLineKeys.length > 0) {
    const n = input.openProsbaLineKeys.length;
    parts.push(n === 1 ? "1 w prośbie" : `${n} w prośbie`);
  }
  if (input.newLineKeys.length > 0) {
    const n = input.newLineKeys.length;
    parts.push(n === 1 ? "1 nowa" : `${n} nowe`);
  }
  if (input.uncoveredLineKeys.length > 0) {
    const n = input.uncoveredLineKeys.length;
    parts.push(n === 1 ? "1 do zamówienia" : `${n} do zamówienia`);
  }
  if (input.deliveredCount > 0) {
    const n = input.deliveredCount;
    parts.push(n === 1 ? "1 dostarczona" : `${n} dostarczone`);
  }
  if ((input.inStockCount ?? 0) > 0) {
    const n = input.inStockCount!;
    parts.push(n === 1 ? "1 na stanie" : `${n} na stanie`);
  }
  return parts.length ? parts.join(" · ") : null;
}
