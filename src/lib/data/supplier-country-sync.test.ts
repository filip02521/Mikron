import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/pool", () => ({ query: queryMock }));
vi.mock("@/lib/subiekt/lookup-kontrahent", () => ({ lookupSubiektKontrahentByKhId: lookupMock }));

import { runSupplierCountrySync, syncSupplierCountry } from "./supplier-country-sync";
import { subiektCountryFromKontrahent, supplierCountryLabel } from "@/lib/suppliers/subiekt-country";

const updates = () => queryMock.mock.calls.filter(([sql]) => String(sql).startsWith("UPDATE"));

describe("subiektCountryFromKontrahent", () => {
  it("mapuje id i nazwę państwa", () => {
    expect(subiektCountryFromKontrahent({ adr_IdPanstwo: 1, adr_Panstwo: " Polska " })).toEqual({ id: 1, name: "Polska" });
    expect(subiektCountryFromKontrahent({ adr_IdPanstwo: "5", adr_Panstwo: "" })).toEqual({ id: 5, name: null });
  });
  it("brak / zły kod = pusty odczyt", () => {
    expect(subiektCountryFromKontrahent(null)).toBeNull();
    expect(subiektCountryFromKontrahent({ adr_IdPanstwo: null, adr_Panstwo: "Polska" })).toBeNull();
    expect(subiektCountryFromKontrahent({ adr_IdPanstwo: 0 })).toBeNull();
  });
  it("etykieta: Polska po kodzie, inne po nazwie", () => {
    expect(supplierCountryLabel(1, "POLSKA")).toBe("Polska");
    expect(supplierCountryLabel(7, "Niemcy")).toBe("Niemcy");
    expect(supplierCountryLabel(null, null)).toBeNull();
  });
});

describe("syncSupplierCountry", () => {
  beforeEach(() => {
    queryMock.mockReset().mockResolvedValue({ rows: [] });
    lookupMock.mockReset();
  });

  it("zapisuje kraj tylko dla bieżącego kh_Id", async () => {
    lookupMock.mockResolvedValue({ kh_Id: 900, adr_IdPanstwo: 7, adr_Panstwo: "Niemcy" });
    await expect(syncSupplierCountry("s1", 900)).resolves.toEqual({ id: 7, name: "Niemcy" });
    expect(updates()).toHaveLength(1);
    expect(updates()[0][0]).toContain("subiekt_kh_id = $2");
    expect(updates()[0][1]).toEqual(["s1", 900, 7, "Niemcy"]);
  });

  it("nieudany odczyt nie nadpisuje zapisanej wartości", async () => {
    lookupMock.mockResolvedValue(null);
    await expect(syncSupplierCountry("s1", 900)).resolves.toBeNull();
    lookupMock.mockResolvedValue({ kh_Id: 900, adr_IdPanstwo: null });
    await expect(syncSupplierCountry("s1", 900)).resolves.toBeNull();
    expect(updates()).toHaveLength(0);
  });

  it("zmiana kh_Id bez odczytu czyści kraj poprzedniego kontrahenta", async () => {
    lookupMock.mockResolvedValue(null);
    await syncSupplierCountry("s1", 901, { clearOnMiss: true });
    expect(updates()).toHaveLength(1);
    expect(updates()[0][0]).toContain("subiekt_country_id = NULL");
    expect(updates()[0][1]).toEqual(["s1", 901]);
  });

  it("odpięcie kh_Id czyści kraj bez pytania Subiekta", async () => {
    await syncSupplierCountry("s1", null);
    expect(lookupMock).not.toHaveBeenCalled();
    expect(updates()[0][1]).toEqual(["s1"]);
  });
});

describe("runSupplierCountrySync", () => {
  it("liczy zapisane, nieodczytane i polskie", async () => {
    queryMock.mockReset().mockImplementation(async (sql: string) =>
      sql.startsWith("SELECT")
        ? { rows: [{ id: "a", subiekt_kh_id: 1 }, { id: "b", subiekt_kh_id: 2 }, { id: "c", subiekt_kh_id: 3 }] }
        : { rows: [] }
    );
    lookupMock.mockReset().mockImplementation(async (kh: number) =>
      kh === 1 ? { adr_IdPanstwo: 1, adr_Panstwo: "Polska" } : kh === 2 ? { adr_IdPanstwo: 7, adr_Panstwo: "Niemcy" } : null
    );
    await expect(runSupplierCountrySync()).resolves.toEqual({ suppliers: 3, updated: 2, unread: 1, poland: 1 });
    expect(updates()).toHaveLength(2);
  });
});
