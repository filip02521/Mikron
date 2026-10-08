import { describe, expect, it } from "vitest";
import {
  supplierInquiryWait,
  buildSupplierInquiryDraft,
  pendingInquiryToSupplier,
  pendingSupplierInquiry,
  supplierInquiryRef,
  type BoardSupplierInquiry,
} from "./supplier-inquiry";

const product = {
  id: "3f2a9c1e-0000-4000-8000-000000000001",
  title: "Frez Diadur Micro 302801 - kiedy dostawa?",
  product_name: "Frez Diadur Micro",
  product_symbol: "302801",
  mikran_code: null,
};

describe("buildSupplierInquiryDraft", () => {
  it("PL: produkt, symbol, trzy pytania i znacznik wątku w temacie", () => {
    const d = buildSupplierInquiryDraft({ product, english: false, signature: "Jan\nZakupy" });
    expect(d.subject).toBe("Zapytanie o produkt: Frez Diadur Micro (302801) [OnTime #3f2a9c1e]");
    expect(d.body).toContain("Frez Diadur Micro\nSymbol / nr katalogowy: 302801");
    expect(d.body).toContain("- aktualną cenę netto,");
    expect(d.body).toContain("- dostępność,");
    expect(d.body).toContain("- czas realizacji od zamówienia.");
    expect(d.body.endsWith("Pozdrawiamy\nJan\nZakupy")).toBe(true);
  });

  it("EN dla dostawcy z zagranicy", () => {
    const d = buildSupplierInquiryDraft({ product, english: true });
    expect(d.subject.startsWith("Product inquiry: Frez Diadur Micro (302801)")).toBe(true);
    expect(d.body).toContain("Product code: 302801");
    expect(d.body).toContain("lead time from order");
  });

  it("produkt spoza Subiekta: tytuł pytania zamiast nazwy, bez linii symbolu", () => {
    const d = buildSupplierInquiryDraft({
      product: { id: product.id, title: "Wentylator RL90-18/50", product_name: null, product_symbol: null, mikran_code: null },
      english: false,
    });
    expect(d.subject).toBe("Zapytanie o produkt: Wentylator RL90-18/50 [OnTime #3f2a9c1e]");
    expect(d.body).not.toContain("Symbol");
  });

  it("nie powtarza symbolu, który już jest w nazwie", () => {
    const d = buildSupplierInquiryDraft({
      product: { ...product, product_name: "Frez 302801" },
      english: false,
    });
    expect(d.subject).toBe("Zapytanie o produkt: Frez 302801 [OnTime #3f2a9c1e]");
    expect(d.body).not.toContain("Symbol");
  });
});

describe("supplierInquiryRef", () => {
  it("8 znaków id bez myślników", () => {
    expect(supplierInquiryRef("ab-cd-ef-12-34-56")).toBe("[OnTime #abcdef12]");
  });
});

describe("pendingInquiryToSupplier", () => {
  const i = (id: string, supplierId: string | null, resolvedAt: string | null) => ({
    id, supplierId, supplierName: "x", sentAt: "2026-10-05T10:00:00.000Z", resolvedAt,
  });
  it("szuka po id dostawcy wśród wszystkich czekających, nie tylko najnowszego", () => {
    expect(pendingInquiryToSupplier([i("a", "s2", null), i("b", "s1", null)], "s1")?.id).toBe("b");
    expect(pendingInquiryToSupplier([i("a", "s1", "2026-10-05T12:00:00.000Z")], "s1")).toBeNull();
    expect(pendingInquiryToSupplier([i("a", null, null)], "s1")).toBeNull();
  });
});

describe("pendingSupplierInquiry", () => {
  const base: BoardSupplierInquiry = {
    id: "1",
    supplierId: "sup-1",
    supplierName: "DFS",
   
    sentAt: "2026-10-05T10:00:00.000Z",
    resolvedAt: null,
  };

  it("brak zapytań → null", () => {
    expect(pendingSupplierInquiry([])).toBeNull();
    expect(pendingSupplierInquiry(undefined)).toBeNull();
  });

  it("najnowsze bez odpowiedzi → czeka", () => {
    const older = { ...base, id: "0", sentAt: "2026-10-04T10:00:00.000Z", resolvedAt: "2026-10-04T12:00:00.000Z" };
    expect(pendingSupplierInquiry([older, base])?.id).toBe("1");
  });

  it("najnowsze już z odpowiedzią → nie czeka", () => {
    expect(pendingSupplierInquiry([{ ...base, resolvedAt: "2026-10-05T12:00:00.000Z" }])).toBeNull();
  });

  it("podpis z pożegnaniem zastępuje pożegnanie szkicu (bez podwójnego „Pozdrawiam”)", () => {
    const en = buildSupplierInquiryDraft({ product, english: true, signature: "Pozdrawiam/Best Regards\n\nFilip" });
    expect(en.body).toContain("Thank you in advance.\nPozdrawiam/Best Regards");
    expect(en.body).not.toContain("Kind regards");
  });
});

describe("supplierInquiryWait", () => {
  // 2026-10-05 to poniedziałek.
  const sentAt = "2026-10-05T09:00:00+02:00";

  it("liczy dni robocze, weekend nie przeterminowuje", () => {
    expect(supplierInquiryWait({ sentAt }, new Date("2026-10-05T15:00:00+02:00"))).toEqual({
      businessDays: 0,
      overdue: false,
    });
    expect(supplierInquiryWait({ sentAt }, new Date("2026-10-07T10:00:00+02:00")).overdue).toBe(false);
    expect(supplierInquiryWait({ sentAt }, new Date("2026-10-08T10:00:00+02:00"))).toEqual({
      businessDays: 3,
      overdue: true,
    });
    // Piątek → poniedziałek to 1 dzień roboczy.
    expect(
      supplierInquiryWait({ sentAt: "2026-10-09T09:00:00+02:00" }, new Date("2026-10-12T09:00:00+02:00"))
        .businessDays
    ).toBe(1);
  });
});
