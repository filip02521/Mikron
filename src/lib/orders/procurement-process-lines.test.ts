import { describe, expect, it } from "vitest";
import {
  filterProcessLineIds,
  processLinesButtonTitle,
  processLinesConfirmLabel,
  processLinesModalTitle,
  processLinesScheduleAlert,
  processLinesSubtitle,
  processLinesSuccessToast,
  shouldPickLinesBeforeProcess,
} from "./procurement-process-lines";
import { PROCUREMENT_PROCESS_LINES_COPY } from "./procurement-process-lines-copy";

describe("shouldPickLinesBeforeProcess", () => {
  it("false dla 0 i 1", () => {
    expect(shouldPickLinesBeforeProcess(0)).toBe(false);
    expect(shouldPickLinesBeforeProcess(1)).toBe(false);
  });
  it("true dla ≥2", () => {
    expect(shouldPickLinesBeforeProcess(2)).toBe(true);
    expect(shouldPickLinesBeforeProcess(5)).toBe(true);
  });
});

describe("filterProcessLineIds", () => {
  it("zachowuje kolejność listy i odrzuca obce / puste / duplikaty", () => {
    expect(
      filterProcessLineIds(["c", "a", "x", "a", "", "b"], ["a", "b", "c"])
    ).toEqual(["a", "b", "c"]);
  });
  it("pusta selekcja / brak overlap", () => {
    expect(filterProcessLineIds([], ["a", "b"])).toEqual([]);
    expect(filterProcessLineIds(["x"], ["a"])).toEqual([]);
  });
});

describe("processLinesConfirmLabel", () => {
  it("wszystkie", () => {
    expect(processLinesConfirmLabel(3, 3)).toBe("Oznacz wszystkie (3)");
  });
  it("część", () => {
    expect(processLinesConfirmLabel(2, 5)).toBe("Oznacz 2 z 5");
  });
});

describe("processLinesModalTitle", () => {
  it("Główne / Uzupełniające", () => {
    expect(processLinesModalTitle("GLOWNE")).toBe(
      PROCUREMENT_PROCESS_LINES_COPY.titleGlowne
    );
    expect(processLinesModalTitle("POBOCZNE")).toBe(
      PROCUREMENT_PROCESS_LINES_COPY.titlePoboczne
    );
  });
});

describe("processLinesScheduleAlert", () => {
  it("null dla Uzupełniające", () => {
    expect(
      processLinesScheduleAlert({
        action: "POBOCZNE",
        supplierOrderOnDemand: false,
        selectedCount: 1,
        totalCount: 2,
      })
    ).toBeNull();
  });
  it("on-demand", () => {
    expect(
      processLinesScheduleAlert({
        action: "GLOWNE",
        supplierOrderOnDemand: true,
        selectedCount: 2,
        totalCount: 2,
      })
    ).toBe(PROCUREMENT_PROCESS_LINES_COPY.scheduleAlertOnDemand);
  });
  it("cykl pełne", () => {
    expect(
      processLinesScheduleAlert({
        action: "GLOWNE",
        supplierOrderOnDemand: false,
        selectedCount: 2,
        totalCount: 2,
      })
    ).toBe(PROCUREMENT_PROCESS_LINES_COPY.scheduleAlert);
  });
  it("cykl częściowe — mocniejsze ostrzeżenie", () => {
    const text = processLinesScheduleAlert({
      action: "GLOWNE",
      supplierOrderOnDemand: false,
      selectedCount: 1,
      totalCount: 3,
    });
    expect(text).toContain(PROCUREMENT_PROCESS_LINES_COPY.scheduleAlert);
    expect(text).toContain(PROCUREMENT_PROCESS_LINES_COPY.scheduleAlertPartial);
  });
});

describe("processLinesSuccessToast", () => {
  it("pełne Główne", () => {
    expect(
      processLinesSuccessToast({
        action: "GLOWNE",
        selectedCount: 2,
        totalCount: 2,
      })
    ).toBe("Oznaczono jako zamówienie główne");
  });
  it("częściowe Uzupełniające", () => {
    expect(
      processLinesSuccessToast({
        action: "POBOCZNE",
        selectedCount: 1,
        totalCount: 3,
      })
    ).toBe("Oznaczono 1 z 3 pozycji jako uzupełniające");
  });
});

describe("processLinesSubtitle / buttonTitle", () => {
  it("subtitle", () => {
    expect(processLinesSubtitle("Acme", "Jan")).toBe("Acme · Jan");
  });
  it("button title z hintem", () => {
    expect(
      processLinesButtonTitle({ canPickLines: true, baseTitle: null })
    ).toBe(PROCUREMENT_PROCESS_LINES_COPY.pickLinesHint);
    expect(
      processLinesButtonTitle({
        canPickLines: true,
        baseTitle: "Bez terminu",
      })
    ).toContain(PROCUREMENT_PROCESS_LINES_COPY.pickLinesHint);
  });
});
