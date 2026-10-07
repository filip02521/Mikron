import { describe, expect, it } from "vitest";
import { MAIL_RECIPIENTS_MAX, parseMailRecipients } from "./recipients";

describe("parseMailRecipients", () => {
  it("Do i DW, bez powtórek i z małymi literami", () => {
    expect(parseMailRecipients("Zam@Dostawca.pl; b@x.pl", "kierownik@mikran.com, zam@dostawca.pl")).toEqual({
      ok: true,
      to: ["zam@dostawca.pl", "b@x.pl"],
      cc: ["kierownik@mikran.com"],
    });
  });
  it("puste DW jest w porządku, puste Do nie", () => {
    expect(parseMailRecipients("a@b.pl", "")).toEqual({ ok: true, to: ["a@b.pl"], cc: [] });
    expect(parseMailRecipients("  ", "a@b.pl")).toEqual({ ok: false, message: "Podaj adres odbiorcy." });
  });
  it("błędny adres wskazuje pole", () => {
    expect(parseMailRecipients("a@b.pl", "kierownik@")).toEqual({ ok: false, message: "Błędny adres w polu DW: kierownik@" });
    expect(parseMailRecipients("zly", "")).toMatchObject({ ok: false, message: "Błędny adres w polu Do: zly" });
  });
  it("limit adresów", () => {
    const many = Array.from({ length: MAIL_RECIPIENTS_MAX }, (_, i) => `u${i}@x.pl`).join(",");
    expect(parseMailRecipients(many, "extra@x.pl")).toMatchObject({ ok: false });
  });
});
