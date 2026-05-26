import { describe, expect, it } from "vitest";
import {
  formatSubiektKontrahentLabel,
  matchSubiektKontrahentToSupplier,
} from "./match-supplier";

describe("matchSubiektKontrahentToSupplier", () => {
  const suppliers = [
    { id: "uuid-1", name: "ABC Sp. z o.o.", subiektKhId: 99 },
    { id: "uuid-2", name: "Inny Dostawca" },
  ];

  it("preferuje zapisane subiektKhId", () => {
    const id = matchSubiektKontrahentToSupplier(
      { kh_Id: 99, adr_NazwaPelna: "Inna nazwa w Subiekcie" },
      suppliers
    );
    expect(id).toBe("uuid-1");
  });

  it("dopasowuje po nazwie pełnej", () => {
    const id = matchSubiektKontrahentToSupplier(
      { kh_Id: 1, adr_NazwaPelna: "ABC Sp. z o.o." },
      suppliers
    );
    expect(id).toBe("uuid-1");
  });

  it("zwraca null bez dopasowania", () => {
    const id = matchSubiektKontrahentToSupplier(
      { kh_Id: 2, adr_Nazwa: "Całkiem obcy" },
      suppliers
    );
    expect(id).toBeNull();
  });
});

describe("formatSubiektKontrahentLabel", () => {
  it("łączy symbol i nazwę", () => {
    expect(
      formatSubiektKontrahentLabel({
        kh_Id: 1,
        kh_Symbol: "D01",
        adr_NazwaPelna: "Firma X",
      })
    ).toBe("D01 — Firma X");
  });
});
