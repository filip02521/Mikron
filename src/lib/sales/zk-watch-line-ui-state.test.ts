import { describe, expect, it } from "vitest";
import {
  deriveZkWatchProsbaCardAction,
  formatZkProsbaCardActionLabelAfterStockFilter,
  resolveZkWatchLineUiState,
  zkWatchLineUiStateMeta,
} from "./zk-watch-line-ui-state";

describe("resolveZkWatchLineUiState", () => {
  it("priorytet: in_stock > new > arrived > coverage", () => {
    expect(
      resolveZkWatchLineUiState({
        isNewLine: true,
        arrived: false,
        coverage: "open",
        inStock: true,
      })
    ).toBe("in_stock");
    expect(
      resolveZkWatchLineUiState({ isNewLine: true, arrived: false, coverage: "open" })
    ).toBe("new");
    expect(
      resolveZkWatchLineUiState({ isNewLine: false, arrived: true, coverage: "open" })
    ).toBe("arrived");
    expect(
      resolveZkWatchLineUiState({ isNewLine: false, arrived: false, coverage: "open" })
    ).toBe("in_request");
  });
});

describe("deriveZkWatchProsbaCardAction", () => {
  it("wymusza setup tylko gdy forceProsbaScopeSetup", () => {
    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 3,
        uncoveredLineKeys: ["a"],
        openProsbaLineKeys: [],
        newLineKeys: [],
        hasOpenMatchingProsba: false,
        prosbaScopeConfigured: false,
        forceProsbaScopeSetup: true,
      })
    ).toEqual({ kind: "setup_required", label: "Wybierz pozycje" });

    expect(
      deriveZkWatchProsbaCardAction({
        lineCount: 3,
        uncoveredLineKeys: ["a"],
        openProsbaLineKeys: [],
        newLineKeys: [],
        hasOpenMatchingProsba: false,
        prosbaScopeConfigured: false,
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
        prosbaScopeConfigured: true,
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
        prosbaScopeConfigured: true,
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
        prosbaScopeConfigured: true,
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
        prosbaScopeConfigured: true,
      })
    ).toMatchObject({ kind: "supplement", label: "Uzupełnij (1)" });
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
      "in_request",
      "partial",
      "delivered",
      "arrived",
      "in_stock",
    ] as const) {
      expect(zkWatchLineUiStateMeta(state).shortLabel.length).toBeGreaterThan(0);
    }
  });
});
