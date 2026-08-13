import { describe, expect, it } from "vitest";
import {
  snapshotHeaderMatchesHistoryFilters,
  snapshotHistoryScopeOrFilter,
} from "@/lib/data/zd-estimate-order-snapshots";
import { listZdEstimateSupplierKhIds } from "@/lib/orders/zd-estimate-create-zd";
import {
  buildPairRatioByTwId,
  buildZdEstimateSnapshotLinesFromDoc,
  buildZdEstimateSnapshotLinesFromDocChecked,
  collectImplicitPieceSnapshotLines,
  confirmedEstimateTwIdsFromLineMeta,
  enrichSnapshotPackagingErrorMessage,
  resolveConfirmedEstimateTwIdsForLink,
  resolveSnapshotPackForTwId,
  twIdHasSnapshotPackagingSource,
} from "@/lib/orders/zd-estimate-snapshot-lines";
import type { SubiektDocument } from "@/lib/subiekt/types";

function doc(lines: Array<{ twId: number; qty: number }>): SubiektDocument {
  return {
    dok_Id: 1,
    dok_NrPelny: "ZD/1",
    dok_Pozycja: lines.map((l) => ({
      ob_TowId: l.twId,
      ob_Ilosc: l.qty,
      tw_Symbol: `S${l.twId}`,
      tw_Nazwa: `T${l.twId}`,
    })),
  } as SubiektDocument;
}

describe("listZdEstimateSupplierKhIds", () => {
  it("łączy primary + aliasy bez duplikatów", () => {
    expect(
      listZdEstimateSupplierKhIds({
        primaryKhId: 10,
        additionalKhIds: [20, 10, 30],
      }).sort((a, b) => a - b)
    ).toEqual([10, 20, 30]);
  });

  it("alias-only gdy brak primary", () => {
    expect(
      listZdEstimateSupplierKhIds({
        primaryKhId: null,
        additionalKhIds: [99],
      })
    ).toEqual([99]);
  });
});

describe("snapshotHistoryScopeOrFilter", () => {
  it("cecha: match XOR legacy null", () => {
    expect(snapshotHistoryScopeOrFilter({ mode: "cecha", cechaId: 5 })).toBe(
      "and(scope_mode.eq.cecha,cecha_id.eq.5),scope_mode.is.null"
    );
  });

  it("grupa: match XOR legacy null", () => {
    expect(snapshotHistoryScopeOrFilter({ mode: "grupa", grtId: 42 })).toBe(
      "and(scope_mode.eq.grupa,grt_id.eq.42),scope_mode.is.null"
    );
  });
});

describe("snapshotHeaderMatchesHistoryFilters", () => {
  const base = {
    supplierKhIds: [10, 11],
    scope: { mode: "cecha" as const, cechaId: 5 },
    hostKind: "orders_test" as const,
  };

  it("Ivoclar kh=10 OK; Falcon kh=20 brak", () => {
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 10,
          scope_mode: "cecha",
          cecha_id: 5,
          host_kind: "orders_test",
          eligible_for_history: true,
        },
        base
      )
    ).toBe(true);
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 20,
          scope_mode: "cecha",
          cecha_id: 5,
          host_kind: "orders_test",
          eligible_for_history: true,
        },
        base
      )
    ).toBe(false);
  });

  it("inna cecha (nowe scope) → brak cross-cut", () => {
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 10,
          scope_mode: "cecha",
          cecha_id: 9,
          host_kind: "orders_test",
        },
        base
      )
    ).toBe(false);
  });

  it("inna grupa (nowe scope) → brak cross-cut", () => {
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 10,
          scope_mode: "grupa",
          grt_id: 99,
          host_kind: "orders_test",
        },
        {
          supplierKhIds: [10],
          scope: { mode: "grupa", grtId: 7 },
          hostKind: "orders_test",
        }
      )
    ).toBe(false);
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 10,
          scope_mode: "grupa",
          grt_id: 7,
          host_kind: "orders_test",
        },
        {
          supplierKhIds: [10],
          scope: { mode: "grupa", grtId: 7 },
          hostKind: "orders_test",
        }
      )
    ).toBe(true);
  });

  it("legacy scope_mode NULL + ten sam kh → OK", () => {
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 10,
          scope_mode: null,
          cecha_id: null,
          host_kind: "orders_test",
        },
        base
      )
    ).toBe(true);
  });

  it("alias kh w filtrze odczytu", () => {
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 11,
          scope_mode: "cecha",
          cecha_id: 5,
          host_kind: "orders_test",
        },
        base
      )
    ).toBe(true);
  });

  it("status spełniony (eligible false) → brak", () => {
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 10,
          scope_mode: "cecha",
          cecha_id: 5,
          host_kind: "orders_test",
          eligible_for_history: false,
        },
        base
      )
    ).toBe(false);
  });

  it("inny host_kind → brak", () => {
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: 10,
          scope_mode: "cecha",
          cecha_id: 5,
          host_kind: "live",
        },
        base
      )
    ).toBe(false);
  });

  it("brak supplier_kh_id → ignoruj", () => {
    expect(
      snapshotHeaderMatchesHistoryFilters(
        {
          supplier_kh_id: null,
          scope_mode: "cecha",
          cecha_id: 5,
          host_kind: "orders_test",
        },
        base
      )
    ).toBe(false);
  });
});

