import { describe, expect, it } from "vitest";
import {
  SUPPLIER_INTERVAL_PRESETS,
  matchSupplierCyclePreset,
  supplierCyclePresetById,
} from "./cycle-presets";

describe("cycle presets", () => {
  it("dopasowuje znane wartości do presetu", () => {
    expect(matchSupplierCyclePreset("2 MIESIĄCE", SUPPLIER_INTERVAL_PRESETS)).toBe("2m");
    expect(matchSupplierCyclePreset("6", SUPPLIER_INTERVAL_PRESETS)).toBe("6w");
    expect(matchSupplierCyclePreset("własny tekst", SUPPLIER_INTERVAL_PRESETS)).toBe("__custom__");
  });

  it("zwraca preset po id", () => {
    expect(supplierCyclePresetById("2m", SUPPLIER_INTERVAL_PRESETS)?.raw).toBe("2 MIESIĄCE");
  });
});
