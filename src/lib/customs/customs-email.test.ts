import { describe, expect, it } from "vitest";
import { customsEmailHtml, customsEmailSubject, parseEmailList } from "./customs-email";

describe("parseEmailList", () => {
  it("dzieli po przecinku, średniku i spacji, usuwa duplikaty, zgłasza błędne", () => {
    expect(parseEmailList("Odprawy@Agencja.pl; biuro@agencja.pl, odprawy@agencja.pl  zly@adres")).toEqual({
      emails: ["odprawy@agencja.pl", "biuro@agencja.pl"],
      invalid: ["zly@adres"],
    });
    expect(parseEmailList("  ")).toEqual({ emails: [], invalid: [] });
  });
});

describe("customsEmailSubject", () => {
  it("składa temat z dostawcy, faktury i ZD", () => {
    expect(customsEmailSubject({ supplierName: "Aswad", invoiceNumber: "AI/3177/26", zdNumber: "ZD 12/M/04/2026" })).toBe(
      "Odprawa celna - Aswad - faktura AI/3177/26 - ZD 12/M/04/2026"
    );
    expect(customsEmailSubject({ supplierName: "Aswad", invoiceNumber: "", zdNumber: null })).toBe("Odprawa celna - Aswad");
  });
});

describe("customsEmailHtml", () => {
  it("escapuje HTML i zachowuje wiersze oraz akapity", () => {
    const html = customsEmailHtml("Dzień dobry,\n\n1. Nożyk <17cm> & łopatka\n2-3. Kleszczyki");
    expect(html).toContain("<p style=\"margin:0 0 12px\">Dzień dobry,</p>");
    expect(html).toContain("1. Nożyk &lt;17cm&gt; &amp; łopatka<br>2-3. Kleszczyki");
    expect(html).not.toContain("<17cm>");
  });
});
