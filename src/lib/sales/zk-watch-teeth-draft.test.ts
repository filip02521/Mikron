import { describe, expect, it } from "vitest";
import {
  applyZkTeethDraftToProductLine,
  buildZkTeethDraftFromInput,
  clearZkTeethDraftsForKeys,
  collectZkTeethLineCandidates,
  isZkTeethDraftComplete,
  mergeZkTeethDraftsAfterRefresh,
  parseZkTeethDrafts,
  teethDraftKeysExcludedFromScope,
  zkWatchIncompleteTeethLineKeys,
  zkWatchTeethDraftsReady,
  type TeethDraftRegistryLookup,
  type ZkTeethLineDraft,
} from "./zk-watch-teeth-draft";
import type { SalesZkWatch } from "@/types/database";

const registry: TeethDraftRegistryLookup = {
  twIds: new Set([101, 102, 99]),
  manufacturerByTwId: new Map([
    [101, "ivoclar"],
    [102, "ivoclar"],
    [99, "wiedent"],
  ]),
  productLineByTwId: new Map([
    [101, "ivoclar_phonares_ii"],
    [102, "ivoclar_phonares_ii"],
    [99, "wiedent_classic"],
  ]),
  kindByTwId: new Map([
    [101, "anterior"],
    [102, "posterior"],
    [99, "anterior"],
  ]),
};

function watchWithLines(
  lines: Array<{
    ob_Id: number;
    ob_TowId: number;
    tw_Nazwa: string;
    tw_Symbol?: string;
    ob_Ilosc: number;
  }>,
  checks: unknown,
  teeth_drafts?: unknown
): SalesZkWatch {
  return {
    id: "w1",
    sales_person_id: "sp1",
    subiekt_dok_id: 1,
    zk_number: "ZK/2026/1",
    client_label: "Klient",
    client_kh_id: 1,
    amount_net: null,
    amount_gross: null,
    zk_issued_at: null,
    note: null,
    line_summary: null,
    subiekt_snapshot: { dok_Pozycja: lines },
    line_checks: checks,
    teeth_drafts,
    follow_up_at: null,
    closed_at: null,
    archived_at: null,
    created_at: "",
    updated_at: "",
  };
}

function completeAnteriorDraft(
  overrides?: Partial<{
    lineKey: string;
    subiektTwId: number;
    teethKind: "anterior" | "posterior";
    expectedQuantity: number;
  }>
): ZkTeethLineDraft {
  const kind = overrides?.teethKind ?? "anterior";
  const qty = overrides?.expectedQuantity ?? 2;
  return buildZkTeethDraftFromInput({
    lineKey: overrides?.lineKey ?? "ob:1",
    subiektTwId: overrides?.subiektTwId ?? (kind === "posterior" ? 102 : 101),
    teethManufacturer: "ivoclar",
    teethProductLine: "ivoclar_phonares_ii",
    teethKind: kind,
    expectedQuantity: qty,
    teethDetails: Array.from({ length: qty }, (_, i) => ({
      position: i + 1,
      color: "A2",
      mould: kind === "posterior" ? "N5U" : "S42",
      jaw: kind === "posterior" ? ("upper" as const) : undefined,
      kind,
    })),
  });
}