describe("buildZdEstimateSnapshotLinesFromDoc requirePackaging", () => {
  it("packaging miss → błąd", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 1, qty: 2 }]),
      {
        packagingByTwId: new Map(),
        requirePackaging: true,
      }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Brak opakowania/);
  });

  it("pair ratio wystarczy bez opakowania", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 10, qty: 2 }]),
      {
        pairRatioByTwId: new Map([[10, 100]]),
        requirePackaging: true,
      }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines[0]?.qty).toBe(200);
    }
  });

  it("pozycja z szacunku bez opakowania — potwierdzone 1:1", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 1, qty: 3 }]),
      {
        packagingByTwId: new Map(),
        requirePackaging: true,
        confirmedEstimateTwIds: new Set([1]),
      }
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lines[0]?.qty).toBe(3);
  });

  it("pozycja spoza szacunku bez opakowania — błąd", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 99, qty: 2 }]),
      {
        packagingByTwId: new Map(),
        requirePackaging: true,
        confirmedEstimateTwIds: new Set([1]),
      }
    );
    expect(r.ok).toBe(false);
  });

  it("potwierdzone 1:1 — ratioAtLink = 1", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 1, qty: 4 }]),
      {
        requirePackaging: true,
        confirmedEstimateTwIds: new Set([1]),
      }
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lines[0]?.ratioAtLink).toBe(1);
  });

  it("opakowanie units=1 w DB — jawne 1:1", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 5, qty: 7 }]),
      {
        packagingByTwId: new Map([[5, 1]]),
        requirePackaging: true,
      }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines[0]?.qty).toBe(7);
      expect(r.lines[0]?.ratioAtLink).toBe(1);
    }
  });

  it("para pack — nie używa confirmed bypass", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 10, qty: 2 }]),
      {
        pairRatioByTwId: new Map([[10, 50]]),
        requirePackaging: true,
        confirmedEstimateTwIds: new Set([10]),
      }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines[0]?.qty).toBe(100);
      expect(r.lines[0]?.ratioAtLink).toBe(50);
    }
  });

  it("błąd zawiera symbol z dokumentu", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 42, qty: 1 }]),
      { requirePackaging: true }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("S42 (42)");
  });

  it("bez requirePackaging — cichy ×1 (legacy)", () => {
    const lines = buildZdEstimateSnapshotLinesFromDoc(
      doc([{ twId: 1, qty: 3 }]),
      {
        packagingByTwId: new Map(),
      }
    );
    expect(lines[0]?.qty).toBe(3);
  });
});

describe("buildPairRatioByTwId", () => {
  it("pack → unitsPerPack, piece → 1", () => {
    const map = buildPairRatioByTwId([
      { packTwId: 100, pieceTwId: 200, unitsPerPack: 25 },
    ]);
    expect(map.get(100)).toBe(25);
    expect(map.get(200)).toBe(1);
  });
});

describe("twIdHasSnapshotPackagingSource", () => {
  it("true dla pary i opakowania", () => {
    expect(
      twIdHasSnapshotPackagingSource(
        1,
        new Map([[2, 10]]),
        new Map([[1, 100]])
      )
    ).toBe(true);
    expect(
      twIdHasSnapshotPackagingSource(2, new Map([[2, 10]]), new Map())
    ).toBe(true);
    expect(
      twIdHasSnapshotPackagingSource(9, new Map(), new Map())
    ).toBe(false);
  });
});

describe("collectImplicitPieceSnapshotLines", () => {
  it("zwraca tylko linie bez źródła ratio", () => {
    const lines = collectImplicitPieceSnapshotLines(
      [
        { twId: 1, symbol: "A", nazwa: "Alpha" },
        { twId: 2, symbol: "B", nazwa: "Beta" },
      ],
      new Map([[2, 10]]),
      new Map([[3, 1]])
    );
    expect(lines.map((l) => l.twId)).toEqual([1]);
  });
});

