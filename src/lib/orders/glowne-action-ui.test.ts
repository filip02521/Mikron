import { describe, expect, it } from "vitest";
import {
  procurementGlowneButtonLabel,
  procurementGlowneButtonTitle,
} from "./glowne-action-ui";

describe("glowne-action-ui", () => {
  it("domyślna etykieta Główne", () => {
    expect(procurementGlowneButtonLabel({})).toBe("Główne");
    expect(procurementGlowneButtonTitle({})).toBeUndefined();
  });

  it("dostawca na żądanie — dopisek bez terminu", () => {
    expect(
      procurementGlowneButtonLabel({ supplierOrderOnDemand: true })
    ).toBe("Główne (bez terminu)");
    expect(
      procurementGlowneButtonLabel({ supplierOrderOnDemand: true, compact: true })
    ).toBe("Gł. (bez term.)");
    expect(
      procurementGlowneButtonTitle({ supplierOrderOnDemand: true })
    ).toContain("bez przesunięcia terminu");
  });

  it("info via panel i na żądanie — oba dopiski", () => {
    expect(
      procurementGlowneButtonLabel({
        hasInfoViaPanel: true,
        supplierOrderOnDemand: true,
      })
    ).toBe("Główne (info · bez terminu)");
  });
});
