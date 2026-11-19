import { describe, expect, it } from "vitest";
import {
  DAILY_SUPPLIER_GROUP_ORDER,
  buildDailySupplierRows,
  countDailySupplierGroups,
  countDailySupplierSources,
  parseDailySupplierSource,
  type DailySupplierRowsInput,
} from "@/lib/orders/daily-supplier-rows";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import type { ZdAutomatTodayOrder, ZdAutomatTodayStage } from "@/lib/orders/zd-automat-daily";
import type { StockWatchSupplierSignal } from "@/lib/stock-watch/signal";

const TODAY = "2026-11-10";
const NOW = "2026-11-10T08:00:00+01:00";
const FRESH = "2026-11-10T05:30:00+01:00";
const STALE = "2026-11-07T05:30:00+01:00";

function sched(id: string, name: string, dateKey: string, vacationNote: string | null = null): SummaryStandardItem {
  return {
    kind: "standard",
    supplierId: id,
    supplierName: name,
    flaggedName: name,
    location: "POLSKA",
    nextDate: new Date(`${dateKey}T00:00:00`),
    vacationNote,
    notes: "",
    shift: "",
    status: "",
    sourceSheet: "POLSKA",
    scheduleId: `s-${id}`,
  };
}

function signal(over: Partial<StockWatchSupplierSignal> = {}): StockWatchSupplierSignal {
  return {
    lineCount: 0,
    orderValue: 0,
    unpricedCount: 0,
    criticalCount: 0,
    beforeDeliveryCount: 0,
    mostUrgent: null,
    dniZapasu: 30,
    leadDays: 7,
    nextOrderDate: null,
    nextOrderDays: null,
    dataDo: "2026-11-09",
    computedAt: FRESH,
    ...over,
  };
}

function order(id: string, name: string, stage: ZdAutomatTodayStage, dokId: number | null = null): ZdAutomatTodayOrder {
  return {
    supplierId: id,
    supplierName: name,
    stage,
    proposal: { id: `p-${id}-${stage}`, createdAt: FRESH, status: "pending", lineCount: 3, valueNet: 100, dokNr: null, dokId },
  };
}

function pending(id: string, name: string, flags: string[] = []) {
  return { id: `pp-${id}`, supplierId: id, supplierName: name, lines: [], flags } as unknown as DailySupplierRowsInput["pendingProposals"][number];
}

function input(over: Partial<DailySupplierRowsInput> = {}): DailySupplierRowsInput {
  return {
    todayDateKey: TODAY,
    nowIso: NOW,
    scheduled: [],
    automatOrders: [],
    pendingProposals: [],
    automatSupplierIds: new Set(),
    vacationNowIds: new Set(),
    signals: {},
    offPlan: [],
    onDemand: [],
    requestGroups: [],
    stockOutGroups: [],
    zdTodaySupplierIds: new Set(),
    canPrepareZd: true,
    ...over,
  };
}

const onDemandRow = (id: string, name: string) => ({
  supplierId: id,
  supplierName: name,
  location: "POLSKA" as const,
  locationLabel: "Polska",
  stockLabel: "",
  intervalLabel: "",
  mails: "",
  notes: "",
});

