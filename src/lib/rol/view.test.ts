import { describe, expect, it } from "vitest";
import type { RolInvoiceView, RolLineView } from "./data";
import { ROL_CONFLICT_REASON } from "./constants";
import { recentRolPeriods, rolBatchBlockers, rolBatchSummary, rolLineQty, rolPeriodLabel } from "./view";

const line = (p: Partial<RolLineView>): RolLineView => ({
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
const inv = (p: Partial<RolInvoiceView>): RolInvoiceView => ({
  fsDokId: 10,
  fsNr: "FS 10",
  fsDate: null,
  otherLinesCount: 0,
  kfsDokIds: [],
  excluded: false,
  excludedReason: "",
  pdf: "czeka",
  pdfError: "",
  ...p,
});

describe("miesiące", () => {
  it("etykieta i lista ostatnich miesięcy przez przełom roku", () => {
    expect(rolPeriodLabel("2026-09-01")).toBe("wrzesień 2026");
    expect(recentRolPeriods("2026-02-10", 3)).toEqual(["2026-01-01", "2025-12-01", "2025-11-01"]);
  });
});

describe("liczby w wierszu klienta", () => {
  it("ilość: ręczna wygrywa, KFS odjęte, nie poniżej zera", () => {
    expect(rolLineQty(line({ qtyFs: 3, qtyKfs: 1 }))).toBe(2);
    expect(rolLineQty(line({ qtyFs: 3, qtyKfs: 5 }))).toBe(0);
    expect(rolLineQty(line({ qtyFs: 3, qtyKfs: 1, qtyOverride: 4 }))).toBe(4);
  });

  it("wyłączone FS i pozycje nie wchodzą do liczb", () => {
    const s = rolBatchSummary({
      invoices: [inv({ fsDokId: 10 }), inv({ fsDokId: 11, excluded: true })],
      lines: [
        line({ fsDokId: 10, twId: 1, qtyFs: 2 }),
        line({ fsDokId: 10, twId: 2, qtyFs: 5, excluded: true }),
        line({ fsDokId: 11, twId: 3, qtyFs: 9 }),
        line({ fsDokId: 10, twId: 4, qtyFs: 1, qtyKfs: 1 }),
      ],
    });
    expect(s).toEqual({ fsCount: 1, positions: 1, pieces: 2, text: "1 pozycja · 2 szt." });
  });
});

describe("blokady", () => {
  it("konflikt klientów i brak nr kat. tylko dla pozycji, które idą do zgłoszenia", () => {
    expect(
      rolBatchBlockers({
        invoices: [inv({ fsDokId: 10 }), inv({ fsDokId: 12, excluded: true, excludedReason: ROL_CONFLICT_REASON })],
        lines: [
          line({ fsDokId: 10, twId: 1, ivoclarCatalogNo: null }),
          line({ fsDokId: 10, twId: 2, ivoclarCatalogNo: null, excluded: true }),
        ],
      })
    ).toEqual(["1 FS pasuje do dwóch klientów ROL", "1 pozycja bez nr kat. Ivoclar"]);
    expect(rolBatchBlockers({ invoices: [inv({})], lines: [line({})] })).toEqual([]);
  });
});
