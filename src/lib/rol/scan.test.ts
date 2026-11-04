import { describe, expect, it } from "vitest";
import type { SubiektDocument, SubiektListParams } from "@/lib/subiekt/types";
import {
  assignFsToPrograms,
  buildBatchDraft,
  ivoclarCatalogNo,
  lastShortRange,
  previousMonthPeriod,
  programsForRange,
  rolMonthRange,
  rolPeriodRange,
  rolRangeKind,
  rolRangesForMonthScan,
  shortRangesInMonth,
  ROL_CONFLICT_REASON,
  scanRolPeriod,
  type RolProgramScope,
  type RolScanDeps,
} from "./scan";

// Dane zmyślone: kartoteki 101/102 = klient A, 201 = klient B, 900 = ktoś spoza ROL.
const A: RolProgramScope = { id: "prog-a", khIds: [101, 102], active: true, reportFrequency: "month" };
const B: RolProgramScope = { id: "prog-b", khIds: [201], active: true, reportFrequency: "month" };
const IVOCLAR = new Set([1, 2, 3]);

function fs(id: number, date: string, kh: { p?: number; o?: number }, lines: Array<[number, number, string?]> = []): SubiektDocument {
  return {
    dok_Id: id,
    dok_NrPelny: `FS ${id}/09/2026`,
    dok_DataWyst: `${date}T00:00:00`,
    dok_PlatnikId: kh.p ?? null,
    dok_OdbiorcaId: kh.o ?? null,
    dok_Pozycja: lines.map(([tw, qty, symbol]) => ({
      ob_TowId: tw,
      ob_Ilosc: qty,
      tw_Symbol: symbol ?? `76400${tw}`,
      tw_Nazwa: `Towar ${tw}`,
    })),
  };
}

const page = (data: SubiektDocument[], totalPages: number) => ({
  data,
  pagination: { page: 1, pageSize: 200, totalCount: data.length, totalPages },
});

function deps(input: {
  fsPages: SubiektDocument[][];
  kfs?: SubiektDocument[];
  failPage?: number;
}): RolScanDeps & { calls: SubiektListParams[] } {
  const all = [...input.fsPages.flat(), ...(input.kfs ?? [])];
  const calls: SubiektListParams[] = [];
  return {
    calls,
    listFs: async (params) => {
      calls.push(params);
      if (params.page === input.failPage) throw new Error("timeout");
      return page(input.fsPages[(params.page ?? 1) - 1] ?? [], input.fsPages.length);
    },
    getFs: async (id) => all.find((d) => d.dok_Id === id)!,
    listDocuments: async () => page(input.kfs ?? [], 1),
    getDocument: async (id) => all.find((d) => d.dok_Id === id)!,
    loadIvoclarTwIds: async () => IVOCLAR,
  };
}

const SEPT = rolMonthRange("2026-09-01");
const run = (d: RolScanDeps, programs = [A, B], extra: Partial<Parameters<typeof scanRolPeriod>[1]> = {}) =>
  scanRolPeriod(d, { range: SEPT, todayKey: "2026-10-02", programs, ...extra });

