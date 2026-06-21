import { describe, expect, it } from "vitest";
import {
  buildContextualZkWatchStatusLegend,
} from "./zk-watch-contextual-status-legend";
import {
  allZkWatchLinesCheckboxChecked,
  buildZkWatchLineStatusSummary,
  canMarkZkWatchLineArrived,
  isZkWatchLineCheckboxChecked,
  canToggleZkWatchLineCheckbox,
  countZkWatchLineUiStates,
  deriveZkWatchProsbaCardAction,
  formatZkProsbaCardActionLabelAfterStockFilter,
  resolveZkWatchLineUiState,
  ZK_WATCH_LINE_FLOW_ORDER,
  ZK_WATCH_STATUS_GUIDE_ITEMS,
  zkWatchLineUiStateMeta,
} from "./zk-watch-line-ui-state";

describe("resolveZkWatchLineUiState", () => {
  it("priorytet: coverage > new > arrived > in_stock", () => {
    expect(
      resolveZkWatchLineUiState({
        isNewLine: false,
        arrived: false,
        coverage: "open",
        inStock: true,
      })
    ).toBe("in_request");
    expect(
      resolveZkWatchLineUiState({ isNewLine: true, arrived: false, coverage: "open" })
    ).toBe("in_request");
    expect(
      resolveZkWatchLineUiState({ isNewLine: true, arrived: false, coverage: undefined })
    ).toBe("new");
    expect(
      resolveZkWatchLineUiState({ isNewLine: false, arrived: true, coverage: undefined })
    ).toBe("uncovered");
    expect(
      resolveZkWatchLineUiState({
        isNewLine: false,
        arrived: true,
        completedManually: true,
        coverage: undefined,
      })
    ).toBe("arrived");
    expect(
      resolveZkWatchLineUiState({
        isNewLine: false,
        arrived: true,
        completedManually: true,
        coverage: "delivered",
        inStock: true,
      })
    ).toBe("arrived");
    expect(
      resolveZkWatchLineUiState({
        isNewLine: false,
        arrived: true,
        coverage: "delivered",
        inStock: true,
      })
    ).toBe("in_stock");
    expect(
      resolveZkWatchLineUiState({
        isNewLine: false,
        arrived: false,
        coverage: "delivered",
        inStock: true,
      })
    ).toBe("in_stock");
  });

  it("wykluczenie z zakresu — osobny stan UI", () => {
    expect(
      resolveZkWatchLineUiState({
        isNewLine: false,
        arrived: false,
        scopeExcluded: true,
      })
    ).toBe("scope_excluded");
  });
});

describe("deriveZkWatchProsbaCardAction", () => {
  it("gdy brak zakresu prośby — normalny CTA prośby", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 3,
        uncoveredLineKeys: ["a"],
        openProsbaLineKeys: [],
        newLineKeys: [],
        hasOpenMatchingProsba: false,
      }).kind
    ).toBe("new_prosba");
  });

  it("gdy wszystko w prośbach — otwórz prośbę", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 3,
        uncoveredLineKeys: [],
        openProsbaLineKeys: ["a", "b"],
        newLineKeys: [],
        hasOpenMatchingProsba: true,
      })
    ).toEqual({ kind: "view_open", label: "Otwórz prośbę" });
  });

  it("tylko nowe pozycje — uzupełnij", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 3,
        uncoveredLineKeys: ["n1", "n2"],
        openProsbaLineKeys: ["a"],
        newLineKeys: ["n1", "n2"],
        hasOpenMatchingProsba: true,
      })
    ).toMatchObject({ kind: "supplement", label: "Uzupełnij (2)" });
  });

  it("brak prośby — utwórz prośbę", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 2,
        uncoveredLineKeys: ["a", "b"],
        openProsbaLineKeys: [],
        newLineKeys: [],
        hasOpenMatchingProsba: false,
      })
    ).toMatchObject({ kind: "new_prosba", label: "Utwórz prośbę" });
  });

  it("część w prośbie — uzupełnij z liczbą", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 3,
        uncoveredLineKeys: ["c"],
        openProsbaLineKeys: ["a", "b"],
        newLineKeys: [],
        hasOpenMatchingProsba: true,
      })
    ).toMatchObject({ kind: "supplement", label: "Uzupełnij (1)" });
  });

  it("częściowa dostawa — nie pokazuj Komplet", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 1,
        uncoveredLineKeys: [],
        openProsbaLineKeys: [],
        partialLineKeys: ["ob:1"],
        newLineKeys: [],
        hasOpenMatchingProsba: false,
      })
    ).toEqual({ kind: "view_open", label: "Otwórz prośbę" });
  });

  it("towar na regale bez odbioru — nie pokazuj Komplet", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 1,
        uncoveredLineKeys: [],
        openProsbaLineKeys: [],
        regalWaitingLineKeys: ["ob:1"],
        newLineKeys: [],
        hasOpenMatchingProsba: false,
      })
    ).toEqual({ kind: "view_open", label: "Otwórz prośbę" });
  });

  it("wszystkie pozycje pominięte w zakresie — chip Ze stanu", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 2,
        uncoveredLineKeys: [],
        openProsbaLineKeys: [],
        scopeExcludedLineKeys: ["a", "b"],
        newLineKeys: [],
        hasOpenMatchingProsba: false,
      })
    ).toEqual({ kind: "covered", reason: "scope_excluded" });
  });

  it("pokryte pozycje — chip Obsłużone", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 2,
        uncoveredLineKeys: [],
        openProsbaLineKeys: [],
        newLineKeys: [],
        hasOpenMatchingProsba: false,
      })
    ).toEqual({ kind: "covered", reason: "complete" });
  });
});

