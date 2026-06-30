import { describe, expect, it } from "vitest";
import type { IndividualOrder } from "@/types/database";
import {
  emptyVerificationForm,
  orderToVerificationForm,
  shouldLookupSupplierFromCatalog,
} from "./verification-form";

const baseOrder: IndividualOrder = {
  id: "ord-1",
  supplier_id: null,
  sales_person_id: "sp-1",
  symbol: "-",
  products: "Do uzupełnienia",
  quantity: "-",
  delivered_quantity: "-",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Weryfikacja",
  action_at: "2026-05-01T10:00:00Z",
  ordered_at: null,
  delivery_at: null,
  sales_person: { id: "sp-1", name: "Jan Kowalski", email: "jan@test.pl" },
};

describe("orderToVerificationForm", () => {
  it("mapuje puste pola weryfikacji na pusty formularz", () => {
    expect(orderToVerificationForm(baseOrder)).toEqual({
      supplierId: "",
      salesPersonId: "sp-1",
      symbol: "",
      mikranCode: "",
      product: "",
      quantity: "",
      requestKind: "zamowienie",
      subiektTwId: null,
      informacjaPath: null,
      teethDetails: null,
    });
  });

  it("wczytuje dostawcę, produkt i ilość z bazy", () => {
    const form = orderToVerificationForm({
      ...baseOrder,
      supplier_id: "sup-a",
      symbol: "ABC-1",
      products: "Śruba M6",
      quantity: "5",
      mikran_code: " 123 ",
      subiekt_tw_id: 9001,
    });
    expect(form).toMatchObject({
      supplierId: "sup-a",
      symbol: "ABC-1",
      product: "Śruba M6",
      quantity: "5",
      mikranCode: "123",
      subiektTwId: 9001,
    });
  });

  it("wczytuje ścieżkę informacji", () => {
    const form = orderToVerificationForm({
      ...baseOrder,
      request_kind: "informacja",
      informacja_stock_out_reorder: true,
      symbol: "X",
      products: "Brak na stanie",
      quantity: "-",
    });
    expect(form.requestKind).toBe("informacja");
    expect(form.informacjaPath).toBe("stock_out");
    expect(form.quantity).toBe("");
  });

  it("emptyVerificationForm ma domyślne wartości", () => {
    expect(emptyVerificationForm().requestKind).toBe("zamowienie");
    expect(emptyVerificationForm().supplierId).toBe("");
  });
});

describe("shouldLookupSupplierFromCatalog", () => {
  it("true gdy jest tw_Id bez supplier_id", () => {
    expect(
      shouldLookupSupplierFromCatalog({
        ...baseOrder,
        subiekt_tw_id: 42,
      })
    ).toBe(true);
  });

  it("false gdy dostawca już przypisany", () => {
    expect(
      shouldLookupSupplierFromCatalog({
        ...baseOrder,
        supplier_id: "sup-a",
        subiekt_tw_id: 42,
      })
    ).toBe(false);
  });

  it("false bez tw_Id", () => {
    expect(shouldLookupSupplierFromCatalog(baseOrder)).toBe(false);
  });
});
