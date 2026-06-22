import type { ZkWatchLineCoverage } from "@/lib/sales/zk-watch-order-link";

function isZkWatchLineManuallyCompleted(input: {
  arrived: boolean;
  completedManually?: boolean;
}): boolean {
  return input.arrived && input.completedManually === true;
}

export type ZkWatchLineUiState =
  | "new"
  | "uncovered"
  | "scope_excluded"
  | "in_request"
  | "partial"
  | "informacja_ready"
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
  completedManually?: boolean;
  shelfMarked?: boolean;
  /** Odebrano z regału — potwierdzenie odbioru w Moje zamówienia. */
  inStock?: boolean;
  /** Pominięte przy wyborze zakresu prośby (Subiekt / wybór handlowca). */
  scopeExcluded?: boolean;
  /** Magazyn potwierdził dostępność (prośba informacyjna z ZK). */
  informacjaReady?: boolean;
  /** Handlowiec potwierdził odczyt informacji w Moje zamówienia. */
  informacjaAcknowledged?: boolean;
}): ZkWatchLineUiState {
  const physicalActive =
    input.coverage === "open" ||
    input.coverage === "partial" ||
    input.coverage === "delivered";

  if (input.informacjaReady && !physicalActive) return "informacja_ready";
  if (input.informacjaAcknowledged && !physicalActive) return "arrived";
  switch (input.coverage) {
    case "open":
      return "in_request";
    case "partial":
      if (input.inStock && isZkWatchLineManuallyCompleted(input)) return "arrived";
      if (input.inStock) return "in_stock";
      return "partial";
    case "delivered":
      if (input.inStock && isZkWatchLineManuallyCompleted(input)) return "arrived";
      if (input.inStock) return "in_stock";
      return "delivered";
  }
  if (input.isNewLine) return "new";
  if (input.inStock) return "in_stock";
  if (isZkWatchLineManuallyCompleted(input)) return "arrived";
  if (input.scopeExcluded) return "scope_excluded";
  return "uncovered";
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
    case "informacja_ready":
      return {
        label:
          "Magazyn potwierdził dostępność — pozycja jest automatycznie zaznaczona na liście",
        shortLabel: "Dostępne",
        badgeClass: "bg-sky-100 text-sky-950 ring-1 ring-sky-200/80",
        rowTintClass: "bg-sky-50/45",
        icon: "warehouse",
      };
    case "delivered":
      return {
        label:
          "Towar na regale — pozycja jest automatycznie zaznaczona na liście",
        shortLabel: "Na regale",
        badgeClass: "bg-violet-100 text-violet-900 ring-1 ring-violet-200/70",
        rowTintClass: "bg-violet-50/40",
        icon: "package",
      };
    case "arrived":
      return {
        label: "Sprawa z pozycją zamknięta — przekazano klientowi lub zakończono ręcznie",
        shortLabel: "Zakończone",
        badgeClass: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/70",
        rowTintClass: "bg-emerald-50/35",
        icon: "check",
      };
    case "in_stock":
      return {
        label: "Odebrano z regału — potwierdzone w Moje zamówienia",
        shortLabel: "Odebrane z regału",
        badgeClass: "bg-teal-100 text-teal-950 ring-1 ring-teal-200/80",
        rowTintClass: "bg-teal-50/50",
        icon: "warehouse",
      };
    case "scope_excluded":
      return {
        label: "Pominięte przy wyborze zakresu — nie wymaga zamówienia (nie mylić z „Odebrane z regału”)",
        shortLabel: "Pominięte",
        badgeClass: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
        rowTintClass: "bg-slate-50/70",
        icon: null,
      };
    case "uncovered":
    default:
      return {
        label: "Brak prośby — możesz dodać do nowej lub uzupełniającej",
        shortLabel: "Do prośby",
        badgeClass: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80",
        rowTintClass: "bg-amber-50/45",
        icon: "alert",
      };
  }
}

export type ZkWatchProsbaCoveredReason = "complete" | "scope_excluded";

