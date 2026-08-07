import { describe, expect, it } from "vitest";
import {
  applyGroupStockWindow,
  matchSupplierForGroupName,
} from "./zd-estimate-group-stock";
import { salesWindowFromDniZapasu } from "./zd-estimate-manual";

const suppliers = [
  {
    id: "f",
    name: "Falcon",
    dniZapasu: 60,
    stockLabel: "2 mies.",
  },
  {
    id: "i",
    name: "Ivoclar Vivadent - EXCEL",
    dniZapasu: 42,
    stockLabel: "6 tyg.",
  },
  {
    id: "x",
    name: "Formlabs",
    dniZapasu: 30,
    stockLabel: "1 miesiąc",
  },
];

describe("matchSupplierForGroupName", () => {
  it("Falcon → Falcon", () => {
    expect(matchSupplierForGroupName("Falcon", suppliers)?.id).toBe("f");
  });

  it("Ivoclar Technical → Ivoclar Vivadent", () => {
    expect(matchSupplierForGroupName("Ivoclar Technical", suppliers)?.id).toBe(
      "i"
    );
  });

  it("Ivoclar Clinical → Ivoclar Vivadent", () => {
    expect(matchSupplierForGroupName("Ivoclar Clinical", suppliers)?.id).toBe(
      "i"
    );
  });

  it("brak dopasowania", () => {
    expect(matchSupplierForGroupName("3M Espe", suppliers)).toBeNull();
  });
});

describe("applyGroupStockWindow", () => {
  it("Falcon: 2 mies. → 60 dni i dataOd względem końca sprzedaży", () => {
    const applied = applyGroupStockWindow({
      groupName: "Falcon",
      suppliers,
      salesEndKey: "2026-04-24",
      fallbackDniZapasu: 30,
      salesWindowFromDniZapasu,
    });
    expect(applied.matched).toBe(true);
    expect(applied.dniZapasu).toBe(60);
    expect(applied.supplierName).toBe("Falcon");
    expect(applied.dataDo).toBe("2026-04-24");
    expect(applied.dataOd).toBe("2026-02-24");
  });

  it("bez matcha: fallback dniZapasu", () => {
    const applied = applyGroupStockWindow({
      groupName: "Nieznana",
      suppliers,
      salesEndKey: "2026-04-24",
      fallbackDniZapasu: 30,
      salesWindowFromDniZapasu,
    });
    expect(applied.matched).toBe(false);
    expect(applied.dniZapasu).toBe(30);
    expect(applied.dataOd).toBe("2026-03-26");
  });
});
