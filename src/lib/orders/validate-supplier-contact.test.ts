import { describe, expect, it } from "vitest";
import {
  canonicalizeOrderMethodNotes,
  validateSupplierContactFields,
} from "@/lib/orders/validate-supplier-contact";

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

  it("akceptuje telefon w uwagach gdy w mails jest e-mail", () => {
    expect(
      validateSupplierContactFields(
        "TELEFONICZNIE",
        "biuro@dostawca.pl",
        "tel. +48 501 234 567"
      )
    ).toBeNull();
  });

  it("odrzuca sam e-mail przy sposobie telefon", () => {
    expect(validateSupplierContactFields("TELEFONICZNIE", "biuro@dostawca.pl")).toMatch(
      /telefon/i
    );
  });

  it("mapuje legacy „Telefon” na TELEFONICZNIE", () => {
    expect(
      validateSupplierContactFields("Telefon", "501 234 567")
    ).toBeNull();
  });

  it("mapuje legacy „MAIL”", () => {
    expect(validateSupplierContactFields("MAIL", "a@b.pl")).toBeNull();
  });

  it("nie mapuje luźnego tekstu z podsłowem MAIL", () => {
    expect(canonicalizeOrderMethodNotes("kontakt MAIL do biura")).toBe(
      "kontakt MAIL do biura"
    );
    expect(
      validateSupplierContactFields("kontakt MAIL do biura", "a@b.pl")
    ).toMatch(/sposób zamówienia/i);
  });
});
