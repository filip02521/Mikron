import { describe, expect, it } from "vitest";
import {
  WAREHOUSE_CARRIERS,
  defaultWarehouseCarrierSlug,
  formatShipmentQuantitySuffix,
  isWarehouseCarrier,
  normalizeShipmentCounts,
  parseActiveWarehouseCarrier,
  parseWarehouseCarrier,
  parseWarehouseShipmentForm,
  resolveWarehouseFormCarrier,
  warehouseCarrierLabel,
  warehouseCarrierOptionsForSelect,
} from "./delivery-carriers";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";

const sampleCatalog: WarehouseCarrierRow[] = WAREHOUSE_CARRIERS.map((entry, index) => ({
  slug: entry.value,
  label: entry.label,
  sortOrder: (index + 1) * 10,
  isActive: entry.value !== "inne",
}));

describe("WAREHOUSE_CARRIERS", () => {
  it("ma unikalne wartości enum", () => {
    const values = WAREHOUSE_CARRIERS.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("zawiera kurierów z dotychczasowej ewidencji", () => {
    for (const value of [
      "dpd",
      "dhl",
      "ups",
      "inpost",
      "kuehne_nagel",
      "mikran_bartek",
      "inne",
    ] as const) {
      expect(isWarehouseCarrier(value)).toBe(true);
      expect(warehouseCarrierLabel(value)).not.toBe(value);
    }
  });

  it("zwraca etykietę lub surową wartość", () => {
    expect(warehouseCarrierLabel("dpd")).toBe("DPD");
    expect(warehouseCarrierLabel("nieznany")).toBe("nieznany");
  });
});

describe("resolveWarehouseFormCarrier", () => {
  it("zachowuje ukryty slug z autouzupełnienia", () => {
    expect(resolveWarehouseFormCarrier("inne", sampleCatalog, "dpd")).toBe("inne");
  });

  it("zwraca domyślny slug dla nieznanego kuriera", () => {
    expect(resolveWarehouseFormCarrier("nieznany", sampleCatalog, "dpd")).toBe("dpd");
  });
});

describe("defaultWarehouseCarrierSlug", () => {
  it("zwraca pierwszego aktywnego kuriera", () => {
    expect(defaultWarehouseCarrierSlug(sampleCatalog)).toBe("dpd");
  });
});

describe("warehouseCarrierOptionsForSelect", () => {
  it("dołącza ukryty slug bieżącego wyboru", () => {
    const options = warehouseCarrierOptionsForSelect(sampleCatalog, "inne");
    expect(options.some((carrier) => carrier.slug === "inne")).toBe(true);
    expect(options.filter((carrier) => carrier.isActive).length).toBe(
      sampleCatalog.filter((carrier) => carrier.isActive).length
    );
  });
});

describe("parseActiveWarehouseCarrier", () => {
  it("akceptuje aktywny kurier z katalogu", () => {
    expect(parseActiveWarehouseCarrier("dpd", sampleCatalog)).toBe("dpd");
  });

  it("odrzuca ukryty kurier", () => {
    expect(() => parseActiveWarehouseCarrier("inne", sampleCatalog)).toThrow(/ukryty/i);
  });
});

describe("parseWarehouseCarrier", () => {
  it("akceptuje wartość z listy", () => {
    expect(parseWarehouseCarrier("dhl_express")).toBe("dhl_express");
  });

  it("rzuca czytelny błąd", () => {
    expect(() => parseWarehouseCarrier("kurier_xyz")).toThrow(/Nieprawidłowy kurier/);
  });
});

describe("parseWarehouseShipmentForm", () => {
  it("akceptuje paczki", () => {
    expect(parseWarehouseShipmentForm("paczki")).toBe("paczki");
  });

  it("rzuca czytelny błąd", () => {
    expect(() => parseWarehouseShipmentForm("kontener")).toThrow(
      /Nieprawidłowa forma dostawy/
    );
  });
});

describe("normalizeShipmentCounts", () => {
  it("zeruje paczki przy samej formie palet", () => {
    expect(normalizeShipmentCounts("palety", 1, 3)).toEqual({
      packageCount: 0,
      palletCount: 3,
    });
  });

  it("zeruje palety przy samej formie paczek", () => {
    expect(normalizeShipmentCounts("paczki", 4, 2)).toEqual({
      packageCount: 4,
      palletCount: 0,
    });
  });

  it("formatShipmentQuantitySuffix nie pokazuje paczek przy paletach", () => {
    expect(formatShipmentQuantitySuffix("palety", 1, 2)).toBe(" · 2 pal.");
  });
});
