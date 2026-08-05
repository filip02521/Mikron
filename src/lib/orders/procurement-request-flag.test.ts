import { describe, expect, it } from "vitest";
import {
  buildFlagSortOrderMap,
  buildProcurementListFilterCounts,
  groupHighestFlagPriority,
  groupMatchesProcurementFlagFilter,
  normalizeProcurementFlagLabel,
  normalizeProcurementFlagNote,
  parseProcurementFlagId,
  PROCUREMENT_FLAG_NONE_PRIORITY,
  PROCUREMENT_FLAG_ORPHAN_PRIORITY,
  PROCUREMENT_FLAG_SEED,
  procurementFlagLabelsEqual,
  procurementFlagPriority,
  procurementFlagNoteNeedsExpand,
  shortProcurementFlagLabel,
  summarizeGroupProcurementFlags,
} from "./procurement-request-flag";

const SORT = buildFlagSortOrderMap([
  {
    id: PROCUREMENT_FLAG_SEED.pilne,
    label: "Pilne",
    color: "rose",
    sortOrder: 0,
    isActive: true,
  },
  {
    id: PROCUREMENT_FLAG_SEED.wstrzymane,
    label: "Wstrzymane",
    color: "slate",
    sortOrder: 3,
    isActive: false,
  },
]);

describe("parseProcurementFlagId", () => {
  it("akceptuje uuid", () => {
    expect(parseProcurementFlagId(PROCUREMENT_FLAG_SEED.pilne)).toBe(
      PROCUREMENT_FLAG_SEED.pilne
    );
    expect(parseProcurementFlagId(PROCUREMENT_FLAG_SEED.wstrzymane)).toBe(
      PROCUREMENT_FLAG_SEED.wstrzymane
    );
  });

  it("odrzuca enum i śmieci", () => {
    expect(parseProcurementFlagId("pilne")).toBeNull();
    expect(parseProcurementFlagId("xyz")).toBeNull();
    expect(parseProcurementFlagId(null)).toBeNull();
  });
});

describe("normalizeProcurementFlagNote", () => {
  it("trimuje i nulluje puste", () => {
    expect(normalizeProcurementFlagNote("  a  ")).toBe("a");
    expect(normalizeProcurementFlagNote("   ")).toBeNull();
  });

  it("odrzuca za długi opis", () => {
    expect(() =>
      normalizeProcurementFlagNote("x".repeat(501))
    ).toThrow(/max 500/i);
  });
});

describe("normalizeProcurementFlagLabel / labelsEqual", () => {
  it("normalizuje i odrzuca za długą nazwę", () => {
    expect(normalizeProcurementFlagLabel("  Pilne  ")).toBe("Pilne");
    expect(() =>
      normalizeProcurementFlagLabel("x".repeat(41))
    ).toThrow(/max 40/i);
  });

  it("porównuje etykiety bez wielkości liter", () => {
    expect(procurementFlagLabelsEqual("Pilne", "pilne")).toBe(true);
    expect(procurementFlagLabelsEqual("A", "B")).toBe(false);
  });
});

describe("summarizeGroupProcurementFlags", () => {
  it("none gdy brak", () => {
    expect(
      summarizeGroupProcurementFlags([{ id: "1", products: "A", symbol: "S" }])
    ).toEqual({ kind: "none" });
  });

  it("single gdy jednolita", () => {
    const s = summarizeGroupProcurementFlags([
      {
        id: "1",
        products: "A",
        symbol: "S",
        procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
        procurementFlagNote: "x",
      },
      {
        id: "2",
        products: "B",
        symbol: "T",
        procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
        procurementFlagNote: "x",
      },
    ]);
    expect(s.kind).toBe("single");
    if (s.kind === "single") {
      expect(s.flag).toBe(PROCUREMENT_FLAG_SEED.pilne);
      expect(s.note).toBe("x");
    }
  });

  it("mixed gdy różne — najwyższa wg sort_order", () => {
    const s = summarizeGroupProcurementFlags(
      [
        {
          id: "1",
          products: "A",
          symbol: "S",
          procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
        },
        {
          id: "2",
          products: "B",
          symbol: "T",
          procurementFlag: PROCUREMENT_FLAG_SEED.wstrzymane,
        },
      ],
      SORT
    );
    expect(s.kind).toBe("mixed");
    if (s.kind === "mixed") {
      expect(s.highestFlag).toBe(PROCUREMENT_FLAG_SEED.pilne);
      expect(s.flaggedCount).toBe(2);
    }
  });

  it("mixed gdy tylko część linii ma tę samą flagę", () => {
    const s = summarizeGroupProcurementFlags([
      {
        id: "1",
        products: "A",
        symbol: "S",
        procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
      },
      { id: "2", products: "B", symbol: "T" },
    ]);
    expect(s.kind).toBe("mixed");
    if (s.kind === "mixed") {
      expect(s.highestFlag).toBe(PROCUREMENT_FLAG_SEED.pilne);
      expect(s.flaggedCount).toBe(1);
      expect(s.orderIds).toEqual(["1"]);
    }
  });
});