describe("formatZkProsbaCardActionLabelAfterStockFilter", () => {
  it("pokazuje stan ładowania i pełny stan", () => {
    expect(
      formatZkProsbaCardActionLabelAfterStockFilter({
        action: { kind: "supplement", label: "Uzupełnij (2)", lineKeys: ["a", "b"] },
        stockLoading: true,
        allOnStock: false,
        filteredCount: 2,
        sourceCount: 2,
      })
    ).toBe("Sprawdzam stan…");

    expect(
      formatZkProsbaCardActionLabelAfterStockFilter({
        action: { kind: "supplement", label: "Uzupełnij (2)", lineKeys: ["a", "b"] },
        stockLoading: false,
        allOnStock: true,
        filteredCount: 0,
        sourceCount: 2,
      })
    ).toBe("Na stanie");
  });

  it("gdy filtr stanu wyklucza wszystko, a jest prośba — otwórz prośbę", () => {
    expect(
      formatZkProsbaCardActionLabelAfterStockFilter({
        action: { kind: "supplement", label: "Uzupełnij (2)", lineKeys: ["a", "b"] },
        stockLoading: false,
        allOnStock: true,
        filteredCount: 0,
        sourceCount: 2,
        hasOpenMatchingProsba: true,
      })
    ).toBe("Otwórz prośbę");
  });

  it("aktualizuje liczbę po filtrze", () => {
    expect(
      formatZkProsbaCardActionLabelAfterStockFilter({
        action: { kind: "supplement", label: "Uzupełnij (3)", lineKeys: ["a", "b", "c"] },
        stockLoading: false,
        allOnStock: false,
        filteredCount: 1,
        sourceCount: 3,
      })
    ).toBe("Uzupełnij (1)");
  });
});

describe("zkWatchLineUiStateMeta", () => {
  it("ma etykiety dla każdego stanu", () => {
    for (const state of [
      "new",
      "uncovered",
      "scope_excluded",
      "in_request",
      "partial",
      "informacja_ready",
      "delivered",
      "arrived",
      "in_stock",
    ] as const) {
      expect(zkWatchLineUiStateMeta(state).shortLabel.length).toBeGreaterThan(0);
    }
  });
  it("informacja_ready gdy brak aktywnej dostawy fizycznej", () => {
    expect(
      resolveZkWatchLineUiState({
        coverage: "uncovered",
        isNewLine: false,
        arrived: false,
        informacjaReady: true,
      })
    ).toBe("informacja_ready");
    expect(zkWatchLineUiStateMeta("informacja_ready").shortLabel).toBe("Dostępne");
  });

  it("aktywna dostawa fizyczna ma pierwszeństwo nad informacja_ready", () => {
    expect(
      resolveZkWatchLineUiState({
        coverage: "delivered",
        isNewLine: false,
        arrived: false,
        informacjaReady: true,
      })
    ).toBe("delivered");
    expect(
      resolveZkWatchLineUiState({
        coverage: "open",
        isNewLine: false,
        arrived: false,
        informacjaReady: true,
      })
    ).toBe("in_request");
  });

  it("informacja_acknowledged gdy brak aktywnej dostawy fizycznej", () => {
    expect(
      resolveZkWatchLineUiState({
        coverage: "uncovered",
        isNewLine: false,
        arrived: false,
        informacjaAcknowledged: true,
      })
    ).toBe("arrived");
  });

  it("aktywna dostawa fizyczna ma pierwszeństwo nad informacja_acknowledged", () => {
    expect(
      resolveZkWatchLineUiState({
        coverage: "delivered",
        isNewLine: false,
        arrived: false,
        inStock: true,
        informacjaAcknowledged: true,
      })
    ).toBe("in_stock");
  });
});

