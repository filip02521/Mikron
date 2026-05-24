import { describe, expect, it } from "vitest";
import { validateSupplierContactFields } from "@/lib/orders/validate-supplier-contact";

describe("validateSupplierContactFields", () => {
  it("wymaga sposobu zamówienia", () => {
    expect(validateSupplierContactFields("", "")).toMatch(/sposób zamówienia/i);
  });

  it("akceptuje poprawny mail", () => {
    expect(validateSupplierContactFields("MAILOWO", "biuro@dostawca.pl")).toBeNull();
  });

  it("akceptuje stronę bez https", () => {
    expect(validateSupplierContactFields("PRZEZ INTERNET", "www.sklep.pl")).toBeNull();
  });

  it("akceptuje telefon tylko w uwagach", () => {
    expect(
      validateSupplierContactFields("TELEFONICZNIE", "", "tel. +48 501 234 567")
    ).toBeNull();
  });
});
