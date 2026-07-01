import { describe, expect, it } from "vitest";
import {
  canSwitchProcurementWorkspace,
  defaultProcurementWorkspace,
  grantedProcurementFunctions,
  homePathForProcurementWorkspace,
  homePathForUser,
  pathAllowedForProcurementWorkspace,
  resolveProcurementWorkspace,
} from "./procurement-workspace";

describe("procurement-workspace", () => {
  it("zakupy_zeby ma obie funkcje i może przełączać obszar", () => {
    expect(grantedProcurementFunctions("zakupy_zeby")).toEqual(["dostawy", "zeby"]);
    expect(canSwitchProcurementWorkspace("zakupy_zeby")).toBe(true);
  });

  it("zakupy ma tylko dostawy", () => {
    expect(grantedProcurementFunctions("zakupy")).toEqual(["dostawy"]);
    expect(canSwitchProcurementWorkspace("zakupy")).toBe(false);
  });

  it("domyślny obszar zakupy_zeby to zęby", () => {
    expect(defaultProcurementWorkspace("zakupy_zeby")).toBe("zeby");
    expect(homePathForUser("zakupy_zeby", "zeby")).toBe("/zeby/kolejka");
    expect(homePathForProcurementWorkspace("dostawy")).toBe("/podsumowanie");
  });

  it("resolveProcurementWorkspace honoruje cookie gdy dozwolone", () => {
    expect(resolveProcurementWorkspace("zakupy_zeby", "dostawy")).toBe("dostawy");
    expect(resolveProcurementWorkspace("zakupy_zeby", "zeby")).toBe("zeby");
    expect(resolveProcurementWorkspace("zakupy_zeby", "invalid")).toBe("zeby");
    expect(resolveProcurementWorkspace("zakupy", "zeby")).toBe("dostawy");
  });

  it("pathAllowedForProcurementWorkspace rozdziela tory", () => {
    expect(pathAllowedForProcurementWorkspace("/zeby/kolejka", "zeby")).toBe(true);
    expect(pathAllowedForProcurementWorkspace("/podsumowanie", "zeby")).toBe(false);
    expect(pathAllowedForProcurementWorkspace("/podsumowanie", "dostawy")).toBe(true);
    expect(pathAllowedForProcurementWorkspace("/zeby/kolejka", "dostawy")).toBe(false);
    expect(pathAllowedForProcurementWorkspace("/notatki", "zeby")).toBe(true);
    expect(pathAllowedForProcurementWorkspace("/zakupy/dostawcy", "zeby")).toBe(true);
    expect(pathAllowedForProcurementWorkspace("/lokalizacje/POLSKA", "dostawy")).toBe(true);
    expect(pathAllowedForProcurementWorkspace("/lokalizacje/POLSKA", "zeby")).toBe(false);
  });
});