describe("canToggleZkWatchLineCheckbox", () => {
  it("pozwala zaznaczyć pozycje po Na regale, blokuje auto-zaznaczone Na regale", () => {
    expect(canToggleZkWatchLineCheckbox("delivered")).toBe(false);
    expect(canToggleZkWatchLineCheckbox("informacja_ready")).toBe(false);
    expect(canToggleZkWatchLineCheckbox("partial")).toBe(true);
    expect(canToggleZkWatchLineCheckbox("in_request")).toBe(true);
    expect(canToggleZkWatchLineCheckbox("uncovered")).toBe(true);
    expect(canToggleZkWatchLineCheckbox("in_stock")).toBe(true);
    expect(canToggleZkWatchLineCheckbox("arrived")).toBe(true);
    expect(canToggleZkWatchLineCheckbox("new")).toBe(false);
    expect(canToggleZkWatchLineCheckbox("scope_excluded")).toBe(false);
  });
});

describe("isZkWatchLineCheckboxChecked", () => {
  it("auto-zaznacza od Na regale i Odebrane, reszta przez shelf_marked", () => {
    expect(
      isZkWatchLineCheckboxChecked({ uiState: "delivered" })
    ).toBe(true);
    expect(
      isZkWatchLineCheckboxChecked({ uiState: "in_stock" })
    ).toBe(true);
    expect(
      isZkWatchLineCheckboxChecked({ uiState: "in_request", shelfMarked: false })
    ).toBe(false);
    expect(
      isZkWatchLineCheckboxChecked({ uiState: "in_request", shelfMarked: true })
    ).toBe(true);
    expect(
      isZkWatchLineCheckboxChecked({ uiState: "partial", shelfMarked: true })
    ).toBe(true);
  });
});

describe("allZkWatchLinesCheckboxChecked", () => {
  it("true gdy wszystkie pozycje zaznaczone (Na regale+)", () => {
    expect(
      allZkWatchLinesCheckboxChecked({
        lineViews: [
          { key: "a", arrived: false },
          { key: "b", arrived: false },
        ],
        newLineKeys: [],
        inStockLineKeys: [],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { a: "delivered", b: "delivered" },
      })
    ).toBe(true);
  });

  it("true gdy odebrane z regału bez ręcznego zakończenia", () => {
    expect(
      allZkWatchLinesCheckboxChecked({
        lineViews: [{ key: "a", arrived: false }],
        newLineKeys: [],
        inStockLineKeys: ["a"],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { a: "delivered" },
      })
    ).toBe(true);
  });

  it("false gdy brakuje zaznaczenia częściowej dostawy", () => {
    expect(
      allZkWatchLinesCheckboxChecked({
        lineViews: [{ key: "a", arrived: false, shelf_marked: false }],
        newLineKeys: [],
        inStockLineKeys: [],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { a: "partial" },
      })
    ).toBe(false);
  });

  it("ignoruje pozycje wykluczone z prośby", () => {
    expect(
      allZkWatchLinesCheckboxChecked({
        lineViews: [
          { key: "a", arrived: false },
          { key: "x", arrived: false },
        ],
        newLineKeys: [],
        inStockLineKeys: [],
        scopeExcludedLineKeys: ["x"],
        lineCoverageByKey: { a: "delivered", x: "uncovered" },
      })
    ).toBe(true);
  });
});

describe("canMarkZkWatchLineArrived", () => {
  it("tylko in_stock i arrived", () => {
    expect(canMarkZkWatchLineArrived("in_stock")).toBe(true);
    expect(canMarkZkWatchLineArrived("arrived")).toBe(true);
    expect(canMarkZkWatchLineArrived("delivered")).toBe(false);
    expect(canMarkZkWatchLineArrived("uncovered")).toBe(false);
    expect(canMarkZkWatchLineArrived("in_request")).toBe(false);
  });
});

