import { describe, expect, it } from "vitest";
import {
  countZdEtaMojeClientSyncTriggers,
  countZdEtaSyncTriggers,
  hasPersistedZdFulfillment,
  isZdEtaOverdueCandidate,
  needsZdEtaSync,
  selectZdEtaSyncCandidates,
  shouldMarkMojeZdEtaSessionDone,
  shouldRetryMojeZdEtaSync,
  zdDocumentMatchesSupplierKhIds,
  zdEtaSyncLockKey,
  zdFulfillmentPersistOnMissAction,
  ZD_ETA_GLOBAL_ORDER_SCAN_MAX,
  ZD_ETA_GLOBAL_ORDER_SCAN_PAGE,
  ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS,
  ZD_ETA_SYNC_MISS_TTL_MS,
  ZD_ETA_SYNC_TTL_MS,
} from "./zd-eta-sync";
import type { IndividualOrder } from "@/types/database";

function baseOrder(overrides: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "o1",
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "A",
    products: "Prod",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-01-02T10:00:00+01:00",
    ordered_at: "2026-01-02T10:00:00+01:00",
    delivery_at: null,
    supplier: {
      id: "s1",
      name: "Dostawca",
      stats_mode: "LACZNIE",
    } as IndividualOrder["supplier"],
    ...overrides,
  };
}

const stats = {
  supplier_id: "s1",
  main_sum: 50,
  main_avg: 5,
  main_count: 10,
  side_sum: 6,
  side_avg: 3,
  side_count: 2,
} as const;

describe("isZdEtaOverdueCandidate", () => {
  it("rozpoznaje opóźnione zamówienie z ETA statystycznym", () => {
    expect(isZdEtaOverdueCandidate(baseOrder(), stats, "LACZNIE")).toBe(true);
    expect(
      isZdEtaOverdueCandidate(baseOrder({ request_kind: "informacja" }), stats, "LACZNIE")
    ).toBe(false);
  });

  it("kwalifikuje częściowo zrealizowane z resztą do dostawy", () => {
    const freshStats = {
      ...stats,
      main_sum: 5,
      main_avg: 5,
      main_count: 1,
    };
    expect(
      isZdEtaOverdueCandidate(
        baseOrder({
          status: "Czesciowo_zrealizowane",
          quantity: "10",
          delivered_quantity: "3",
          ordered_at: new Date().toISOString(),
          action_at: new Date().toISOString(),
        }),
        freshStats,
        "LACZNIE"
      )
    ).toBe(true);
  });

  it("kwalifikuje po minionym terminie z zapisanego ZD", () => {
    const freshStats = {
      ...stats,
      main_sum: 5,
      main_avg: 5,
      main_count: 1,
    };
    expect(
      isZdEtaOverdueCandidate(
        baseOrder({
          ordered_at: new Date().toISOString(),
          action_at: new Date().toISOString(),
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-01-01",
        }),
        freshStats,
        "LACZNIE"
      )
    ).toBe(true);
  });
});

describe("zdEtaSyncLockKey", () => {
  it("używa osobnego klucza pomocniczego dla handlowca", () => {
    expect(zdEtaSyncLockKey()).toBe("job_zd_eta_sync");
    expect(zdEtaSyncLockKey("sp1")).toBe("job_zd_eta_sync:sp:sp1");
  });

  it("ma limit czasu klienta powyżej budżetu serwera /moje", () => {
    expect(ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS).toBeGreaterThan(15_000);
  });

  it("globalny backup skanuje zamówienia stronicowo", () => {
    expect(ZD_ETA_GLOBAL_ORDER_SCAN_PAGE).toBeGreaterThan(0);
    expect(ZD_ETA_GLOBAL_ORDER_SCAN_MAX).toBeGreaterThan(ZD_ETA_GLOBAL_ORDER_SCAN_PAGE);
  });
});

