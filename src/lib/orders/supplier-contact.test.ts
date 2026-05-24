import { describe, expect, it } from "vitest";
import { buildSupplierContactUi } from "./supplier-contact";

describe("buildSupplierContactUi", () => {
  it("mail — jeden klikalny adres zamiast osobnego przycisku", () => {
    const ui = buildSupplierContactUi("MAILOWO", "zamowienia@dostawca.pl");
    expect(ui.contactLink).toEqual({
      kind: "mailto",
      href: "mailto:zamowienia@dostawca.pl",
      label: "zamowienia@dostawca.pl",
    });
  });

  it("telefon — link tel:", () => {
    const ui = buildSupplierContactUi("TELEFONICZNIE", "+48 22 123 45 67");
    expect(ui.contactLink?.kind).toBe("tel");
    expect(ui.contactLink?.href).toMatch(/^tel:/);
  });

  it("internet — link www", () => {
    const ui = buildSupplierContactUi("PRZEZ INTERNET", "https://sklep.example.com");
    expect(ui.contactLink).toMatchObject({
      kind: "url",
      href: "https://sklep.example.com",
    });
  });

  it("internet — www bez protokołu", () => {
    const ui = buildSupplierContactUi("PRZEZ INTERNET", "www.sklep.example.com");
    expect(ui.contactLink).toMatchObject({
      kind: "url",
      href: "https://www.sklep.example.com",
      label: "www.sklep.example.com",
    });
  });

  it("internet — domena bez www", () => {
    const ui = buildSupplierContactUi("PRZEZ INTERNET", "sklep.example.com/zamowienia");
    expect(ui.contactLink?.kind).toBe("url");
    expect(ui.contactLink?.href).toContain("sklep.example.com");
  });

  it("bez kontaktu zwraca null", () => {
    const ui = buildSupplierContactUi("MAILOWO", "");
    expect(ui.contactLink).toBeNull();
    expect(ui.copyText).toBeNull();
  });

  it("MAILOWO + URL — nie linkuje strony przy odznace mail", () => {
    const ui = buildSupplierContactUi("MAILOWO", "https://sklep.example.com");
    expect(ui.contactLink).toBeNull();
    expect(ui.copyText).toBe("https://sklep.example.com");
  });

  it("telefon w extra_info gdy mails puste", () => {
    const ui = buildSupplierContactUi("TELEFONICZNIE", "", "tel. +48 501 234 567");
    expect(ui.contactLink?.kind).toBe("tel");
  });
});