export function zkWatchProsbaCoveredMeta(reason: ZkWatchProsbaCoveredReason): {
  shortLabel: string;
  detail: string;
  badgeClass: string;
  panelClass: string;
  detailClass: string;
} {
  if (reason === "scope_excluded") {
    return {
      shortLabel: "Ze stanu",
      detail:
        "Przy tworzeniu prośby oznaczono pozycje jako dostępne na stanie magazynowym. Nie ma aktywnej prośby o zamówienie u dostawcy.",
      badgeClass: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
      panelClass: "border-slate-200/90 bg-slate-50/60",
      detailClass: "text-slate-600",
    };
  }
  return {
    shortLabel: "Obsłużone",
    detail:
      "Wszystkie pozycje są pokryte stanem magazynowym lub już odebrane. Nie ma otwartej prośby o zamówienie.",
    badgeClass: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/70",
    panelClass: "border-emerald-200/80 bg-emerald-50/60",
    detailClass: "text-emerald-900/90",
  };
}

export type ZkWatchProsbaCardAction =
  | { kind: "none" }
  | { kind: "view_open"; label: string }
  | { kind: "covered"; reason: ZkWatchProsbaCoveredReason }
  | { kind: "new_prosba"; label: string; lineKeys?: string[] }
  | { kind: "supplement"; label: string; lineKeys: string[] };