describe("buildDailySupplierRows", () => {
  it("dostawca w automacie, z zaległym terminem i pilnymi brakami ma jeden wiersz w Do wysłania", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("a", "Alfa Dental", "2026-11-07")],
        automatOrders: [order("a", "Alfa Dental", "review")],
        automatSupplierIds: new Set(["a"]),
        signals: { a: signal({ lineCount: 42, criticalCount: 5 }) },
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      group: "send",
      sources: ["automat", "harmonogram"],
      overdueDays: 3,
      action: { kind: "automat", label: "Sprawdź i wyślij" },
    });
  });

  it.each([
    ["unconfirmed", null, "Sprawdź"],
    ["send", 77, "Wyślij mail"],
  ] as const)("etap %s daje akcję %s", (stage, dokId, label) => {
    const rows = buildDailySupplierRows(input({ automatOrders: [order("a", "Alfa Dental", stage, dokId)] }));
    expect(rows[0]).toMatchObject({ group: "send", action: { kind: "automat", label } });
  });

  it("etap send bez dokId: Do wysłania bez akcji", () => {
    const rows = buildDailySupplierRows(input({ automatOrders: [order("a", "Alfa Dental", "send")] }));
    expect(rows[0]).toMatchObject({ group: "send", action: null });
  });

  it("zamówienie wysłane dziś trafia do Zrobione dziś także przy pilnych brakach w analizie", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("a", "Alfa Dental", TODAY)],
        automatOrders: [order("a", "Alfa Dental", "sent", 77)],
        signals: { a: signal({ lineCount: 4, criticalCount: 2 }) },
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ group: "done", action: null });
  });

  it("dwa zamówienia u dostawcy (wysłane i czekające): wiersz bierze czekające", () => {
    const rows = buildDailySupplierRows(
      input({ automatOrders: [order("a", "Alfa Dental", "sent", 77), order("a", "Alfa Dental", "review")] })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].group).toBe("send");
    expect(rows[0].automatOrder?.stage).toBe("review");
  });

  it("odrzucone dziś + zaległy termin: grupa wg analizy, bez źródła automat", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("a", "Alfa Dental", "2026-11-09")],
        automatOrders: [order("a", "Alfa Dental", "rejected")],
        signals: { a: signal({ lineCount: 2 }) },
      })
    );
    expect(rows[0]).toMatchObject({ group: "order", sources: ["harmonogram"] });
  });

  it("odrzucone dziś bez innej pracy: brak wiersza", () => {
    expect(buildDailySupplierRows(input({ automatOrders: [order("a", "Alfa Dental", "rejected")] }))).toEqual([]);
  });

  it("czekająca propozycja u dostawcy spoza automatSupplierIds: Do wysłania, Sprawdź i wyślij", () => {
    const rows = buildDailySupplierRows(input({ pendingProposals: [pending("b", "Beta Frez")] }));
    expect(rows[0]).toMatchObject({
      supplierName: "Beta Frez",
      group: "send",
      sources: ["automat"],
      action: { kind: "automat", label: "Sprawdź i wyślij" },
    });
    expect(rows[0].pendingProposal?.id).toBe("pp-b");
  });

  it("propozycja z flagą wartości daje automatWarning", () => {
    const rows = buildDailySupplierRows(input({ pendingProposals: [pending("b", "Beta Frez", ["order_value_jump"])] }));
    expect(rows[0].automatWarning).toBe(true);
  });

  it("termin dziś i praca w analizie: Do zamówienia, Przygotuj ZD", () => {
    const rows = buildDailySupplierRows(
      input({ scheduled: [sched("a", "Alfa Dental", TODAY)], signals: { a: signal({ lineCount: 3 }) } })
    );
    expect(rows[0]).toMatchObject({ group: "order", overdueDays: 0, action: { kind: "prepareZd", horizon: false } });
  });

  it("tylko pozycje zagrożone przed dostawą: Przygotuj ZD z horyzontem", () => {
    const rows = buildDailySupplierRows(
      input({ scheduled: [sched("a", "Alfa Dental", TODAY)], signals: { a: signal({ beforeDeliveryCount: 2 }) } })
    );
    expect(rows[0].action).toEqual({ kind: "prepareZd", horizon: true });
  });

  it("poza planem bez terminu i bez analizy: źródło poza-planem, grupa early, Przygotuj ZD z horyzontem", () => {
    const rows = buildDailySupplierRows(
      input({ offPlan: [{ supplierId: "c", supplierName: "Gamma Lab", count: 3, nextOrderDate: "2026-11-19", onDemand: false }] })
    );
    expect(rows[0]).toMatchObject({
      supplierName: "Gamma Lab",
      group: "early",
      sources: ["poza-planem"],
      offPlanCount: 3,
      action: { kind: "prepareZd", horizon: true },
    });
  });

  it("poza planem z terminem na dziś: grupa order, nie early", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("c", "Gamma Lab", TODAY)],
        offPlan: [{ supplierId: "c", supplierName: "Gamma Lab", count: 3, nextOrderDate: null, onDemand: false }],
        signals: { c: signal({ lineCount: 1, beforeDeliveryCount: 3 }) },
      })
    );
    expect(rows[0]).toMatchObject({ group: "order", sources: ["harmonogram", "poza-planem"] });
  });

  it("poza planem z onDemand: true ma źródło na-zadanie i grupę order", () => {
    const rows = buildDailySupplierRows(
      input({ offPlan: [{ supplierId: "c", supplierName: "Gamma Lab", count: 2, nextOrderDate: null, onDemand: true }] })
    );
    expect(rows[0]).toMatchObject({ group: "order", sources: ["na-zadanie"], action: { kind: "prepareZd", horizon: true } });
  });

  it("na żądanie wchodzi tylko z pracą w analizie", () => {
    const base = { onDemand: [onDemandRow("d", "Delta Prot")] };
    expect(buildDailySupplierRows(input({ ...base, signals: { d: signal() } }))).toEqual([]);
    const rows = buildDailySupplierRows(input({ ...base, signals: { d: signal({ lineCount: 3, criticalCount: 1 }) } }));
    expect(rows[0]).toMatchObject({ group: "order", sources: ["na-zadanie"] });
  });

  it("termin dziś, świeża analiza bez pracy: Do przesunięcia, Przesuń", () => {
    const rows = buildDailySupplierRows(input({ scheduled: [sched("a", "Alfa Dental", TODAY)], signals: { a: signal() } }));
    expect(rows[0]).toMatchObject({ group: "shift", action: { kind: "shift" }, signalStale: false });
  });

  it("termin dziś, nieaktualna analiza bez pracy: Do sprawdzenia ręcznie, nie Do przesunięcia", () => {
    const rows = buildDailySupplierRows(
      input({ scheduled: [sched("a", "Alfa Dental", TODAY)], signals: { a: signal({ computedAt: STALE }) } })
    );
    expect(rows[0]).toMatchObject({ group: "manual", action: { kind: "ordered" }, signalStale: true });
  });

  it("nieaktualna analiza z pracą: Do zamówienia, signalStale true", () => {
    const rows = buildDailySupplierRows(
      input({ scheduled: [sched("a", "Alfa Dental", TODAY)], signals: { a: signal({ lineCount: 2, computedAt: STALE }) } })
    );
    expect(rows[0]).toMatchObject({ group: "order", signalStale: true });
  });

  it("termin dziś, brak analizy: Do sprawdzenia ręcznie, Zamówione", () => {
    const rows = buildDailySupplierRows(input({ scheduled: [sched("a", "Alfa Dental", TODAY)] }));
    expect(rows[0]).toMatchObject({ group: "manual", action: { kind: "ordered" }, signal: null });
  });

  it("termin z urlopem i świeżą analizą bez pracy: Do sprawdzenia ręcznie, Zamówione", () => {
    const rows = buildDailySupplierRows(
      input({ scheduled: [sched("a", "Alfa Dental", TODAY, "OSTATNIE_ZAMOWIENIE")], signals: { a: signal() }, vacationNowIds: new Set(["a"]) })
    );
    expect(rows[0]).toMatchObject({
      group: "manual",
      action: { kind: "ordered" },
      vacationNote: "OSTATNIE_ZAMOWIENIE",
      onVacationNow: true,
    });
  });

  it("termin, świeża analiza bez pracy, prośby czekają: Do zamówienia z licznikiem próśb", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("a", "Alfa Dental", TODAY)],
        signals: { a: signal() },
        requestGroups: [
          { supplierId: "a", lines: [{}, {}] },
          { supplierId: "a", lines: [{}] },
        ] as unknown as DailySupplierRowsInput["requestGroups"],
      })
    );
    expect(rows[0]).toMatchObject({ group: "order", requestCount: 3, stockOutCount: 0 });
  });

  it("sygnał braku na stanie liczy się osobno od próśb i też daje Do zamówienia", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("a", "Alfa Dental", TODAY)],
        signals: { a: signal() },
        stockOutGroups: [{ supplierId: "a", lines: [{}] }] as unknown as DailySupplierRowsInput["stockOutGroups"],
      })
    );
    expect(rows[0]).toMatchObject({ group: "order", requestCount: 0, stockOutCount: 1 });
  });

  it("same prośby nie tworzą wiersza", () => {
    const rows = buildDailySupplierRows(
      input({ requestGroups: [{ supplierId: "z", lines: [{}] }] as unknown as DailySupplierRowsInput["requestGroups"] })
    );
    expect(rows).toEqual([]);
  });

  it("bez Kreatora ZD: akcja braki zamiast prepareZd", () => {
    const rows = buildDailySupplierRows(
      input({ canPrepareZd: false, scheduled: [sched("a", "Alfa Dental", TODAY)], signals: { a: signal({ lineCount: 3 }) } })
    );
    expect(rows[0]).toMatchObject({ group: "order", action: { kind: "braki" } });
  });

  it("kolejność: grupy wg stałej listy, w grupie zaległe, potem pilne malejąco, potem nazwa", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [
          sched("m", "Mi Ręczny", TODAY),
          sched("b", "Beta Frez", TODAY),
          sched("a", "Alfa Dental", TODAY),
          sched("z", "Zeta Zaległy", "2026-11-05"),
        ],
        automatOrders: [order("s", "Sigma Auto", "review")],
        signals: {
          b: signal({ lineCount: 5, criticalCount: 4 }),
          a: signal({ lineCount: 5, criticalCount: 1 }),
          z: signal({ lineCount: 1 }),
        },
      })
    );
    expect(rows.map((r) => r.supplierName)).toEqual(["Sigma Auto", "Zeta Zaległy", "Beta Frez", "Alfa Dental", "Mi Ręczny"]);
    expect(rows.map((r) => r.group)).toEqual(["send", "order", "order", "order", "manual"]);
    expect(DAILY_SUPPLIER_GROUP_ORDER).toEqual(["send", "order", "early", "shift", "manual", "done"]);
  });

  it("early: kolejność wg liczby zagrożonych towarów, potem terminu planu, potem nazwy", () => {
    const off = (id: string, name: string, count: number, next: string | null) => ({
      supplierId: id,
      supplierName: name,
      count,
      nextOrderDate: next,
      onDemand: false,
    });
    const rows = buildDailySupplierRows(
      input({
        offPlan: [
          off("1", "Omega", 2, "2026-11-20"),
          off("2", "Kappa", 48, "2026-12-01"),
          off("3", "Alfa Dental", 2, "2026-11-12"),
          off("4", "Beta Frez", 2, "2026-11-12"),
        ],
      })
    );
    expect(rows.map((r) => r.supplierName)).toEqual(["Kappa", "Alfa Dental", "Beta Frez", "Omega"]);
  });

  it("liczniki grup sumują się do liczby wierszy; liczniki źródeł pomijają Zrobione dziś", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("a", "Alfa Dental", TODAY), sched("b", "Beta Frez", TODAY)],
        automatOrders: [order("a", "Alfa Dental", "review"), order("d", "Delta Prot", "sent", 5)],
        signals: { b: signal() },
        offPlan: [{ supplierId: "c", supplierName: "Gamma Lab", count: 1, nextOrderDate: null, onDemand: false }],
      })
    );
    const groups = countDailySupplierGroups(rows);
    expect(groups).toEqual({ send: 1, order: 0, early: 1, shift: 1, manual: 0, done: 1 });
    expect(Object.values(groups).reduce((a, b) => a + b, 0)).toBe(rows.length);
    expect(countDailySupplierSources(rows)).toEqual({ automat: 1, harmonogram: 2, "poza-planem": 1, "na-zadanie": 0 });
  });
});

