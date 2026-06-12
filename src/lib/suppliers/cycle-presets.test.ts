import { describe, expect, it } from "vitest";
import {
  SUPPLIER_INTERVAL_PRESETS,
  SUPPLIER_STOCK_PRESETS,
  matchSupplierCyclePreset,
  supplierCyclePresetById,
} from "./cycle-presets";
import { parseInterval } from "@/lib/orders/dates";

describe("cycle presets", () => {
  it("dopasowuje znane wartości do presetu", () => {
    expect(matchSupplierCyclePreset("2 MIESIĄCE", SUPPLIER_INTERVAL_PRESETS)).toBe("2m");
    expect(matchSupplierCyclePreset("6", SUPPLIER_INTERVAL_PRESETS)).toBe("6w");
    expect(matchSupplierCyclePreset("własny tekst", SUPPLIER_INTERVAL_PRESETS)).toBe("__custom__");
  });

  it("dopasowuje zapas 4 miesiące do presetu, nie do 4 tygodni", () => {
    expect(matchSupplierCyclePreset("4 MIESIĄCE", SUPPLIER_STOCK_PRESETS)).toBe("4m");
    expect(matchSupplierCyclePreset("4", SUPPLIER_STOCK_PRESETS)).toBe("4w");
  });

  it("parseInterval rozróżnia tygodnie od miesięcy", () => {
    expect(parseInterval("4")).toEqual({ unit: "weeks", value: 4 });
    expect(parseInterval("4 miesiące")).toEqual({ unit: "months", value: 4 });
    expect(parseInterval("4 MIESIĄCE")).toEqual({ unit: "months", value: 4 });
  });

  it("zwraca preset po id", () => {
    expect(supplierCyclePresetById("2m", SUPPLIER_INTERVAL_PRESETS)?.raw).toBe("2 MIESIĄCE");
  });
});