describe("zk-watch-teeth-draft", () => {
  it("collectZkTeethLineCandidates — tylko needs_prosba i twId z rejestru", () => {
    const watch = watchWithLines(
      [
        { ob_Id: 1, ob_TowId: 101, tw_Nazwa: "Phonares przednie", ob_Ilosc: 2 },
        { ob_Id: 2, ob_TowId: 55, tw_Nazwa: "Filtr", ob_Ilosc: 1 },
        { ob_Id: 3, ob_TowId: 102, tw_Nazwa: "Phonares boczne", ob_Ilosc: 4 },
      ],
      [
        { key: "ob:1", arrived: false, needs_prosba: true },
        { key: "ob:2", arrived: false, needs_prosba: true },
        { key: "ob:3", arrived: false, needs_prosba: false },
      ]
    );
    const candidates = collectZkTeethLineCandidates(watch, registry);
    expect(candidates.map((c) => c.lineKey)).toEqual(["ob:1"]);
    expect(candidates[0]?.teethKind).toBe("anterior");
  });

  it("rozróżnia przednie i boczne jako osobne kandydaty", () => {
    const watch = watchWithLines(
      [
        { ob_Id: 1, ob_TowId: 101, tw_Nazwa: "Phonares przednie", ob_Ilosc: 2 },
        { ob_Id: 2, ob_TowId: 102, tw_Nazwa: "Phonares boczne", ob_Ilosc: 4 },
      ],
      [
        { key: "ob:1", arrived: false, needs_prosba: true },
        { key: "ob:2", arrived: false, needs_prosba: true },
      ]
    );
    const candidates = collectZkTeethLineCandidates(watch, registry);
    expect(candidates).toHaveLength(2);
    expect(candidates.find((c) => c.lineKey === "ob:1")?.teethKind).toBe("anterior");
    expect(candidates.find((c) => c.lineKey === "ob:2")?.teethKind).toBe("posterior");
    expect(candidates.find((c) => c.lineKey === "ob:1")?.subiektTwId).toBe(101);
    expect(candidates.find((c) => c.lineKey === "ob:2")?.subiektTwId).toBe(102);
  });

  it("zkWatchTeethDraftsReady — incomplete bez draftu; ready po kompletnym", () => {
    const watch = watchWithLines(
      [{ ob_Id: 1, ob_TowId: 101, tw_Nazwa: "Phonares przednie", ob_Ilosc: 2 }],
      [{ key: "ob:1", arrived: false, needs_prosba: true }]
    );
    expect(zkWatchTeethDraftsReady(watch, registry)).toBe(false);
    expect(zkWatchIncompleteTeethLineKeys(watch, registry)).toEqual(["ob:1"]);

    const withDraft = {
      ...watch,
      teeth_drafts: { "ob:1": completeAnteriorDraft() },
    };
    expect(zkWatchTeethDraftsReady(withDraft, registry)).toBe(true);
  });

  it("informacja nie wymaga draftów", () => {
    const watch = watchWithLines(
      [{ ob_Id: 1, ob_TowId: 101, tw_Nazwa: "Phonares przednie", ob_Ilosc: 2 }],
      [{ key: "ob:1", arrived: false, needs_prosba: true }]
    );
    expect(
      zkWatchTeethDraftsReady(watch, registry, { requestKind: "informacja" })
    ).toBe(true);
  });

  it("catalogAvailable=false → fail-closed (nie ready)", () => {
    const watch = watchWithLines(
      [{ ob_Id: 1, ob_TowId: 101, tw_Nazwa: "Phonares przednie", ob_Ilosc: 2 }],
      [{ key: "ob:1", arrived: false, needs_prosba: true }]
    );
    const unavailable: TeethDraftRegistryLookup = {
      twIds: new Set(),
      manufacturerByTwId: new Map(),
      productLineByTwId: new Map(),
      kindByTwId: new Map(),
      catalogAvailable: false,
    };
    expect(zkWatchTeethDraftsReady(watch, unavailable)).toBe(false);
    expect(zkWatchIncompleteTeethLineKeys(watch, unavailable).length).toBeGreaterThan(0);
  });

  it("pusty katalog (available) bez kandydatów → ready", () => {
    const watch = watchWithLines(
      [{ ob_Id: 1, ob_TowId: 55, tw_Nazwa: "Filtr", ob_Ilosc: 1 }],
      [{ key: "ob:1", arrived: false, needs_prosba: true }]
    );
    const emptyOk: TeethDraftRegistryLookup = {
      twIds: new Set(),
      manufacturerByTwId: new Map(),
      productLineByTwId: new Map(),
      kindByTwId: new Map(),
      catalogAvailable: true,
    };
    expect(zkWatchTeethDraftsReady(watch, emptyOk)).toBe(true);
  });

  it("qty mismatch → incomplete", () => {
    const draft = completeAnteriorDraft({ expectedQuantity: 2 });
    expect(isZkTeethDraftComplete(draft, 3)).toBe(false);
    expect(isZkTeethDraftComplete(draft, 2)).toBe(true);
  });

  it("mergeZkTeethDraftsAfterRefresh usuwa osierocone i aktualizuje qty", () => {
    const prev = {
      "ob:1": completeAnteriorDraft(),
      "ob:9": completeAnteriorDraft({ lineKey: "ob:9" }),
    };
    const nextViews = [
      {
        key: "ob:1",
        product: "Phonares",
        symbol: null,
        quantityLabel: "3 szt.",
        quantity: 3,
        subiektTwId: 101,
        arrived: false,
        shelf_marked: false,
        completed_manually: false,
      },
    ];
    const merged = mergeZkTeethDraftsAfterRefresh(prev, nextViews, {
      addedLineKeys: [],
      removedLineKeys: ["ob:9"],
      quantityChanged: [{ key: "ob:1", from: 2, to: 3 }],
    });
    expect(merged["ob:9"]).toBeUndefined();
    expect(merged["ob:1"]?.expectedQuantity).toBe(3);
    expect(merged["ob:1"]?.teethDetails).toHaveLength(2);
  });

  it("clearZkTeethDraftsForKeys i scope exclude", () => {
    const drafts = {
      "ob:1": completeAnteriorDraft(),
      "ob:2": completeAnteriorDraft({
        lineKey: "ob:2",
        subiektTwId: 102,
        teethKind: "posterior",
      }),
    };
    expect(Object.keys(clearZkTeethDraftsForKeys(drafts, ["ob:1"]))).toEqual([
      "ob:2",
    ]);
    const watch = watchWithLines(
      [
        { ob_Id: 1, ob_TowId: 101, tw_Nazwa: "A", ob_Ilosc: 2 },
        { ob_Id: 2, ob_TowId: 102, tw_Nazwa: "B", ob_Ilosc: 2 },
      ],
      [
        { key: "ob:1", arrived: false, needs_prosba: false },
        { key: "ob:2", arrived: false, needs_prosba: true },
      ],
      drafts
    );
    expect(teethDraftKeysExcludedFromScope(watch)).toEqual(["ob:1"]);
  });

  it("applyZkTeethDraftToProductLine przenosi kind i details", () => {
    const draft = completeAnteriorDraft();
    const line = applyZkTeethDraftToProductLine(
      {
        id: "x",
        symbol: "",
        mikranCode: "",
        product: "Phonares",
        quantity: "1",
        subiektTwId: 101,
      },
      draft
    );
    expect(line.teethKind).toBe("anterior");
    expect(line.teethProductLine).toBe("ivoclar_phonares_ii");
    expect(line.teethDetails).toHaveLength(2);
    expect(line.quantity).toBe("2");
  });

  it("parseZkTeethDrafts odrzuca niepoprawne wpisy", () => {
    expect(parseZkTeethDrafts(null)).toEqual({});
    expect(parseZkTeethDrafts({ "ob:1": { subiektTwId: 1 } })).toEqual({});
    const ok = parseZkTeethDrafts({
      "ob:1": completeAnteriorDraft(),
    });
    expect(ok["ob:1"]?.teethKind).toBe("anterior");
  });
});