describe("buildDailySupplierRows — ZD z Kreatora dziś", () => {
  it("poza planem z ZD z dziś: Zrobione dziś, bez Przygotuj ZD", () => {
    const rows = buildDailySupplierRows(
      input({
        offPlan: [{ supplierId: "c", supplierName: "Gamma Lab", count: 3, nextOrderDate: "2026-11-19", onDemand: false }],
        signals: { c: signal({ lineCount: 2, beforeDeliveryCount: 3 }) },
        zdTodaySupplierIds: new Set(["c"]),
      })
    );
    expect(rows[0]).toMatchObject({ group: "done", action: null, zdToday: true });
  });

  it("na żądanie z pilnymi brakami i ZD z dziś: Zrobione dziś", () => {
    const rows = buildDailySupplierRows(
      input({
        onDemand: [onDemandRow("d", "Delta Prot")],
        signals: { d: signal({ lineCount: 3, criticalCount: 1 }) },
        zdTodaySupplierIds: new Set(["d"]),
      })
    );
    expect(rows[0]).toMatchObject({ group: "done", action: null });
  });

  it("termin harmonogramu z pracą i ZD z dziś: zostaje w Do zamówienia z akcją Zamówione (zamknięcie terminu)", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("a", "Alfa Dental", "2026-11-07")],
        signals: { a: signal({ lineCount: 4, criticalCount: 2 }) },
        zdTodaySupplierIds: new Set(["a"]),
      })
    );
    expect(rows[0]).toMatchObject({ group: "order", action: { kind: "ordered" }, zdToday: true });
  });

  it("ZD z dziś nie chowa czekającego zamówienia automatu ani terminu bez pracy", () => {
    const rows = buildDailySupplierRows(
      input({
        scheduled: [sched("a", "Alfa Dental", TODAY), sched("b", "Beta Frez", TODAY)],
        automatOrders: [order("a", "Alfa Dental", "review")],
        signals: { b: signal() },
        zdTodaySupplierIds: new Set(["a", "b"]),
      })
    );
    expect(rows.map((r) => r.group)).toEqual(["send", "shift"]);
  });
});

describe("parseDailySupplierSource", () => {
  it("przyjmuje cztery wartości, resztę i null zamienia na null", () => {
    expect(["automat", "harmonogram", "poza-planem", "na-zadanie"].map(parseDailySupplierSource)).toEqual([
      "automat",
      "harmonogram",
      "poza-planem",
      "na-zadanie",
    ]);
    expect(parseDailySupplierSource("inne")).toBeNull();
    expect(parseDailySupplierSource(null)).toBeNull();
  });
});