describe("needsZdEtaSync", () => {
  it("wymaga sync gdy ETA statystyczne minęło i brak wcześniejszej synchronizacji", () => {
    const now = new Date("2026-06-18T12:00:00+02:00").getTime();
    expect(
      needsZdEtaSync(baseOrder(), stats, "LACZNIE", now)
    ).toBe(true);
  });

  it("ponawia sync przy force nawet gdy synced_at świeże", () => {
    const now = new Date("2026-06-18T12:00:00+02:00").getTime();
    expect(
      needsZdEtaSync(
        baseOrder({
          zd_fulfillment_synced_at: new Date(now - 60_000).toISOString(),
        }),
        stats,
        "LACZNIE",
        now,
        true
      )
    ).toBe(true);
  });

  it("pomija gdy synchronizacja świeża (TTL)", () => {
    const now = new Date("2026-06-18T12:00:00+02:00").getTime();
    expect(
      needsZdEtaSync(
        baseOrder({
          zd_fulfillment_source: "zd",
          zd_fulfillment_synced_at: new Date(
            now - ZD_ETA_SYNC_TTL_MS + 60_000
          ).toISOString(),
        }),
        stats,
        "LACZNIE",
        now
      )
    ).toBe(false);
  });

  it("ponawia sync szybciej gdy ostatnio nie znaleziono ZD", () => {
    const now = new Date("2026-06-18T12:00:00+02:00").getTime();
    expect(
      needsZdEtaSync(
        baseOrder({
          zd_fulfillment_synced_at: new Date(
            now - ZD_ETA_SYNC_MISS_TTL_MS - 60_000
          ).toISOString(),
        }),
        stats,
        "LACZNIE",
        now
      )
    ).toBe(true);
    expect(
      needsZdEtaSync(
        baseOrder({
          zd_fulfillment_synced_at: new Date(
            now - ZD_ETA_SYNC_MISS_TTL_MS + 60_000
          ).toISOString(),
        }),
        stats,
        "LACZNIE",
        now
      )
    ).toBe(false);
  });

  it("pomija informacje i statusy bez ETA", () => {
    const now = Date.now();
    expect(
      needsZdEtaSync(
        baseOrder({ request_kind: "informacja" }),
        stats,
        "LACZNIE",
        now
      )
    ).toBe(false);
    expect(
      needsZdEtaSync(baseOrder({ status: "Nowe" }), stats, "LACZNIE", now)
    ).toBe(false);
  });
});

describe("hasPersistedZdFulfillment", () => {
  it("rozpoznaje zapisany termin z ZD", () => {
    expect(
      hasPersistedZdFulfillment({
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: "2026-07-03",
      })
    ).toBe(true);
    expect(
      hasPersistedZdFulfillment({
        zd_fulfillment_source: null,
        zd_fulfillment_deadline: "2026-07-03",
      })
    ).toBe(false);
  });
});

