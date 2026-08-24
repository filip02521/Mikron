import { describe, expect, it } from "vitest";
import {
  assessZkWatchAutoProsbaEligibility,
  buildClientAutoProsbaLines,
  buildServerAutoProsbaEntries,
  countAutoProsbaLineKeyGap,
  deriveAutoProsbaSubmitMode,
  mapAutoProsbaLinesToEntries,
  resolveAutoProsbaLineKeys,
  resolveAutoProsbaResultCodeAfterSubmit,
} from "./zk-watch-auto-prosba";
import type { SalesZkWatch } from "@/types/database";
import type { ZkWatchOrderHints } from "./zk-watch-order-link";
import type { TeethDraftRegistryLookup } from "./zk-watch-teeth-draft";

const baseWatch = {
  id: "w1",
  sales_person_id: "sp1",
  client_label: "Klinika Test",
  client_kh_id: 1,
  zk_number: "ZK/1/2026",
  note: "Notatka sprawy",
  line_checks: [
    { key: "ob:1", needs_prosba: true, arrived: false },
    { key: "ob:2", needs_prosba: false, arrived: false },
    { key: "ob:3", needs_prosba: true, arrived: false },
  ],
  subiekt_snapshot: {
    dok_Pozycja: [
      { ob_Id: 1, tw_Nazwa: "A", tw_Symbol: "A-1", ob_Ilosc: 1, ob_TowId: 10 },
      { ob_Id: 2, tw_Nazwa: "B", tw_Symbol: "B-1", ob_Ilosc: 1, ob_TowId: 11 },
      { ob_Id: 3, tw_Nazwa: "C", tw_Symbol: "C-1", ob_Ilosc: 1, ob_TowId: 12 },
    ],
  },
} as unknown as SalesZkWatch;

const baseHints: ZkWatchOrderHints = {
  matchingOpenRequestCount: 0,
  matchingOpenRequestIds: [],
  matchedDeliveredLineKeys: [],
  allLinesMatchedByOrders: false,
  lineCoverageByKey: {},
  uncoveredLineKeys: ["ob:1", "ob:3"],
  openProsbaCoveredLineKeys: [],
  prosbaScopeConfigured: true,
  inStockLineKeys: [],
  regalWaitingLineKeys: [],
  informacjaReadyLineKeys: [],
  informacjaAcknowledgedLineKeys: [],
  scopeExcludedLineKeys: ["ob:2"],
};

const emptyRegistry: TeethDraftRegistryLookup = {
  twIds: new Set<number>(),
  manufacturerByTwId: new Map(),
  productLineByTwId: new Map(),
  kindByTwId: new Map(),
  catalogAvailable: true,
};

describe("resolveAutoProsbaLineKeys", () => {
  it("zwraca uncovered ∩ scope", () => {
    expect(resolveAutoProsbaLineKeys(baseWatch, baseHints)).toEqual(["ob:1", "ob:3"]);
  });

  it("pomija pozycje poza uncovered", () => {
    const hints = { ...baseHints, uncoveredLineKeys: ["ob:1"] };
    expect(resolveAutoProsbaLineKeys(baseWatch, hints)).toEqual(["ob:1"]);
  });

  it("zwraca [] gdy brak skonfigurowanego scope", () => {
    const watch = {
      ...baseWatch,
      line_checks: [{ key: "ob:1", arrived: false }],
    } as unknown as SalesZkWatch;
    expect(resolveAutoProsbaLineKeys(watch, baseHints)).toEqual([]);
  });

  it("nie zwraca więcej niż scope", () => {
    const hints = { ...baseHints, uncoveredLineKeys: ["ob:1", "ob:2", "ob:3", "ob:99"] };
    expect(resolveAutoProsbaLineKeys(baseWatch, hints)).toEqual(["ob:1", "ob:3"]);
  });
});

