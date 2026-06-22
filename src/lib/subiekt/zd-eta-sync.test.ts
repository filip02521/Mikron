import { describe, expect, it, vi } from "vitest";
import {
  countZdEtaMojeClientSyncTriggers,
  countZdEtaMojeClientSyncMount,
  countZdEtaSyncTriggers,
  hasKnownZdFulfillmentDocId,
  hasPersistedZdFulfillment,
  zdEtaSyncOrderPriority,
  zdEtaSyncSupplierOrderPriority,
  isZdEtaOverdueCandidate,
  isZdEtaSyncEligible,
  needsZdEtaSync,
  zdEtaPerOrderDocBudget,
  selectZdEtaSyncCandidates,
  shouldMarkMojeZdEtaSessionDone,
  shouldRetryMojeZdEtaSync,
  shouldSkipMojeZdEtaSessionSync,
  buildMojeZdEtaSessionState,
  tryRefreshKnownZdDocumentForOrder,
  refreshKnownZdDocumentForOrder,
  zdDocumentMatchesSupplierKhIds,
  zdEtaSyncLockKey,
  zdEtaSyncTtlMsForOrder,
  zdFulfillmentPersistOnMissAction,
  ZD_ETA_GLOBAL_ORDER_SCAN_MAX,
  ZD_ETA_GLOBAL_ORDER_SCAN_PAGE,
  ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS,
  ZD_ETA_SYNC_KNOWN_ZD_TTL_MS,
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

describe("isZdEtaSyncEligible", () => {
  it("kwalifikuje zamówienie w toku z datą zgłoszenia", () => {
    expect(isZdEtaSyncEligible(baseOrder())).toBe(true);
    expect(
      isZdEtaSyncEligible(
        baseOrder({
          ordered_at: new Date().toISOString(),
          action_at: new Date().toISOString(),
        })
      )
    ).toBe(true);
    expect(isZdEtaSyncEligible(baseOrder({ request_kind: "informacja" }))).toBe(false);
  });
});

describe("zdEtaPerOrderDocBudget", () => {
  it("dzieli pozostały budżet między niewykonane pozycje", () => {
    expect(zdEtaPerOrderDocBudget(100, 4)).toBe(25);
    expect(zdEtaPerOrderDocBudget(200, 2)).toBe(48);
  });

  it("utrzymuje minimum 24 dokumentów na pozycję przy wielu kandydatach", () => {
    expect(zdEtaPerOrderDocBudget(200, 19)).toBe(24);
  });
});

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
  it("syncuje świeże zamówienie bez wcześniejszego terminu ZD", () => {
    const now = Date.now();
    const freshStats = {
      ...stats,
      main_sum: 5,
      main_avg: 5,
      main_count: 1,
    };
    expect(
      needsZdEtaSync(
        baseOrder({
          ordered_at: new Date().toISOString(),
          action_at: new Date().toISOString(),
        }),
        freshStats,
        "LACZNIE",
        now
      )
    ).toBe(true);
  });

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
          zd_fulfillment_deadline: "2026-07-15",
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

  it("używa krótszego TTL gdy znany zd_fulfillment_dok_id", () => {
    const now = new Date("2026-06-18T12:00:00+02:00").getTime();
    const order = baseOrder({
      zd_fulfillment_source: "zd",
      zd_fulfillment_deadline: "2026-07-15",
      zd_fulfillment_dok_id: 42,
      zd_fulfillment_synced_at: new Date(
        now - ZD_ETA_SYNC_KNOWN_ZD_TTL_MS + 60_000
      ).toISOString(),
    });
    expect(zdEtaSyncTtlMsForOrder(order)).toBe(ZD_ETA_SYNC_KNOWN_ZD_TTL_MS);
    expect(needsZdEtaSync(order, stats, "LACZNIE", now)).toBe(false);
    expect(
      needsZdEtaSync(
        {
          ...order,
          zd_fulfillment_synced_at: new Date(
            now - ZD_ETA_SYNC_KNOWN_ZD_TTL_MS - 60_000
          ).toISOString(),
        },
        stats,
        "LACZNIE",
        now
      )
    ).toBe(true);
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

  it("ponawia sync gdy zapisany termin ZD wygasł", () => {
    const now = new Date("2026-06-18T12:00:00+02:00").getTime();
    expect(
      needsZdEtaSync(
        baseOrder({
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-02-27",
          zd_fulfillment_synced_at: "2026-03-01T10:00:00+01:00",
        }),
        stats,
        "LACZNIE",
        now
      )
    ).toBe(true);
  });

  it("wymusza sync przy częściowej dostawie z zapisanym ZD (szukamy ZD z brakami)", () => {
    const now = new Date("2026-06-18T12:00:00+02:00").getTime();
    expect(
      needsZdEtaSync(
        baseOrder({
          status: "Czesciowo_zrealizowane",
          quantity: "5",
          delivered_quantity: "2",
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-10",
          zd_fulfillment_dok_id: 31,
          zd_fulfillment_synced_at: new Date(now - 60_000).toISOString(),
        }),
        stats,
        "LACZNIE",
        now
      )
    ).toBe(true);
  });
});

describe("hasPersistedZdFulfillment", () => {
  const at = new Date("2026-06-18T12:00:00+02:00");

  it("rozpoznaje aktywny zapisany termin z ZD", () => {
    expect(
      hasPersistedZdFulfillment(
        {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-03",
        },
        at
      )
    ).toBe(true);
    expect(
      hasPersistedZdFulfillment(
        {
          zd_fulfillment_source: null,
          zd_fulfillment_deadline: "2026-07-03",
        },
        at
      )
    ).toBe(false);
  });

  it("nie zachowuje terminu z przeszłości", () => {
    expect(
      hasPersistedZdFulfillment(
        {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-02-27",
        },
        at
      )
    ).toBe(false);
  });
});

describe("zdEtaSyncOrderPriority", () => {
  const at = new Date("2026-06-18T12:00:00+02:00");

  it("najwyższy priorytet dla przeterminowanego ZD w bazie", () => {
    const expired = {
      zd_fulfillment_source: "zd" as const,
      zd_fulfillment_deadline: "2026-02-27",
      zd_fulfillment_synced_at: "2026-03-01T10:00:00+01:00",
    };
    const active = {
      zd_fulfillment_source: "zd" as const,
      zd_fulfillment_deadline: "2026-07-15",
      zd_fulfillment_synced_at: "2026-06-01T10:00:00+02:00",
    };
    expect(zdEtaSyncOrderPriority(expired, at)).toBeLessThan(
      zdEtaSyncOrderPriority(active, at)
    );
  });
});

describe("zdEtaSyncSupplierOrderPriority", () => {
  const at = new Date("2026-06-18T12:00:00+02:00");

  it("najpierw częściowa realizacja ze znanym dok_id", () => {
    const partialKnown = baseOrder({
      status: "Czesciowo_zrealizowane",
      quantity: "4",
      delivered_quantity: "2",
      zd_fulfillment_source: "zd",
      zd_fulfillment_dok_id: 1804208,
      zd_fulfillment_deadline: "2026-07-10",
      zd_fulfillment_synced_at: "2026-06-01T10:00:00+02:00",
    });
    const fresh = baseOrder({
      status: "Zamowione",
      zd_fulfillment_synced_at: null,
      zd_fulfillment_source: null,
    });
    expect(zdEtaSyncSupplierOrderPriority(partialKnown, at)).toBeLessThan(
      zdEtaSyncSupplierOrderPriority(fresh, at)
    );
  });
});

describe("selectZdEtaSyncCandidates", () => {
  it("priorytetyzuje pozycję z przeterminowanym terminem ZD", () => {
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
        baseOrder({
          id: "active-zd",
          ordered_at: "2026-01-02T10:00:00+01:00",
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-15",
          zd_fulfillment_synced_at: "2026-06-01T10:00:00+02:00",
        }),
        baseOrder({
          id: "expired-zd",
          ordered_at: "2026-02-09T10:00:00+01:00",
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-02-27",
          zd_fulfillment_synced_at: "2026-03-01T10:00:00+01:00",
        }),
      ],
      statsMap,
      supplierById,
      now,
      { maxOrders: 1, force: true }
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe("expired-zd");
  });

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
  it("czyści zapis gdy znany ZD jest już nieaktywny", () => {
    expect(
      zdFulfillmentPersistOnMissAction(false, true, {
        knownZdInactive: true,
      })
    ).toBe("clear");
  });

  it("przy force zachowuje aktywny termin ZD po pełnym przeszukaniu", () => {
    expect(zdFulfillmentPersistOnMissAction(true, true)).toBe("touch");
  });

  it("przy offline / timeout z zachowanym terminem nie dotyka bazy (retain)", () => {
    expect(zdFulfillmentPersistOnMissAction(true, true, { subiektOffline: true })).toBe(
      "retain"
    );
    expect(zdFulfillmentPersistOnMissAction(true, true, { searchIncomplete: true })).toBe(
      "retain"
    );
    expect(zdFulfillmentPersistOnMissAction(false, true, { subiektOffline: true })).toBe(
      "retain"
    );
  });

  it("przy offline bez wcześniejszego terminu tylko odświeża synced_at", () => {
    expect(zdFulfillmentPersistOnMissAction(false, false, { subiektOffline: true })).toBe(
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

  it("nie kończy sesji gdy Subiekt offline przed wczytaniem puli, a klient ma pozycje do sync", () => {
    expect(
      shouldMarkMojeZdEtaSessionDone(
        {
          skipped: true,
          reason: "subiekt_offline",
          subiektOffline: true,
          candidates: 0,
          processed: 0,
        },
        4
      )
    ).toBe(false);
  });
});

describe("shouldSkipMojeZdEtaSessionSync", () => {
  const now = Date.now();

  it("nie pomija gdy spadła liczba pozycji po częściowym syncu", () => {
    const state = buildMojeZdEtaSessionState(
      20,
      { candidates: 20, processed: 20 },
      now
    );
    expect(shouldSkipMojeZdEtaSessionSync(8, state, now)).toBe(false);
  });

  it("pomija gdy pełny przebieg i ta sama liczba pozycji", () => {
    const state = buildMojeZdEtaSessionState(
      8,
      { candidates: 8, processed: 8 },
      now
    );
    expect(shouldSkipMojeZdEtaSessionSync(8, state, now)).toBe(true);
  });

  it("nie pomija gdy wzrosła liczba pozycji", () => {
    const state = buildMojeZdEtaSessionState(
      5,
      { candidates: 5, processed: 5 },
      now
    );
    expect(shouldSkipMojeZdEtaSessionSync(9, state, now)).toBe(false);
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

  it("liczy szybciej pozycje ze znanym dok_id (krótszy TTL)", () => {
    const orders = [
      baseOrder({
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: "2026-07-01",
        zd_fulfillment_dok_id: 99,
        zd_fulfillment_dok_nr: "ZD/1",
        zd_fulfillment_synced_at: new Date(
          Date.now() - ZD_ETA_SYNC_KNOWN_ZD_TTL_MS - 60_000
        ).toISOString(),
      }),
    ];
    expect(countZdEtaMojeClientSyncTriggers(orders, [stats], [supplier])).toBe(
      1
    );
    expect(
      countZdEtaMojeClientSyncTriggers(
        [
          {
            ...orders[0]!,
            zd_fulfillment_synced_at: new Date(
              Date.now() - ZD_ETA_SYNC_KNOWN_ZD_TTL_MS + 60_000
            ).toISOString(),
          },
        ],
        [stats],
        [supplier]
      )
    ).toBe(0);
  });

  it("nie liczy triggerów gdy Subiekt niedostępny", () => {
    const orders = [baseOrder()];
    expect(countZdEtaMojeClientSyncTriggers(orders, [stats], [supplier], false)).toBe(
      0
    );
  });

  it("mount liczy pozycje nawet gdy Subiekt offline", () => {
    const orders = [baseOrder()];
    expect(countZdEtaMojeClientSyncMount(orders, [stats], [supplier])).toBe(1);
    expect(countZdEtaMojeClientSyncTriggers(orders, [stats], [supplier], false)).toBe(
      0
    );
  });
});

describe("hasKnownZdFulfillmentDocId", () => {
  it("rozpoznaje dodatnie dok_id", () => {
    expect(hasKnownZdFulfillmentDocId(baseOrder({ zd_fulfillment_dok_id: 12 }))).toBe(
      true
    );
    expect(hasKnownZdFulfillmentDocId(baseOrder({ zd_fulfillment_dok_id: null }))).toBe(
      false
    );
    expect(hasKnownZdFulfillmentDocId(baseOrder({ zd_fulfillment_dok_id: 0 }))).toBe(
      false
    );
  });
});

describe("tryRefreshKnownZdDocumentForOrder", () => {
  const khIds = [9001];
  const syncAt = new Date("2026-06-18T12:00:00+02:00");

  it("zwraca null bez zapisanego dok_id", async () => {
    const order = baseOrder({ symbol: "SYM", products: "Prod A" });
    const loadDoc = vi.fn();
    await expect(
      tryRefreshKnownZdDocumentForOrder(order, loadDoc, khIds, syncAt)
    ).resolves.toBeNull();
    expect(loadDoc).not.toHaveBeenCalled();
  });

  it("wczytuje dokument po znanym dok_id gdy pasuje do pozycji", async () => {
    const order = baseOrder({
      symbol: "X",
      products: "Prod A",
      subiekt_tw_id: 100,
      zd_fulfillment_dok_id: 501,
    });
    const doc = {
      dok_Id: 501,
      dok_DostawcaId: 9001,
      dok_NrPelny: "ZD/501",
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 100, tw_Symbol: "ABC" }],
    } as import("@/lib/subiekt/types").SubiektDocument;
    const loadDoc = vi.fn().mockResolvedValue(doc);
    await expect(
      tryRefreshKnownZdDocumentForOrder(order, loadDoc, khIds, syncAt)
    ).resolves.toBe(doc);
    expect(loadDoc).toHaveBeenCalledWith(501);
  });

  it("odrzuca dokument innego dostawcy lub niepasujący do pozycji", async () => {
    const order = baseOrder({
      symbol: "SYM",
      products: "Prod A",
      zd_fulfillment_dok_id: 502,
    });
    const loadDoc = vi.fn().mockResolvedValue({
      dok_Id: 502,
      dok_DostawcaId: 7777,
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ tw_Symbol: "SYM", tw_Nazwa: "Prod A" }],
    });
    await expect(
      tryRefreshKnownZdDocumentForOrder(order, loadDoc, khIds, syncAt)
    ).resolves.toBeNull();
  });

  it("odrzuca ZD ze statusem Zrealizowane (8), nawet z przyszłym terminem", async () => {
    const order = baseOrder({
      symbol: "SYM",
      products: "Prod A",
      subiekt_tw_id: 100,
      zd_fulfillment_dok_id: 503,
    });
    const loadDoc = vi.fn().mockResolvedValue({
      dok_Id: 503,
      dok_DostawcaId: 9001,
      dok_Status: 8,
      dok_TerminRealizacji: "2099-01-01",
      dok_Pozycja: [{ ob_TowId: 100, tw_Symbol: "SYM", tw_Nazwa: "Prod A" }],
    });
    await expect(
      tryRefreshKnownZdDocumentForOrder(order, loadDoc, khIds, syncAt)
    ).resolves.toBeNull();
  });

  it("odrzuca zapisany ZD z luźną ilością po częściowej dostawie", async () => {
    const order = baseOrder({
      symbol: "H364RNF 103 015",
      products: "Komet",
      subiekt_tw_id: 16893,
      quantity: "5",
      delivered_quantity: "2",
      zd_fulfillment_dok_id: 31,
    });
    const loadDoc = vi.fn().mockResolvedValue({
      dok_Id: 31,
      dok_DostawcaId: 9001,
      dok_Status: 6,
      dok_TerminRealizacji: "2026-07-10",
      dok_Pozycja: [{ ob_TowId: 16893, tw_Symbol: "H364RNF 103 015", ob_Ilosc: 5 }],
    });
    await expect(
      refreshKnownZdDocumentForOrder(order, loadDoc, khIds, syncAt)
    ).resolves.toEqual({ kind: "inactive" });
  });
});