describe("groupHighestFlagPriority / filter", () => {
  it("priorytet sort_order; orphan między flagged a none", () => {
    expect(
      procurementFlagPriority(PROCUREMENT_FLAG_SEED.pilne, SORT)
    ).toBeLessThan(
      procurementFlagPriority(PROCUREMENT_FLAG_SEED.wstrzymane, SORT)
    );
    expect(procurementFlagPriority("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", SORT)).toBe(
      PROCUREMENT_FLAG_ORPHAN_PRIORITY
    );
    expect(procurementFlagPriority(null, SORT)).toBe(PROCUREMENT_FLAG_NONE_PRIORITY);
    expect(
      groupHighestFlagPriority(
        [
          {
            id: "1",
            products: "A",
            symbol: "S",
            procurementFlag: PROCUREMENT_FLAG_SEED.wstrzymane,
          },
          {
            id: "2",
            products: "B",
            symbol: "T",
            procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
          },
        ],
        SORT
      )
    ).toBe(procurementFlagPriority(PROCUREMENT_FLAG_SEED.pilne, SORT));
  });

  it("filtruje grupy; Bez flagi wyklucza urlop", () => {
    const lines = [
      {
        id: "1",
        products: "A",
        symbol: "S",
        procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
      },
      { id: "2", products: "B", symbol: "T" },
    ];
    expect(groupMatchesProcurementFlagFilter(lines, "all")).toBe(true);
    expect(
      groupMatchesProcurementFlagFilter(lines, PROCUREMENT_FLAG_SEED.pilne)
    ).toBe(true);
    expect(groupMatchesProcurementFlagFilter(lines, "none")).toBe(false);
    expect(
      groupMatchesProcurementFlagFilter(
        [{ id: "1", products: "A", symbol: "S" }],
        "none"
      )
    ).toBe(true);
    expect(
      groupMatchesProcurementFlagFilter(
        [{ id: "1", products: "A", symbol: "S" }],
        "none",
        { supplierOnVacation: true }
      )
    ).toBe(false);
  });
});

describe("buildProcurementListFilterCounts", () => {
  it("liczy grupy per filtr", () => {
    const groups = [
      {
        supplierId: "s1",
        lines: [
          {
            id: "1",
            products: "A",
            symbol: "S",
            procurementFlag: PROCUREMENT_FLAG_SEED.pilne,
          },
        ],
      },
      {
        supplierId: "s2",
        lines: [{ id: "2", products: "B", symbol: "T" }],
      },
      {
        supplierId: "s3",
        lines: [{ id: "3", products: "C", symbol: "U" }],
      },
    ];
    const counts = buildProcurementListFilterCounts(groups, {
      activeFlagIds: [PROCUREMENT_FLAG_SEED.pilne],
      suppliersOnVacationNow: {
        s3: { startDate: "2026-01-01", endDate: "2026-01-10" },
      },
    });
    expect(counts.all).toBe(3);
    expect(counts[PROCUREMENT_FLAG_SEED.pilne]).toBe(1);
    expect(counts.none).toBe(1); // s2 only — s3 on vacation
    expect(counts.urlop_dostawcy).toBe(1);
  });
});

describe("shortProcurementFlagLabel", () => {
  it("skraca tylko długie etykiety (pasek filtrów — chip wiersza pokazuje pełną nazwę)", () => {
    expect(shortProcurementFlagLabel("Pilne")).toBe("Pilne");
    expect(shortProcurementFlagLabel("Bardzo długa nazwa flagi zakupów", 14)).toBe(
      "Bardzo długa …"
    );
    expect(shortProcurementFlagLabel("x".repeat(18))).toBe("x".repeat(18));
    expect(shortProcurementFlagLabel("x".repeat(19))).toBe(`${"x".repeat(17)}…`);
  });
});

describe("procurementFlagNoteNeedsExpand", () => {
  it("nie rozwija krótkiego opisu w jednej linii", () => {
    expect(procurementFlagNoteNeedsExpand("Czekamy na KH")).toBe(false);
    expect(procurementFlagNoteNeedsExpand("")).toBe(false);
    expect(procurementFlagNoteNeedsExpand("x".repeat(48))).toBe(false);
  });

  it("rozwija dłuższy lub wieloliniowy opis", () => {
    expect(procurementFlagNoteNeedsExpand("x".repeat(49))).toBe(true);
    expect(procurementFlagNoteNeedsExpand("a\nb")).toBe(true);
  });
});