describe("okres", () => {
  it("poprzedni miesiąc i zakres dat", () => {
    expect(previousMonthPeriod("2026-10-01")).toBe("2026-09-01");
    expect(previousMonthPeriod("2027-01-15")).toBe("2026-12-01");
    expect(rolPeriodRange("2026-09-01")).toEqual({ dataOd: "2026-09-01", dataDo: "2026-09-30" });
    expect(rolPeriodRange("2028-02-01").dataDo).toBe("2028-02-29");
  });

  it("rodzaj okresu: miesiąc, tydzień, dwa tygodnie", () => {
    expect(rolRangeKind(SEPT)).toBe("month");
    expect(rolRangeKind({ start: "2026-10-26", end: "2026-11-01" })).toBe("week");
    expect(rolRangeKind({ start: "2026-10-12", end: "2026-10-25" })).toBe("2weeks");
    expect(rolRangeKind({ start: "2026-09-01", end: "2026-09-29" })).toBeNull();
  });

  it("ostatni zakończony tydzień i blok dwutygodniowy (stała kotwica, poniedziałki)", () => {
    // 2026-11-04 to środa; 2026-11-02 poniedziałek.
    expect(lastShortRange("week", "2026-11-04")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(lastShortRange("week", "2026-11-02")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(lastShortRange("week", "2026-11-01")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(lastShortRange("2weeks", "2026-11-04")).toEqual({ start: "2026-10-12", end: "2026-10-25" });
    expect(lastShortRange("2weeks", "2026-11-09")).toEqual({ start: "2026-10-26", end: "2026-11-08" });
    // Przełom roku: tydzień od poniedziałku 28.12.
    expect(lastShortRange("week", "2027-01-05")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });

  it("krótkie okresy miesiąca: tylko zakończone i zaczynające się w tym miesiącu", () => {
    expect(shortRangesInMonth("week", "2026-10-01", "2026-11-04").map((r) => r.start)).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
    expect(shortRangesInMonth("week", "2026-11-01", "2026-11-04")).toEqual([]);
    expect(shortRangesInMonth("2weeks", "2026-10-01", "2026-11-04").map((r) => r.start)).toEqual(["2026-10-12"]);
  });

  it("raport dotyczy aktywnych; krótki okres — tylko klientów z tą częstotliwością", () => {
    const weekly = { ...A, reportFrequency: "week" as const };
    const off = { ...B, active: false };
    expect(programsForRange([weekly, off], SEPT)).toEqual([weekly]);
    expect(programsForRange([weekly, B], { start: "2026-10-26", end: "2026-11-01" })).toEqual([weekly]);
  });

  it("„Sprawdź ponownie”: krótkie okresy przed miesiącem, miesiąc dopiero po jego końcu", () => {
    const weekly = [{ active: true, reportFrequency: "week" as const }];
    expect(rolRangesForMonthScan("2026-10-01", "2026-11-04", [{ active: true, reportFrequency: "month" }])).toEqual([
      rolMonthRange("2026-10-01"),
    ]);
    const oct = rolRangesForMonthScan("2026-10-01", "2026-11-04", weekly);
    expect(oct.at(-1)).toEqual(rolMonthRange("2026-10-01"));
    expect(oct).toHaveLength(5);
    expect(rolRangesForMonthScan("2026-11-01", "2026-11-04", weekly)).toEqual([]);
    expect(rolRangesForMonthScan("2026-11-01", "2026-11-10", weekly)).toEqual([{ start: "2026-11-02", end: "2026-11-08" }]);
  });

  it("numer katalogowy Ivoclar to 6 cyfr", () => {
    expect(ivoclarCatalogNo(" 764338 ")).toBe("764338");
    expect(ivoclarCatalogNo("IV-764338")).toBeNull();
    expect(ivoclarCatalogNo("")).toBeNull();
  });
});

describe("przypisanie FS", () => {
  it("po płatniku albo odbiorcy; dwa programy → konflikt; obcy klient pominięty", () => {
    const h = (id: number, p: number | null, o: number | null) => ({ id, nr: `${id}`, date: null, platnikId: p, odbiorcaId: o });
    const { byProgram, conflicts } = assignFsToPrograms(
      [h(1, 101, null), h(2, 900, 102), h(3, 101, 201), h(4, 900, 900)],
      [A, B]
    );
    expect(byProgram.get("prog-a")!.map((x) => x.id)).toEqual([1, 2]);
    expect(byProgram.get("prog-b")).toEqual([]);
    expect(conflicts.map((c) => [c.fs.id, c.programIds])).toEqual([[3, ["prog-a", "prog-b"]]]);
  });
});

describe("scanRolPeriod", () => {
  it("czyta wszystkie strony po 200 i liczy przejrzane FS", async () => {
    const d = deps({
      fsPages: [
        [fs(10, "2026-09-02", { p: 101 }, [[1, 2]]), fs(11, "2026-09-03", { p: 900 }, [[1, 5]])],
        [fs(12, "2026-09-20", { o: 201 }, [[2, 1]])],
      ],
    });
    const res = await run(d);
    expect(d.calls.map((c) => [c.page, c.pageSize, c.dataOd, c.dataDo])).toEqual([
      [1, 200, "2026-09-01", "2026-09-30"],
      [2, 200, "2026-09-01", "2026-09-30"],
    ]);
    expect(res.fsChecked).toBe(3);
    const [a, b] = res.drafts;
    expect(a!.lines.map((l) => [l.fsDokId, l.twId, l.qtyFs])).toEqual([[10, 1, 2]]);
    expect(b!.lines.map((l) => [l.fsDokId, l.twId, l.qtyFs])).toEqual([[12, 2, 1]]);
  });

  it("błąd strony przerywa skan bez wyniku częściowego", async () => {
    const d = deps({ fsPages: [[fs(10, "2026-09-02", { p: 101 }, [[1, 2]])], []], failPage: 2 });
    await expect(run(d)).rejects.toThrow("timeout");
  });

  it("pozycje innych producentów pominięte i policzone; FS bez Ivoclar poza paczką", async () => {
    const d = deps({
      fsPages: [[fs(10, "2026-09-02", { p: 101 }, [[1, 2], [50, 3], [51, 1]]), fs(13, "2026-09-05", { p: 101 }, [[50, 1]])]],
    });
    const [a, b] = (await run(d)).drafts;
    expect(a!.invoices.map((i) => [i.fsDokId, i.otherLinesCount])).toEqual([[10, 2]]);
    expect(a!.status).toBe("wykryte");
    expect(b!.status).toBe("brak_zakupow");
    expect(b!.invoices).toEqual([]);
  });

  it("FS dwóch klientów wchodzi do obu paczek jako wyłączona, do decyzji", async () => {
    const d = deps({ fsPages: [[fs(14, "2026-09-07", { p: 101, o: 201 }, [[3, 1]])]] });
    const [a, b] = (await run(d)).drafts;
    for (const draft of [a!, b!]) {
      expect(draft.invoices).toEqual([expect.objectContaining({ fsDokId: 14, excluded: true, excludedReason: ROL_CONFLICT_REASON })]);
    }
  });

  it("plik klienta A nie dostaje pozycji klienta B przy tym samym towarze", async () => {
    const d = deps({
      fsPages: [[fs(10, "2026-09-02", { p: 101 }, [[1, 2]]), fs(12, "2026-09-03", { p: 201 }, [[1, 7]])]],
    });
    const [a, b] = (await run(d)).drafts;
    expect(a!.lines.map((l) => [l.fsDokId, l.qtyFs])).toEqual([[10, 2]]);
    expect(b!.lines.map((l) => [l.fsDokId, l.qtyFs])).toEqual([[12, 7]]);
  });

  it("klient nieaktywny nie dostaje paczki", async () => {
    const d = deps({ fsPages: [[fs(10, "2026-09-02", { p: 101 }, [[1, 2]])]] });
    const res = await run(d, [{ ...A, active: false }, B]);
    expect(res.drafts.map((x) => x.programId)).toEqual(["prog-b"]);
  });

  it("FS, którą klient ma już w innym zgłoszeniu, nie wraca do raportu (miesięczny = reszta)", async () => {
    const d = deps({
      fsPages: [[fs(10, "2026-09-02", { p: 101 }, [[1, 2]]), fs(11, "2026-09-20", { p: 101 }, [[2, 1]]), fs(12, "2026-09-03", { p: 201 }, [[1, 7]])]],
    });
    const res = await run(d, [A, B], { claimed: new Map([["prog-a", new Set([10])], ["prog-b", new Set([10])]]) });
    const [a, b] = res.drafts;
    expect(a!.invoices.map((i) => i.fsDokId)).toEqual([11]);
    expect(b!.invoices.map((i) => i.fsDokId)).toEqual([12]);
    // Szczegółów zgłoszonej FS skan nie pobiera.
    expect(res.fsChecked).toBe(3);
  });

  it("pusty zakres Ivoclar to błąd, nie „brak zakupów”", async () => {
    const d = { ...deps({ fsPages: [[]] }), loadIvoclarTwIds: async () => new Set<number>() };
    await expect(run(d)).rejects.toThrow(/Ivoclar/);
  });
});

describe("korekty KFS", () => {
  const base = { programId: "prog-a", range: SEPT, isIvoclar: (tw: number) => IVOCLAR.has(tw) };
  const header = (id: number, date: string) => ({ id, nr: `FS ${id}`, date, platnikId: 101, odbiorcaId: null });
  const kfs = (id: number, date: string, corrected: number | null, lines: Array<[number, number]>) => ({
    ...header(id, date),
    correctedFsId: corrected,
    lines: lines.map(([twId, qty]) => ({ twId, qty, symbol: "", name: "" })),
  });

  it("KFS wskazująca FS odejmuje od tej FS, nie poniżej zera", () => {
    const draft = buildBatchDraft({
      ...base,
      fs: [
        { header: header(10, "2026-09-02"), lines: [{ twId: 1, qty: 2, symbol: "764001", name: "" }] },
        { header: header(11, "2026-09-20"), lines: [{ twId: 1, qty: 3, symbol: "764001", name: "" }] },
      ],
      kfs: [kfs(500, "2026-10-01", 10, [[1, 5]])],
    });
    expect(draft.lines.map((l) => [l.fsDokId, l.qtyFs, l.qtyKfs])).toEqual([
      [10, 2, 2],
      [11, 3, 0],
    ]);
    expect(draft.invoices.find((i) => i.fsDokId === 10)!.kfsDokIds).toEqual([500]);
  });

  it("KFS bez wskazania: tylko z tego miesiąca, od najpóźniejszej FS", () => {
    const fsLines = [
      { header: header(10, "2026-09-02"), lines: [{ twId: 1, qty: 2, symbol: "764001", name: "" }] },
      { header: header(11, "2026-09-20"), lines: [{ twId: 1, qty: 3, symbol: "764001", name: "" }] },
    ];
    const inMonth = buildBatchDraft({ ...base, fs: fsLines, kfs: [kfs(501, "2026-09-25", null, [[1, 4]])] });
    expect(inMonth.lines.map((l) => [l.fsDokId, l.qtyKfs])).toEqual([
      [10, 1],
      [11, 3],
    ]);
    const later = buildBatchDraft({ ...base, fs: fsLines, kfs: [kfs(502, "2026-10-02", null, [[1, 4]])] });
    expect(later.lines.every((l) => l.qtyKfs === 0)).toBe(true);
  });

  it("wszystko skorygowane → brak zakupów; zmiana KFS zmienia odcisk", () => {
    const fsLines = [{ header: header(10, "2026-09-02"), lines: [{ twId: 1, qty: 2, symbol: "764001", name: "" }] }];
    const plain = buildBatchDraft({ ...base, fs: fsLines, kfs: [] });
    const zeroed = buildBatchDraft({ ...base, fs: fsLines, kfs: [kfs(503, "2026-09-10", 10, [[1, 2]])] });
    expect(plain.status).toBe("wykryte");
    expect(zeroed.status).toBe("brak_zakupow");
    expect(zeroed.contentHash).not.toBe(plain.contentHash);
  });
});