describe("assessZkWatchAutoProsbaEligibility", () => {
  it("blocked_watch_closed gdy ZK zamknięte", () => {
    const watch = { ...baseWatch, closed_at: new Date().toISOString() };
    expect(
      assessZkWatchAutoProsbaEligibility({ watch, hints: baseHints, teethRegistry: emptyRegistry })
    ).toEqual({ ok: false, code: "blocked_watch_closed" });
  });

  it("blocked_no_scope gdy brak needs_prosba", () => {
    const watch = {
      ...baseWatch,
      line_checks: [{ key: "ob:1", arrived: false }],
    } as unknown as SalesZkWatch;
    expect(
      assessZkWatchAutoProsbaEligibility({ watch, hints: baseHints, teethRegistry: emptyRegistry })
    ).toEqual({ ok: false, code: "blocked_no_scope" });
  });

  it("redirect_open_prosba gdy brak uncovered ale jest otwarta prośba", () => {
    const hints = {
      ...baseHints,
      uncoveredLineKeys: [],
      matchingOpenRequestCount: 1,
      matchingOpenRequestIds: ["o1"],
    };
    expect(
      assessZkWatchAutoProsbaEligibility({ watch: baseWatch, hints, teethRegistry: emptyRegistry })
    ).toEqual({ ok: false, code: "redirect_open_prosba" });
  });

  it("skipped_already_covered gdy brak uncovered i brak otwartej prośby", () => {
    const hints = { ...baseHints, uncoveredLineKeys: [] };
    expect(
      assessZkWatchAutoProsbaEligibility({ watch: baseWatch, hints, teethRegistry: emptyRegistry })
    ).toEqual({ ok: false, code: "skipped_already_covered" });
  });

  it("blocked_batch_size gdy za dużo linii", () => {
    const manyKeys = Array.from({ length: 31 }, (_, i) => `ob:${i + 1}`);
    const watch = {
      ...baseWatch,
      line_checks: manyKeys.map((key) => ({ key, needs_prosba: true, arrived: false })),
      subiekt_snapshot: {
        dok_Pozycja: manyKeys.map((key, i) => ({
          ob_Id: i + 1,
          tw_Nazwa: `P${i}`,
          tw_Symbol: `S${i}`,
          ob_Ilosc: 1,
          ob_TowId: 100 + i,
        })),
      },
    } as unknown as SalesZkWatch;
    const hints = { ...baseHints, uncoveredLineKeys: manyKeys };
    expect(
      assessZkWatchAutoProsbaEligibility({ watch, hints, teethRegistry: emptyRegistry })
    ).toEqual({ ok: false, code: "blocked_batch_size" });
  });

  it("blocked_teeth_catalog gdy katalog niedostępny", () => {
    expect(
      assessZkWatchAutoProsbaEligibility({
        watch: baseWatch,
        hints: baseHints,
        teethRegistry: { ...emptyRegistry, catalogAvailable: false },
      })
    ).toEqual({ ok: false, code: "blocked_teeth_catalog" });
  });

  it("ok gdy wszystkie warunki spełnione", () => {
    expect(
      assessZkWatchAutoProsbaEligibility({
        watch: baseWatch,
        hints: baseHints,
        teethRegistry: emptyRegistry,
      })
    ).toEqual({ ok: true, lineKeys: ["ob:1", "ob:3"] });
  });
});

describe("buildClientAutoProsbaLines", () => {
  it("buduje linie dla effective keys", () => {
    const built = buildClientAutoProsbaLines({
      watch: baseWatch,
      hints: baseHints,
      teethRegistry: emptyRegistry,
    });
    expect(built.lineKeys).toEqual(["ob:1", "ob:3"]);
    expect(built.lines).toHaveLength(2);
    expect(built.lines[0]?.product).toBe("A");
    expect(built.blocked).toBeUndefined();
  });

  it("redirect_open_prosba gdy brak effective keys i jest otwarta prośba", () => {
    const hints = {
      ...baseHints,
      uncoveredLineKeys: [],
      matchingOpenRequestCount: 1,
    };
    const built = buildClientAutoProsbaLines({
      watch: baseWatch,
      hints,
      teethRegistry: emptyRegistry,
    });
    expect(built.blocked).toBe("redirect_open_prosba");
    expect(built.lines).toHaveLength(0);
  });

  it("skipped_already_covered gdy brak effective keys", () => {
    const hints = { ...baseHints, uncoveredLineKeys: [] };
    const built = buildClientAutoProsbaLines({
      watch: baseWatch,
      hints,
      teethRegistry: emptyRegistry,
    });
    expect(built.blocked).toBe("skipped_already_covered");
  });

  it("teeth_incomplete gdy brak draftów zębów w scope", () => {
    const teethTwId = 500;
    const watch = {
      ...baseWatch,
      line_checks: [{ key: "ob:1", needs_prosba: true, arrived: false }],
      subiekt_snapshot: {
        dok_Pozycja: [
          {
            ob_Id: 1,
            tw_Nazwa: "Zęby A",
            tw_Symbol: "Z-1",
            ob_Ilosc: 1,
            ob_TowId: teethTwId,
          },
        ],
      },
      teeth_drafts: {},
    } as unknown as SalesZkWatch;
    const hints = { ...baseHints, uncoveredLineKeys: ["ob:1"] };
    const registry: TeethDraftRegistryLookup = {
      twIds: new Set([teethTwId]),
      manufacturerByTwId: new Map([[teethTwId, "ivoclar"]]),
      productLineByTwId: new Map([[teethTwId, "ivoclar_phonares_ii"]]),
      kindByTwId: new Map([[teethTwId, "anterior"]]),
      catalogAvailable: true,
    };
    const built = buildClientAutoProsbaLines({ watch, hints, teethRegistry: registry });
    expect(built.blocked).toBe("teeth_incomplete");
  });

  it("uwzględnia stockByTwId z modala", () => {
    const built = buildClientAutoProsbaLines({
      watch: baseWatch,
      hints: baseHints,
      teethRegistry: emptyRegistry,
      stockByTwId: {
        10: { onHand: 5, reserved: 1, available: 4, source: "subiekt" },
      },
    });
    const line10 = built.lines.find((line) => line.subiektTwId === 10);
    expect(line10?.available).toBe(4);
    expect(line10?.onHand).toBe(5);
  });
});