describe("selectZdEtaSyncCandidates", () => {
  it("ogranicza liczbę kandydatów i sortuje po dacie zamówienia", () => {
    const now = new Date("2026-06-18T12:00:00+02:00").getTime();
    const supplier = {
      id: "s1",
      subiektKhId: 1,
      additionalSubiektKhIds: [],
    } as import("@/lib/data/supplier-refs").AppSupplierRef;
    const supplierById = new Map([["s1", supplier]]);
    const statsMap = { s1: stats };

    const selected = selectZdEtaSyncCandidates(
      [
        baseOrder({ id: "late", ordered_at: "2026-01-10T10:00:00+01:00" }),
        baseOrder({ id: "early", ordered_at: "2026-01-02T10:00:00+01:00" }),
      ],
      statsMap,
      supplierById,
      now,
      { maxOrders: 1 }
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe("early");
  });
});

describe("zdFulfillmentPersistOnMissAction", () => {
  it("przy force czyści nieaktualny termin ZD po pełnym przeszukaniu", () => {
    expect(zdFulfillmentPersistOnMissAction(true, true)).toBe("clear");
  });

  it("przy force nie czyści terminu gdy sync przerwany (offline / timeout)", () => {
    expect(zdFulfillmentPersistOnMissAction(true, true, { subiektOffline: true })).toBe(
      "touch"
    );
    expect(zdFulfillmentPersistOnMissAction(true, true, { searchIncomplete: true })).toBe(
      "touch"
    );
  });

  it("przy backupie zachowuje termin i tylko odświeża synced_at", () => {
    expect(zdFulfillmentPersistOnMissAction(false, true)).toBe("touch");
  });

  it("bez wcześniejszego terminu zapisuje brak dopasowania", () => {
    expect(zdFulfillmentPersistOnMissAction(false, false)).toBe("clear");
  });
});

describe("shouldMarkMojeZdEtaSessionDone", () => {
  it("nie kończy sesji przy częściowym offline lub timeout", () => {
    expect(
      shouldMarkMojeZdEtaSessionDone({
        candidates: 5,
        processed: 2,
        subiektOffline: true,
      })
    ).toBe(false);
    expect(
      shouldMarkMojeZdEtaSessionDone({
        candidates: 5,
        processed: 2,
        timedOut: true,
      })
    ).toBe(false);
  });

  it("kończy sesję gdy wszystkie kandydaty przetworzone", () => {
    expect(
      shouldMarkMojeZdEtaSessionDone({
        candidates: 3,
        processed: 3,
      })
    ).toBe(true);
  });
});

describe("shouldRetryMojeZdEtaSync", () => {
  it("ponawia przy częściowym wyniku do limitu", () => {
    expect(
      shouldRetryMojeZdEtaSync(
        { candidates: 4, processed: 1, timedOut: true },
        0,
        2
      )
    ).toBe(true);
    expect(
      shouldRetryMojeZdEtaSync(
        { candidates: 4, processed: 1, timedOut: true },
        2,
        2
      )
    ).toBe(false);
  });
});

describe("zdDocumentMatchesSupplierKhIds", () => {
  it("akceptuje dokument z kh_Id dostawcy", () => {
    expect(
      zdDocumentMatchesSupplierKhIds({ dok_DostawcaId: 9001, dok_Pozycja: [] }, [9001, 9002])
    ).toBe(true);
  });

  it("odrzuca dokument innego kontrahenta", () => {
    expect(
      zdDocumentMatchesSupplierKhIds({ dok_DostawcaId: 7777, dok_Pozycja: [] }, [9001])
    ).toBe(false);
  });

  it("odrzuca dopasowanie przy pustym zbiorze kh_Id", () => {
    expect(
      zdDocumentMatchesSupplierKhIds({ dok_DostawcaId: 9001, dok_Pozycja: [] }, [])
    ).toBe(false);
  });
});

describe("countZdEtaMojeClientSyncTriggers", () => {
  const supplier = {
    id: "s1",
    subiektKhId: 1,
    additionalSubiektKhIds: [],
  } as import("@/lib/data/supplier-refs").AppSupplierRef;

  it("nie liczy ponownie w krótkim TTL miss (spójnie z cronem)", () => {
    const orders = [
      baseOrder({
        zd_fulfillment_synced_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    ];
    expect(countZdEtaSyncTriggers(orders, [stats])).toBe(0);
    expect(countZdEtaMojeClientSyncTriggers(orders, [stats], [supplier])).toBe(
      0
    );
  });

  it("liczy ponownie po upływie TTL miss", () => {
    const orders = [
      baseOrder({
        zd_fulfillment_synced_at: new Date(
          Date.now() - ZD_ETA_SYNC_MISS_TTL_MS - 60_000
        ).toISOString(),
      }),
    ];
    expect(countZdEtaMojeClientSyncTriggers(orders, [stats], [supplier])).toBe(
      1
    );
  });

  it("pomija pozycje ze świeżą synchronizacją ZD (TTL)", () => {
    const orders = [
      baseOrder({
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: "2026-07-01",
        zd_fulfillment_dok_nr: "ZD/1",
        zd_fulfillment_synced_at: new Date().toISOString(),
      }),
    ];
    expect(countZdEtaMojeClientSyncTriggers(orders, [stats], [supplier])).toBe(
      0
    );
  });

  it("liczy pozycje ze starym terminem ZD po upływie TTL", () => {
    const orders = [
      baseOrder({
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: "2026-07-01",
        zd_fulfillment_dok_nr: "ZD/1",
        zd_fulfillment_synced_at: new Date(
          Date.now() - ZD_ETA_SYNC_TTL_MS - 60_000
        ).toISOString(),
      }),
    ];
    expect(countZdEtaMojeClientSyncTriggers(orders, [stats], [supplier])).toBe(
      1
    );
  });

  it("nie liczy triggerów gdy Subiekt niedostępny", () => {
    const orders = [baseOrder()];
    expect(countZdEtaMojeClientSyncTriggers(orders, [stats], [supplier], false)).toBe(
      0
    );
  });
});
