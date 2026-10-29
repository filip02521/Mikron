import { describe, expect, it } from "vitest";
import type { RolInvoiceView, RolLineView } from "./data";
import { parseRolMailInput, rolMailDraft, rolZdLines, rolZdMismatch, rolZdUwagi } from "./send-rules";

let id = 1;
const line = (p: Partial<RolLineView>): RolLineView => ({
  id: id++,
  fsDokId: 10,
  twId: 1,
  symbol: "764001",
  ivoclarCatalogNo: "764001",
  name: "Towar",
  qtyFs: 1,
  qtyKfs: 0,
  qtyOverride: null,
  excluded: false,
  ...p,
});
const inv = (fsDokId: number, p: Partial<RolInvoiceView> = {}): RolInvoiceView => ({
  fsDokId,
  fsNr: `FS ${fsDokId}`,
  fsDate: null,
  otherLinesCount: 0,
  kfsDokIds: [],
  excluded: false,
  excludedReason: "",
  pdf: "gotowy",
  pdfError: "",
  ...p,
});

describe("ZD do Ivoclara", () => {
  it("pozycje: suma po towarze z kilku FS, bez wyłączonych FS i pozycji", () => {
    expect(
      rolZdLines({
        invoices: [inv(10), inv(11), inv(12, { excluded: true })],
        lines: [
          line({ fsDokId: 10, twId: 1, qtyFs: 3 }),
          line({ fsDokId: 11, twId: 1, qtyFs: 6, qtyKfs: 1 }),
          line({ fsDokId: 11, twId: 2, qtyFs: 2, qtyOverride: 4 }),
          line({ fsDokId: 11, twId: 3, qtyFs: 5, excluded: true }),
          line({ fsDokId: 12, twId: 4, qtyFs: 9 }),
        ],
      })
    ).toEqual([
      { towarId: 1, ilosc: 8 },
      { towarId: 2, ilosc: 4 },
    ]);
  });

  it("opis bez roku", () => {
    expect(rolZdUwagi("Przykładowa", "2026-09-01")).toBe("ROL Przykładowa wrzesień");
  });

  it("weryfikacja po zapisie: brak albo mniejsza ilość to rozbieżność", () => {
    const sent = [
      { towarId: 1, ilosc: 8 },
      { towarId: 2, ilosc: 4 },
    ];
    expect(rolZdMismatch(sent, new Map([[1, 8], [2, 4]]))).toBeNull();
    expect(rolZdMismatch(sent, new Map([[1, 8], [2, 5]]))).toBeNull();
    expect(rolZdMismatch(sent, new Map([[1, 8]]))).toMatch(/1 z 2/);
    expect(rolZdMismatch(sent, new Map([[1, 7], [2, 4]]))).toMatch(/1 z 2/);
  });
});

describe("mail według wzoru", () => {
  const program = {
    label: "Przykładowa",
    discountPct: 25,
    addressLines: ["ul. Testowa 1", "00-001 Miasto"],
    nip: "000-000-00-00",
    toEmails: [] as string[],
    ccEmails: [] as string[],
  };
  const defaults = { toEmails: ["zamowienia@example.com"], ccEmails: ["kopia@example.com"], subject: "New Order" };

  it("treść, adresaci domyślni i podpis", () => {
    const d = rolMailDraft({ program, period: "2026-09-01", defaults, signature: "Pozdrawiam\nJan" });
    expect(d.to).toEqual(["zamowienia@example.com"]);
    expect(d.cc).toEqual(["kopia@example.com"]);
    expect(d.subject).toBe("New Order");
    expect(d.body).toBe(
      [
        "Dear Sirs,",
        "",
        "Please find attached our new order.",
        "",
        "ROL Przykładowa September -25%",
        "ul. Testowa 1",
        "00-001 Miasto",
        "NIP: 000-000-00-00",
        "",
        "Thank you,",
        "Pozdrawiam\nJan",
      ].join("\n")
    );
  });

  it("adresaci klienta wygrywają z domyślnymi (razem z jego DW)", () => {
    const d = rolMailDraft({
      program: { ...program, toEmails: ["opiekun@example.com"], ccEmails: [] },
      period: "2026-09-01",
      defaults,
      signature: "",
    });
    expect(d.to).toEqual(["opiekun@example.com"]);
    expect(d.cc).toEqual([]);
    expect(d.body.endsWith("Thank you,")).toBe(true);
  });
});

describe("walidacja okna maila", () => {
  const ok = { to: "A@example.com; b@example.com", cc: "", subject: " New Order ", body: "Treść\r\n" };
  it("normalizuje", () => {
    expect(parseRolMailInput(ok)).toEqual({
      ok: true,
      value: { to: ["a@example.com", "b@example.com"], cc: [], subject: "New Order", body: "Treść" },
    });
  });
  it("odrzuca braki i złe adresy", () => {
    expect(parseRolMailInput({ ...ok, to: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/Do/) });
    expect(parseRolMailInput({ ...ok, cc: "zly" })).toMatchObject({ ok: false, error: expect.stringMatching(/zly/) });
    expect(parseRolMailInput({ ...ok, subject: "  " })).toMatchObject({ ok: false });
    expect(parseRolMailInput({ ...ok, body: "" })).toMatchObject({ ok: false });
  });
});