describe("resolveConfirmedEstimateTwIdsForLink", () => {
  it("orderableTwIds ⊆ lineMeta", () => {
    const out = resolveConfirmedEstimateTwIdsForLink({
      orderableTwIds: [1, 2, 99],
      lineMeta: [{ twId: 1 }, { twId: 2, celAtLink: 5 }],
    });
    expect([...out].sort()).toEqual([1, 2]);
  });

  it("bez lineMeta → pusty (strict)", () => {
    expect(
      resolveConfirmedEstimateTwIdsForLink({
        orderableTwIds: [1],
        lineMeta: null,
      }).size
    ).toBe(0);
  });

  it("wykluczone w lineMeta ale nie w orderableTwIds → brak bypass", () => {
    const out = resolveConfirmedEstimateTwIdsForLink({
      orderableTwIds: [1],
      lineMeta: [{ twId: 1 }, { twId: 99 }],
    });
    expect([...out]).toEqual([1]);
  });
});

describe("confirmedEstimateTwIdsFromLineMeta", () => {
  it("deduplikuje tw_Id", () => {
    expect(
      [...confirmedEstimateTwIdsFromLineMeta([{ twId: 1 }, { twId: 1 }])]
    ).toEqual([1]);
  });
});

describe("resolveSnapshotPackForTwId", () => {
  const packaging = new Map([[5, 10]]);
  const pairs = new Map([[10, 100], [20, 1]]);

  it("para > opakowanie > confirmed > legacy", () => {
    expect(
      resolveSnapshotPackForTwId(10, {
        packagingByTwId: packaging,
        pairRatioByTwId: pairs,
        requirePackaging: true,
      })
    ).toEqual({ ok: true, ratio: 100, source: "pair" });
    expect(
      resolveSnapshotPackForTwId(5, {
        packagingByTwId: packaging,
        pairRatioByTwId: pairs,
        requirePackaging: true,
      })
    ).toEqual({ ok: true, ratio: 10, source: "packaging" });
    expect(
      resolveSnapshotPackForTwId(99, {
        packagingByTwId: packaging,
        pairRatioByTwId: pairs,
        confirmedEstimateTwIds: new Set([99]),
        requirePackaging: true,
      })
    ).toEqual({ ok: true, ratio: 1, source: "confirmed" });
    expect(
      resolveSnapshotPackForTwId(99, {
        packagingByTwId: packaging,
        pairRatioByTwId: pairs,
        requirePackaging: true,
      })
    ).toEqual({ ok: false });
  });
});

describe("snapshot workflow matrix (1028-style)", () => {
  const userTwIds = [1028, 4914, 4080];
  const packaging = new Map<number, number>();
  const pairs = buildPairRatioByTwId([]);

  it("Create: orderable bez opakowania → snapshot OK", () => {
    const subiektDoc = doc(
      userTwIds.map((twId) => ({ twId, qty: 2 }))
    );
    const orderable = new Set(userTwIds);
    const r = buildZdEstimateSnapshotLinesFromDocChecked(subiektDoc, {
      packagingByTwId: packaging,
      pairRatioByTwId: pairs,
      confirmedEstimateTwIds: orderable,
      requirePackaging: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines).toHaveLength(3);
      for (const line of r.lines) {
        expect(line.qty).toBe(2);
        expect(line.ratioAtLink).toBe(1);
      }
    }
  });

  it("preflight implicit = orderable bez źródła ratio", () => {
    const implicit = collectImplicitPieceSnapshotLines(
      userTwIds.map((twId) => ({
        twId,
        symbol: `S${twId}`,
        nazwa: `T${twId}`,
      })),
      packaging,
      pairs
    );
    expect(implicit.map((l) => l.twId).sort()).toEqual(userTwIds.sort());
  });

  it("Link bez orderableTwIds → fail", () => {
    const r = buildZdEstimateSnapshotLinesFromDocChecked(
      doc([{ twId: 1028, qty: 1 }]),
      {
        packagingByTwId: packaging,
        pairRatioByTwId: pairs,
        lineMeta: [{ twId: 1028 }],
        confirmedEstimateTwIds: new Set(),
        requirePackaging: true,
      }
    );
    expect(r.ok).toBe(false);
  });

  it("obca pozycja na dokumencie → enrich message", () => {
    const d = doc([
      { twId: 1028, qty: 1 },
      { twId: 9999, qty: 1 },
    ]);
    const r = buildZdEstimateSnapshotLinesFromDocChecked(d, {
      packagingByTwId: packaging,
      pairRatioByTwId: pairs,
      confirmedEstimateTwIds: new Set([1028]),
      requirePackaging: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const enriched = enrichSnapshotPackagingErrorMessage(
        r.message,
        d,
        new Set([1028])
      );
      expect(enriched).toMatch(/spoza bieżącej listy Do ZD/);
      expect(enriched).toMatch(/9999/);
    }
  });
});