describe("buildZkWatchLineStatusSummary", () => {
  it("nie liczy odebranych z regału jako czekających na regale", () => {
    expect(
      buildZkWatchLineStatusSummary({
        lineViews: [
          { key: "a", arrived: false },
          { key: "b", arrived: false },
        ],
        newLineKeys: [],
        inStockLineKeys: ["b"],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { a: "uncovered", b: "delivered" },
      })
    ).toBe("1 do zamówienia · 1 odebrane z regału");
  });

  it("sumuje rozłączne stany dla dwóch pozycji", () => {
    expect(
      buildZkWatchLineStatusSummary({
        lineViews: [
          { key: "a", arrived: false },
          { key: "b", arrived: false },
        ],
        newLineKeys: [],
        inStockLineKeys: [],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { a: "uncovered", b: "delivered" },
      })
    ).toBe("1 do zamówienia · 1 na regale");
  });

  it("checkbox shelf_marked nie tworzy osobnego wiersza w summary", () => {
    expect(
      buildZkWatchLineStatusSummary({
        lineViews: [
          { key: "a", arrived: false, shelf_marked: true },
          { key: "b", arrived: false, shelf_marked: false },
        ],
        newLineKeys: [],
        inStockLineKeys: [],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { a: "delivered", b: "delivered" },
      })
    ).toBe("2 na regale");
  });
  it("spójne z chipem Zakończone gdy ręcznie zakończone", () => {
    expect(
      buildZkWatchLineStatusSummary({
        lineViews: [
          { key: "a", arrived: true, completed_manually: true },
          { key: "b", arrived: true, completed_manually: true },
        ],
        newLineKeys: [],
        inStockLineKeys: ["b"],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { a: "uncovered", b: "delivered" },
      })
    ).toBe("2 zakończone");
  });

  it("odbiór w Moje bez ręcznego zakończenia — in_stock nie zakończone", () => {
    expect(
      buildZkWatchLineStatusSummary({
        lineViews: [{ key: "b", arrived: true, completed_manually: false }],
        newLineKeys: [],
        inStockLineKeys: ["b"],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { b: "delivered" },
      })
    ).toBe("1 odebrane z regału");
  });

  it("pokazuje częściową dostawę w summary", () => {
    expect(
      buildZkWatchLineStatusSummary({
        lineViews: [{ key: "a", arrived: false }],
        newLineKeys: [],
        inStockLineKeys: [],
        scopeExcludedLineKeys: [],
        lineCoverageByKey: { a: "partial" },
      })
    ).toBe("1 częściowo");
  });
});

describe("countZkWatchLineUiStates", () => {
  it("liczy arrived tylko z completed_manually", () => {
    const counts = countZkWatchLineUiStates({
      lineViews: [
        { key: "a", arrived: true, completed_manually: true },
        { key: "b", arrived: true, completed_manually: false },
      ],
      newLineKeys: [],
      inStockLineKeys: ["b"],
      scopeExcludedLineKeys: [],
      lineCoverageByKey: { a: "uncovered", b: "delivered" },
    });
    expect(counts.arrived).toBe(1);
    expect(counts.in_stock).toBe(1);
    expect(counts.uncovered).toBe(0);
  });
});

describe("buildContextualZkWatchStatusLegend", () => {
  it("zwraca tylko statusy obecne w ZK", () => {
    const legend = buildContextualZkWatchStatusLegend({
      new: 0,
      uncovered: 1,
      scope_excluded: 0,
      in_request: 0,
      partial: 0,
      delivered: 0,
      in_stock: 1,
      arrived: 0,
    });
    expect(legend.map((item) => item.state)).toEqual(["uncovered", "in_stock"]);
    expect(legend.every((item) => item.hint.length > 5)).toBe(true);
  });
});

describe("ZK_WATCH_STATUS_GUIDE_ITEMS", () => {
  it("jest w kolejności typowego flow ZK", () => {
    expect(ZK_WATCH_STATUS_GUIDE_ITEMS.map((item) => item.state)).toEqual(
      ZK_WATCH_LINE_FLOW_ORDER
    );
  });

  it("pokrywa kluczowe etapy od prośby do klienta", () => {
    const states = new Set(ZK_WATCH_STATUS_GUIDE_ITEMS.map((item) => item.state));
    expect(states.has("delivered")).toBe(true);
    expect(states.has("in_stock")).toBe(true);
    expect(states.has("arrived")).toBe(true);
    expect(states.has("new")).toBe(true);
    expect(states.has("scope_excluded")).toBe(true);
    for (const item of ZK_WATCH_STATUS_GUIDE_ITEMS) {
      expect(item.hint.length).toBeGreaterThan(10);
    }
  });
});
