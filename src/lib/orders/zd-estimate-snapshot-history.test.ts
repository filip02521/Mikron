import { describe, expect, it } from "vitest";
import {
  snapshotHeaderMatchesHistoryFilters,
  snapshotHistoryScopeOrFilter,
} from "@/lib/data/zd-estimate-order-snapshots";
import { listZdEstimateSupplierKhIds } from "@/lib/orders/zd-estimate-create-zd";
import {
  buildZdEstimateSnapshotLinesFromDoc,
  buildZdEstimateSnapshotLinesFromDocChecked,
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