describe("buildServerAutoProsbaEntries", () => {
  it("mapuje entries z requestKind zamowienie i source ZK", () => {
    const entries = buildServerAutoProsbaEntries({
      watch: baseWatch,
      lineKeys: ["ob:1"],
      teethRegistry: emptyRegistry,
      stockByTwId: {},
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      salesPersonId: "sp1",
      requestKind: "zamowienie",
      sourceZkWatchId: "w1",
      sourceZkNumber: "ZK/1/2026",
      sourceZkLineKeys: ["ob:1"],
      clientName: "Klinika Test",
      clientKhId: 1,
    });
  });
});

describe("mapAutoProsbaLinesToEntries", () => {
  it("kopiuje pola linii i metadane ZK", () => {
    const entries = mapAutoProsbaLinesToEntries(
      baseWatch,
      [
        {
          id: "l1",
          symbol: "A-1",
          mikranCode: "",
          product: "A",
          quantity: "1",
          clientName: "Klinika Test",
          clientKhId: 1,
          subiektTwId: 10,
        },
      ],
      ["ob:1"]
    );
    expect(entries[0]?.symbol).toBe("A-1");
    expect(entries[0]?.sourceZkLineKeys).toEqual(["ob:1"]);
  });
});

describe("deriveAutoProsbaSubmitMode", () => {
  it("supplement gdy matching open", () => {
    expect(
      deriveAutoProsbaSubmitMode({ ...baseHints, matchingOpenRequestCount: 1 }, ["ob:1"])
    ).toBe("supplement");
  });

  it("supplement gdy openProsbaCoveredLineKeys niepuste", () => {
    expect(
      deriveAutoProsbaSubmitMode(
        { ...baseHints, openProsbaCoveredLineKeys: ["ob:99"] },
        ["ob:1"]
      )
    ).toBe("supplement");
  });

  it("new gdy brak otwartej prośby", () => {
    expect(deriveAutoProsbaSubmitMode(baseHints, ["ob:1"])).toBe("new");
  });
});

describe("countAutoProsbaLineKeyGap", () => {
  it("liczy skipped", () => {
    expect(countAutoProsbaLineKeyGap({ selectedScopeCount: 3, effectiveLineCount: 2 })).toEqual({
      selected: 3,
      effective: 2,
      skipped: 1,
    });
  });

  it("skipped nieujemny", () => {
    expect(
      countAutoProsbaLineKeyGap({ selectedScopeCount: 2, effectiveLineCount: 3 }).skipped
    ).toBe(0);
  });
});

describe("resolveAutoProsbaResultCodeAfterSubmit", () => {
  it("created_with_skipped_lines gdy selected > effective i coś dodano", () => {
    expect(
      resolveAutoProsbaResultCodeAfterSubmit({
        hints: baseHints,
        lineKeys: ["ob:1"],
        selectedScopeCount: 3,
        complete: 1,
        verification: 0,
      })
    ).toBe("created_with_skipped_lines");
  });

  it("created_partial_verification gdy verification > 0", () => {
    expect(
      resolveAutoProsbaResultCodeAfterSubmit({
        hints: baseHints,
        lineKeys: ["ob:1", "ob:3"],
        complete: 1,
        verification: 1,
      })
    ).toBe("created_partial_verification");
  });

  it("created_supplement gdy supplement mode", () => {
    expect(
      resolveAutoProsbaResultCodeAfterSubmit({
        hints: { ...baseHints, matchingOpenRequestCount: 1 },
        lineKeys: ["ob:1"],
        complete: 1,
        verification: 0,
      })
    ).toBe("created_supplement");
  });

  it("created domyślnie", () => {
    expect(
      resolveAutoProsbaResultCodeAfterSubmit({
        hints: baseHints,
        lineKeys: ["ob:1"],
        complete: 1,
        verification: 0,
      })
    ).toBe("created");
  });

  it("nie zwraca skipped_lines gdy nic nie dodano", () => {
    expect(
      resolveAutoProsbaResultCodeAfterSubmit({
        hints: baseHints,
        lineKeys: ["ob:1"],
        selectedScopeCount: 3,
        complete: 0,
        verification: 0,
      })
    ).toBe("created");
  });
});
