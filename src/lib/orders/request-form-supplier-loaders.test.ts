import { describe, expect, it } from "vitest";
import {
  mapRowToOrderFormSupplier,
  mapRowsToOrderFormSuppliers,
  orderFormSuppliersHaveSubiektRefs,
} from "./order-form-suppliers";

/**
 * Audyt ścieżek ładowania dostawców do formularzy prośby.
 * Każda strona/modal powinien przekazywać pełny OrderFormSupplierOption (w tym subiekt_kh_id).
 */
const REQUEST_FORM_LOADER_PATHS = [
  {
    route: "/prosba",
    loader: "fetchSupplierFormContext → fetchSuppliersForRequestForms",
    sampleRow: { id: "s1", name: "Form", stats_mode: "LACZNIE", subiekt_kh_id: 100 },
  },
  {
    route: "/zamowienia/nowe",
    loader: "fetchSupplierFormContext → fetchSuppliersForRequestForms",
    sampleRow: { id: "s2", name: "Nowe", stats_mode: "OSOBNO", subiekt_kh_id: 200 },
  },
  {
    route: "/moje",
    loader: "fetchSuppliersForRequestForms",
    sampleRow: { id: "s3", name: "Moje", stats_mode: "LACZNIE", subiekt_kh_id: 300 },
  },
  {
    route: "/podsumowanie",
    loader: "fetchSummaryWorkspace → fetchSuppliersForRequestForms",
    sampleRow: { id: "s4", name: "Panel", stats_mode: "LACZNIE", subiekt_kh_id: 400 },
  },
  {
    route: "/weryfikacja",
    loader: "fetchSuppliersForRequestForms",
    sampleRow: { id: "s5", name: "Weryfikacja", stats_mode: "LACZNIE", subiekt_kh_id: 500 },
  },
] as const;

describe("request-form-supplier-loaders audit", () => {
  it.each(REQUEST_FORM_LOADER_PATHS)(
    "$route zachowuje subiekt_kh_id ($loader)",
    ({ sampleRow }) => {
      const mapped = mapRowToOrderFormSupplier(sampleRow);
      expect(mapped.subiekt_kh_id).toBe(sampleRow.subiekt_kh_id);
      expect(mapped.stats_mode).toBe(sampleRow.stats_mode);
    }
  );

  it("mapRowsToOrderFormSuppliers nie gubi pól przy mapowaniu listy (bug /moje)", () => {
    const rows = mapRowsToOrderFormSuppliers([
      { id: "a", name: "Bez kh", stats_mode: "LACZNIE" },
      { id: "b", name: "Z kh", stats_mode: "OSOBNO", subiekt_kh_id: 42 },
    ]);
    expect(rows).toEqual([
      { id: "a", name: "Bez kh", stats_mode: "LACZNIE", subiekt_kh_id: null },
      { id: "b", name: "Z kh", stats_mode: "OSOBNO", subiekt_kh_id: 42 },
    ]);
    expect(orderFormSuppliersHaveSubiektRefs(rows)).toBe(true);
  });

  it("strip { id, name } psuje dopasowanie Subiekt — brak klucza subiekt_kh_id", () => {
    const stripped = [{ id: "x", name: "X" }];
    expect(orderFormSuppliersHaveSubiektRefs(stripped)).toBe(false);
  });
});
