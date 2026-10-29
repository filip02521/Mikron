import { describe, expect, it } from "vitest";
import { decideRolMerge } from "./merge";
import { parseRolProgramInput, type RolProgramInput } from "./program";
import type { RolBatchDraft } from "./scan";

const draft = (fs: number[], hash: string, status: RolBatchDraft["status"] = "wykryte"): RolBatchDraft => ({
  programId: "p",
  status,
  contentHash: hash,
  lines: [],
  invoices: fs.map((id) => ({
    fsDokId: id,
    fsNr: `${id}`,
    fsDate: null,
    otherLinesCount: 0,
    kfsDokIds: [],
    excluded: false,
    excludedReason: "",
  })),
});

describe("decideRolMerge", () => {
  it("nowa paczka", () => {
    expect(decideRolMerge(null, draft([1], "h1"))).toEqual({ kind: "replace", status: "wykryte", changeNote: "", clearReview: false });
  });

  it("ten sam wynik — tylko data skanu, przegląd zostaje", () => {
    expect(decideRolMerge({ status: "przejrzane", contentHash: "h1", fsDokIds: [1] }, draft([1], "h1"))).toEqual({ kind: "touch" });
  });

  it("nowa FS po przeglądzie cofa do „wykryte” z różnicą", () => {
    expect(decideRolMerge({ status: "przejrzane", contentHash: "h1", fsDokIds: [1] }, draft([1, 2], "h2"))).toEqual({
      kind: "replace",
      status: "wykryte",
      changeNote: "+1 FS od przeglądu",
      clearReview: true,
    });
  });

  it("przed przeglądem zmiana bez cofania", () => {
    expect(decideRolMerge({ status: "wykryte", contentHash: "h1", fsDokIds: [1, 2] }, draft([2], "h2"))).toEqual({
      kind: "replace",
      status: "wykryte",
      changeNote: "−1 FS",
      clearReview: false,
    });
    expect(decideRolMerge({ status: "brak_zakupow", contentHash: "h0", fsDokIds: [] }, draft([3], "h3")).kind).toBe("replace");
  });

  it("po wysłaniu pozycje zostają, liczymy FS, które doszły później", () => {
    expect(decideRolMerge({ status: "wyslane", contentHash: "h1", fsDokIds: [1] }, draft([1, 2, 3], "h9"))).toEqual({
      kind: "late",
      lateFsCount: 2,
    });
    expect(decideRolMerge({ status: "potwierdzone", contentHash: "h1", fsDokIds: [1] }, draft([1], "h1"))).toEqual({
      kind: "late",
      lateFsCount: 0,
    });
  });
});

describe("parseRolProgramInput", () => {
  const base: RolProgramInput = {
    label: "Przykładowa",
    fileLabel: "",
    khIds: "101, 102",
    discountPct: "25",
    addressLines: "ul. Testowa 1\n\n00-001 Miasto\n",
    nip: "000-000-00-00",
    toEmails: "Zamowienia@example.com; opiekun@example.com",
    ccEmails: "",
    activeFrom: "2026-03-01",
    activeTo: "",
  };

  it("normalizuje listy i domyślną nazwę pliku", () => {
    const r = parseRolProgramInput(base);
    expect(r).toEqual({
      ok: true,
      value: expect.objectContaining({
        fileLabel: "Przykładowa",
        khIds: [101, 102],
        discountPct: 25,
        addressLines: ["ul. Testowa 1", "00-001 Miasto"],
        toEmails: ["zamowienia@example.com", "opiekun@example.com"],
        activeTo: null,
      }),
    });
  });

  it("odrzuca złe dane z komunikatem, co poprawić", () => {
    expect(parseRolProgramInput({ ...base, khIds: "abc" })).toMatchObject({ ok: false, error: expect.stringMatching(/kh_Id/) });
    expect(parseRolProgramInput({ ...base, toEmails: "nie-mail" })).toMatchObject({ ok: false, error: expect.stringMatching(/Do:/) });
    expect(parseRolProgramInput({ ...base, discountPct: "125" })).toMatchObject({ ok: false });
    expect(parseRolProgramInput({ ...base, fileLabel: "A/B" })).toMatchObject({ ok: false });
    expect(parseRolProgramInput({ ...base, activeTo: "2026-01-01" })).toMatchObject({ ok: false });
    expect(parseRolProgramInput({ ...base, id: "x" })).toMatchObject({ ok: false });
  });
});