/** Etykieta i tryb przycisku prośby na karcie ZK. */
export function deriveZkWatchProsbaCardAction(input: {
  lineCount: number;
  uncoveredLineKeys: string[];
  openProsbaLineKeys: string[];
  partialLineKeys?: string[];
  regalWaitingLineKeys?: string[];
  informacjaReadyLineKeys?: string[];
  scopeExcludedLineKeys?: string[];
  newLineKeys: string[];
  hasOpenMatchingProsba: boolean;
}): ZkWatchProsbaCardAction {
  const {
    lineCount,
    uncoveredLineKeys,
    openProsbaLineKeys,
    partialLineKeys = [],
    regalWaitingLineKeys = [],
    informacjaReadyLineKeys = [],
    scopeExcludedLineKeys = [],
    newLineKeys,
    hasOpenMatchingProsba,
  } = input;

  if (lineCount <= 0) {
    return { kind: "new_prosba", label: "Utwórz prośbę" };
  }

  if (uncoveredLineKeys.length === 0) {
    if (
      hasOpenMatchingProsba ||
      openProsbaLineKeys.length > 0 ||
      partialLineKeys.length > 0 ||
      regalWaitingLineKeys.length > 0 ||
      informacjaReadyLineKeys.length > 0
    ) {
      return { kind: "view_open", label: "Otwórz prośbę" };
    }
    if (scopeExcludedLineKeys.length === lineCount && lineCount > 0) {
      return { kind: "covered", reason: "scope_excluded" };
    }
    return { kind: "covered", reason: "complete" };
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

/** Etykieta przycisku prośby na karcie ZK po filtrze stanu magazynowego. */
export function formatZkProsbaCardActionLabelAfterStockFilter(input: {
  action: ZkWatchProsbaCardAction;
  stockLoading: boolean;
  allOnStock: boolean;
  filteredCount: number;
  sourceCount: number;
  hasOpenMatchingProsba?: boolean;
}): string {
  const { action, stockLoading, allOnStock, filteredCount, sourceCount, hasOpenMatchingProsba } =
    input;

  if (action.kind === "none") return "";

  if (action.kind === "covered") {
    return zkWatchProsbaCoveredMeta(action.reason).shortLabel;
  }

  if (action.kind !== "supplement" && action.kind !== "new_prosba") {
    return action.label;
  }

  if (stockLoading) return "Sprawdzam stan…";

  if (allOnStock) {
    if (hasOpenMatchingProsba) return "Otwórz prośbę";
    return action.kind === "supplement" ? "Na stanie" : "Wszystko na stanie";
  }

  if (filteredCount === sourceCount || !sourceCount) {
    return action.label;
  }

  if (action.kind === "supplement") {
    return filteredCount === 1 ? "Uzupełnij (1)" : `Uzupełnij (${filteredCount})`;
  }

  return filteredCount === 1 ? "Utwórz prośbę (1)" : `Utwórz prośbę (${filteredCount})`;
}

/** Gdy filtr stanu wyklucza wszystko, ale jest otwarta prośba — przejdź do niej zamiast blokować CTA. */
export function applyZkProsbaStockFilterToCardAction(input: {
  action: ZkWatchProsbaCardAction;
  stockLoading: boolean;
  allOnStock: boolean;
  hasOpenMatchingProsba: boolean;
}): ZkWatchProsbaCardAction {
  const { action, stockLoading, allOnStock, hasOpenMatchingProsba } = input;
  if (stockLoading || !allOnStock || !hasOpenMatchingProsba) return action;
  if (action.kind !== "supplement" && action.kind !== "new_prosba") return action;
  return { kind: "view_open", label: "Otwórz prośbę" };
}

export type ZkWatchLineUiStateCounts = Record<ZkWatchLineUiState, number>;

const EMPTY_ZK_WATCH_LINE_UI_STATE_COUNTS = (): ZkWatchLineUiStateCounts => ({
  new: 0,
  uncovered: 0,
  scope_excluded: 0,
  in_request: 0,
  partial: 0,
  informacja_ready: 0,
  delivered: 0,
  in_stock: 0,
  arrived: 0,
});

/** Liczy stany UI per pozycja — ten sam algorytm co chipy w panelu ZK. */
export function countZkWatchLineUiStates(input: {
  lineViews: Array<{
    key: string;
    arrived: boolean;
    shelf_marked?: boolean;
    completed_manually?: boolean;
  }>;
  newLineKeys: string[];
  inStockLineKeys: string[];
  scopeExcludedLineKeys: string[];
  informacjaReadyLineKeys?: string[];
  informacjaAcknowledgedLineKeys?: string[];
  lineCoverageByKey?: Record<string, ZkWatchLineCoverage>;
}): ZkWatchLineUiStateCounts {
  const newLineKeySet = new Set(input.newLineKeys);
  const inStockKeySet = new Set(input.inStockLineKeys);
  const scopeExcludedKeySet = new Set(input.scopeExcludedLineKeys);
  const informacjaReadyKeySet = new Set(input.informacjaReadyLineKeys ?? []);
  const informacjaAcknowledgedKeySet = new Set(input.informacjaAcknowledgedLineKeys ?? []);
  const counts = EMPTY_ZK_WATCH_LINE_UI_STATE_COUNTS();

  for (const line of input.lineViews) {
    if (line.key === "summary") continue;
    const state = resolveZkWatchLineUiState({
      coverage: input.lineCoverageByKey?.[line.key],
      isNewLine: newLineKeySet.has(line.key),
      arrived: line.arrived,
      completedManually: line.completed_manually === true,
      shelfMarked: line.shelf_marked === true,
      inStock: inStockKeySet.has(line.key),
      scopeExcluded: scopeExcludedKeySet.has(line.key),
      informacjaReady: informacjaReadyKeySet.has(line.key),
      informacjaAcknowledged: informacjaAcknowledgedKeySet.has(line.key),
    });
    counts[state] += 1;
  }

  return counts;
}

export function formatZkWatchLineStatusSummaryFromCounts(
  counts: ZkWatchLineUiStateCounts
): string | null {
  const parts: string[] = [];
  if (counts.in_request > 0) {
    const n = counts.in_request;
    parts.push(n === 1 ? "1 w prośbie" : `${n} w prośbie`);
  }
  if (counts.new > 0) {
    const n = counts.new;
    parts.push(n === 1 ? "1 nowa" : `${n} nowe`);
  }
  if (counts.uncovered > 0) {
    const n = counts.uncovered;
    parts.push(n === 1 ? "1 do zamówienia" : `${n} do zamówienia`);
  }
  if (counts.partial > 0) {
    const n = counts.partial;
    parts.push(n === 1 ? "1 częściowo" : `${n} częściowo`);
  }
  if (counts.informacja_ready > 0) {
    const n = counts.informacja_ready;
    parts.push(n === 1 ? "1 dostępne" : `${n} dostępne`);
  }
  if (counts.delivered > 0) {
    const n = counts.delivered;
    parts.push(n === 1 ? "1 na regale" : `${n} na regale`);
  }
  if (counts.in_stock > 0) {
    const n = counts.in_stock;
    parts.push(n === 1 ? "1 odebrane z regału" : `${n} odebrane z regału`);
  }
  if (counts.arrived > 0) {
    const n = counts.arrived;
    parts.push(n === 1 ? "1 zakończone" : `${n} zakończone`);
  }
  if (counts.scope_excluded > 0) {
    const n = counts.scope_excluded;
    parts.push(n === 1 ? "1 pominięte" : `${n} pominięte`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Podsumowanie na karcie / w modalu — spójne z chipami w liście pozycji. */
export function buildZkWatchLineStatusSummary(input: {
  lineViews: Array<{
    key: string;
    arrived: boolean;
    shelf_marked?: boolean;
    completed_manually?: boolean;
  }>;
  newLineKeys: string[];
  inStockLineKeys: string[];
  scopeExcludedLineKeys: string[];
  informacjaReadyLineKeys?: string[];
  informacjaAcknowledgedLineKeys?: string[];
  lineCoverageByKey?: Record<string, ZkWatchLineCoverage>;
  prosbaScopeConfigured?: boolean;
}): string | null {
  const counts = countZkWatchLineUiStates(input);
  return formatZkWatchLineStatusSummaryFromCounts(counts);
}

/** Kolejność etapów w typowym flow ZK (prośba → regal → Moje → zakończenie). */
export const ZK_WATCH_LINE_FLOW_ORDER: ZkWatchLineUiState[] = [
  "new",
  "uncovered",
  "scope_excluded",
  "in_request",
  "partial",
  "informacja_ready",
  "delivered",
  "in_stock",
  "arrived",
];

/** Krótka legenda stanów widoczna nad listą pozycji ZK — ta sama kolejność co flow. */
export const ZK_WATCH_LINE_STATUS_LEGEND: {
  state: ZkWatchLineUiState;
  hint: string;
}[] = [
  { state: "new", hint: "Nowa pozycja — uzupełnij prośbę" },
  { state: "uncovered", hint: "Brak prośby — zamów z karty ZK" },
  { state: "in_request", hint: "W aktywnej prośbie — czekasz na dostawę" },
  { state: "partial", hint: "Część ilości już dotarła" },
  { state: "informacja_ready", hint: "Magazyn potwierdził dostępność (informacja)" },
  { state: "delivered", hint: "Na regale — automatycznie zaznaczone na liście" },
  { state: "in_stock", hint: "Odebrane z regału — checkbox = zakończone ręcznie" },
  { state: "arrived", hint: "Zakończone ręcznie" },
];

/** Pełna lista do banera / pomocy — kolejność jak w typowym flow ZK. */
export const ZK_WATCH_STATUS_GUIDE_ITEMS: {
  state: ZkWatchLineUiState;
  hint: string;
}[] = [
  {
    state: "new",
    hint: "Nowa pozycja od ostatniego odświeżenia — wyślij uzupełniającą prośbę.",
  },
  {
    state: "uncovered",
    hint: "Brak prośby — użyj „Zgłoś prośbę” na karcie ZK, aby zamówić towar.",
  },
  {
    state: "scope_excluded",
    hint: "Pominięte przy wyborze zakresu — nie zamawiasz tej pozycji u zakupów.",
  },
  {
    state: "in_request",
    hint: "Pozycja jest w aktywnej prośbie u zakupów — czekasz na dostawę.",
  },
  {
    state: "partial",
    hint: "Część ilości z prośby już dotarła — reszta w drodze.",
  },
  {
    state: "informacja_ready",
    hint: "Prośba informacyjna — magazyn potwierdził dostępność towaru (nie mylić z „Na regale”).",
  },
  {
    state: "delivered",
    hint: "Towar na regale — pozycja jest automatycznie zaznaczona na liście.",
  },
  {
    state: "in_stock",
    hint: "Odebrano z regału (Moje). Zaznacz checkbox, aby ręcznie oznaczyć jako zakończone.",
  },
  {
    state: "arrived",
    hint: "Sprawa zamknięta — pozycja zrealizowana z Twojej strony.",
  },
];

/** Checkbox na liście — tylko po odbiorze z regału (Moje) lub już zakończone. */
export function canMarkZkWatchLineArrived(uiState: ZkWatchLineUiState): boolean {
  return uiState === "in_stock" || uiState === "arrived";
}

export function isZkWatchLineCheckboxChecked(input: {
  uiState: ZkWatchLineUiState;
  shelfMarked?: boolean;
  completedManually?: boolean;
}): boolean {
  if (input.completedManually) return true;
  if (input.uiState === "in_stock" || input.uiState === "arrived") return true;
  if (input.uiState === "delivered") return true;
  if (input.uiState === "informacja_ready") return true;
  if (input.shelfMarked) return true;
  return false;
}

/** Checkbox na liście — interaktywny poza auto-zaznaczonym „Na regale”. */
export function canToggleZkWatchLineCheckbox(uiState: ZkWatchLineUiState): boolean {
  if (uiState === "scope_excluded" || uiState === "new" || uiState === "delivered" || uiState === "informacja_ready") {
    return false;
  }
  return true;
}

export function togglesZkWatchShelfMarked(uiState: ZkWatchLineUiState): boolean {
  return canToggleZkWatchLineCheckbox(uiState) && !togglesZkWatchCompletion(uiState);
}

export function togglesZkWatchCompletion(uiState: ZkWatchLineUiState): boolean {
  return uiState === "in_stock" || uiState === "arrived";
}

export type ZkWatchLineCheckboxContext = {
  newLineKeys: string[];
  inStockLineKeys: string[];
  scopeExcludedLineKeys: string[];
  informacjaReadyLineKeys?: string[];
  informacjaAcknowledgedLineKeys?: string[];
  lineCoverageByKey?: Record<string, ZkWatchLineCoverage>;
};

function resolveZkWatchLineUiStateFromContext(
  line: {
    key: string;
    arrived: boolean;
    shelf_marked?: boolean;
    completed_manually?: boolean;
  },
  ctx: ZkWatchLineCheckboxContext
): ZkWatchLineUiState {
  return resolveZkWatchLineUiState({
    coverage: ctx.lineCoverageByKey?.[line.key],
    isNewLine: ctx.newLineKeys.includes(line.key),
    arrived: line.arrived,
    completedManually: line.completed_manually === true,
    shelfMarked: line.shelf_marked === true,
    inStock: ctx.inStockLineKeys.includes(line.key),
    scopeExcluded: ctx.scopeExcludedLineKeys.includes(line.key),
    informacjaReady: ctx.informacjaReadyLineKeys?.includes(line.key),
    informacjaAcknowledged: ctx.informacjaAcknowledgedLineKeys?.includes(line.key),
  });
}

/** Licznik zaznaczonych pozycji — ten sam algorytm co checkboxy w liście ZK. */
export function summarizeZkWatchLineCheckboxes(input: {
  lineViews: Array<{
    key: string;
    product: string;
    arrived: boolean;
    shelf_marked?: boolean;
    completed_manually?: boolean;
  }>;
} & ZkWatchLineCheckboxContext): { total: number; checked: number } {
  const scopeExcluded = new Set(input.scopeExcludedLineKeys);
  const trackable = input.lineViews.filter(
    (line) => line.key !== "summary" && !scopeExcluded.has(line.key)
  );
  let checked = 0;
  for (const line of trackable) {
    const uiState = resolveZkWatchLineUiStateFromContext(line, input);
    if (isZkWatchLineCheckboxChecked({ uiState, shelfMarked: line.shelf_marked, completedManually: line.completed_manually })) {
      checked += 1;
    }
  }
  return { total: trackable.length, checked };
}

/** Całe ZK na zielono — gdy wszystkie śledzone pozycje mają zaznaczony checkbox. */
export function allZkWatchLinesCheckboxChecked(
  input: {
    lineViews: Array<{
      key: string;
      product: string;
      arrived: boolean;
      shelf_marked?: boolean;
      completed_manually?: boolean;
    }>;
  } & ZkWatchLineCheckboxContext
): boolean {
  const { total, checked } = summarizeZkWatchLineCheckboxes(input);
  return total > 0 && checked === total;
}

/** Krótki licznik zaznaczeń — spójny z checkboxami na liście. */
export function formatZkWatchLineCheckboxShort(
  input: Parameters<typeof summarizeZkWatchLineCheckboxes>[0]
): string | null {
  const { total, checked } = summarizeZkWatchLineCheckboxes(input);
  if (!total) return null;
  return `${checked}/${total}`;
}

/** Podgląd na zwiniętej karcie ZK — pierwsza niezaznaczona pozycja + licznik. */
export function formatZkWatchLineCheckboxPreview(
  input: Parameters<typeof summarizeZkWatchLineCheckboxes>[0]
): string | null {
  const { total, checked } = summarizeZkWatchLineCheckboxes(input);
  if (!total) return null;
  const scopeExcluded = new Set(input.scopeExcludedLineKeys);
  const trackable = input.lineViews.filter(
    (line) => line.key !== "summary" && !scopeExcluded.has(line.key)
  );
  const firstUnchecked = trackable.find((line) => {
    const uiState = resolveZkWatchLineUiStateFromContext(line, input);
    return !isZkWatchLineCheckboxChecked({
      uiState,
      shelfMarked: line.shelf_marked,
      completedManually: line.completed_manually,
    });
  });
  const first = firstUnchecked ?? trackable[0];
  if (!first) return `${checked}/${total}`;
  const name =
    first.product.length > 42 ? `${first.product.slice(0, 41).trim()}…` : first.product;
  return `${name} · ${checked}/${total}`;
}

export function zkWatchLineCheckboxAriaLabel(input: {
  product: string;
  checked: boolean;
  uiState: ZkWatchLineUiState;
  completedManually?: boolean;
}): string {
  const { product, checked, uiState, completedManually } = input;
  switch (uiState) {
    case "in_stock":
      return completedManually
        ? `Zakończone — kliknij aby cofnąć: ${product}`
        : `Odebrane z regału — kliknij aby oznaczyć jako zakończone: ${product}`;
    case "delivered":
      return `Na regale — zaznaczone automatycznie: ${product}`;
    case "informacja_ready":
      return `Dostępne (informacja) — zaznaczone automatycznie: ${product}`;
    case "partial":
      return checked
        ? `Częściowo na regale — odznacz na liście: ${product}`
        : `Częściowa dostawa — zaznacz gdy odnotowujesz na liście: ${product}`;
    case "arrived":
      return checked
        ? `Zakończone — odznacz aby cofnąć: ${product}`
        : `Oznacz jako zakończone: ${product}`;
    case "uncovered":
    case "new":
      return `Brak dostawy — checkbox gdy towar będzie na regale: ${product}`;
    case "in_request":
      return `Pozycja w prośbie — checkbox gdy towar będzie na regale: ${product}`;
    case "scope_excluded":
      return `Pominięte przy wyborze zakresu — checkbox po odbiorze z regału w Moje: ${product}`;
    default:
      return `Checkbox niedostępny w tym stanie: ${product}`;
  }
}
