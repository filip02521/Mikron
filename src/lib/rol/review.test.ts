import { describe, expect, it } from "vitest";
import { ROL_ASSIGNED_HERE_REASON, ROL_CONFLICT_REASON } from "./constants";
import type { RolInvoiceView, RolLineView } from "./data";
import {
  parseRolCatalogNo,
  parseRolQtyOverride,
  rolApproveError,
  rolBatchEditable,
  rolEditSummary,
  rolInvoiceAfterRescan,
  rolReopenError,
} from "./review";

const line = (p: Partial<RolLineView> = {}): RolLineView => ({
  id: 1,
  fsDokId: 10,
  twId: 1,
  symbol: "764001",
  ivoclarCatalogNo: "764001",
  name: "Towar",
  qtyFs: 2,
  qtyKfs: 0,
  qtyOverride: null,
  excluded: false,
  ...p,
});
const inv = (p: Partial<RolInvoiceView> = {}): RolInvoiceView => ({
  fsDokId: 10,
  fsNr: "FS 10",
  fsDate: null,
  otherLinesCount: 0,
  kfsDokIds: [],
  excluded: false,
  excludedReason: "",
  ...p,
});

describe("stany przeglądu", () => {
  it("edycja tylko w „wykryte”, ponowne otwarcie tylko z „przejrzane”", () => {
    expect(rolBatchEditable("wykryte")).toBe(true);
    expect(rolBatchEditable("przejrzane")).toBe(false);
    expect(rolBatchEditable("wyslane")).toBe(false);
    expect(rolReopenError("przejrzane")).toBeNull();
    expect(rolReopenError("wyslane")).toMatch(/niewysłaną/);
    expect(rolReopenError("wykryte")).not.toBeNull();
  });

  it("zatwierdzenie: blokady z powodem, pusta lista, zły stan", () => {
    expect(rolApproveError({ status: "wykryte", invoices: [inv()], lines: [line()] })).toBeNull();
    expect(rolApproveError({ status: "wykryte", invoices: [inv()], lines: [line({ ivoclarCatalogNo: null })] })).toMatch(
      /1 pozycja bez nr kat\. Ivoclar/
    );
    expect(
      rolApproveError({
        status: "wykryte",
        invoices: [inv(), inv({ fsDokId: 11, excluded: true, excludedReason: ROL_CONFLICT_REASON })],
        lines: [line()],
      })
    ).toMatch(/dwóch klientów/);
    expect(rolApproveError({ status: "wykryte", invoices: [inv()], lines: [line({ excluded: true })] })).toMatch(/żadnej pozycji/);
    expect(rolApproveError({ status: "przejrzane", invoices: [inv()], lines: [line()] })).toMatch(/już zatwierdzono/);
  });

  it("wyłączona pozycja bez nr kat. nie blokuje", () => {
    expect(
      rolApproveError({
        status: "wykryte",
        invoices: [inv()],
        lines: [line(), line({ id: 2, twId: 2, ivoclarCatalogNo: null, excluded: true })],
      })
    ).toBeNull();
  });
});

describe("walidacja", () => {
  it("ilość ręczna", () => {
    expect(parseRolQtyOverride("")).toEqual({ ok: true, value: null });
    expect(parseRolQtyOverride(" 3 ")).toEqual({ ok: true, value: 3 });
    expect(parseRolQtyOverride("1,5")).toEqual({ ok: true, value: 1.5 });
    expect(parseRolQtyOverride("0")).toEqual({ ok: true, value: 0 });
    for (const bad of ["-1", "abc", "1.2345", "1e9"]) expect(parseRolQtyOverride(bad).ok).toBe(false);
  });

  it("numer katalogowy", () => {
    expect(parseRolCatalogNo(" 764338 ")).toEqual({ ok: true, value: "764338" });
    expect(parseRolCatalogNo("76433").ok).toBe(false);
    expect(parseRolCatalogNo("IV764338").ok).toBe(false);
  });
});

describe("decyzje po ponownym skanie", () => {
  const draftNormal = { excluded: false, excludedReason: "" };
  const draftConflict = { excluded: true, excludedReason: ROL_CONFLICT_REASON };

  it("nowa FS albo dotąd nierozstrzygnięty konflikt — wynik skanu", () => {
    expect(rolInvoiceAfterRescan(undefined, draftConflict)).toEqual(draftConflict);
    expect(rolInvoiceAfterRescan({ excluded: true, excludedReason: ROL_CONFLICT_REASON }, draftConflict)).toEqual(draftConflict);
  });

  it("wyłączenie i przypisanie konfliktu przez użytkownika zostają", () => {
    expect(rolInvoiceAfterRescan({ excluded: true, excludedReason: "zwrot poza systemem" }, draftNormal)).toEqual({
      excluded: true,
      excludedReason: "zwrot poza systemem",
    });
    expect(rolInvoiceAfterRescan({ excluded: false, excludedReason: ROL_ASSIGNED_HERE_REASON }, draftConflict)).toEqual({
      excluded: false,
      excludedReason: ROL_ASSIGNED_HERE_REASON,
    });
  });

  it("nowy konflikt na FS, która była już w paczce bez decyzji, nie jest przeoczony", () => {
    expect(rolInvoiceAfterRescan({ excluded: false, excludedReason: "" }, draftConflict)).toEqual(draftConflict);
  });

  it("podsumowanie zmian liczy tylko decyzje użytkownika", () => {
    expect(
      rolEditSummary({
        invoices: [inv({ excluded: true, excludedReason: "x" }), inv({ fsDokId: 11, excluded: true, excludedReason: ROL_CONFLICT_REASON })],
        lines: [line({ qtyOverride: 1 }), line({ id: 2, excluded: true }), line({ id: 3 })],
      })
    ).toBe("1 FS wyłączona · 2 pozycje zmienione");
    expect(rolEditSummary({ invoices: [inv()], lines: [line()] })).toBe("");
  });
});
