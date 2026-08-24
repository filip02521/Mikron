import { describe, expect, it } from "vitest";
import { presentMyOrder, presentMyOrders } from "./my-order-presenter";
import {
  enrichMyOrderSalesUi,
  myOrderMetaFields,
  myOrderExpandedMetaFields,
  parseStatusDetailMetaParts,
  sortMyOrderRows,
  summarizeMyOrdersInbox,
  verificationSublineFromDetail,
} from "./my-order-sales-ui";
import type { IndividualOrder } from "@/types/database";

const baseOrder: IndividualOrder = {
  id: "1",
  supplier_id: "sup1",
  sales_person_id: "sp1",
  symbol: "ABC",
  products: "Wkręt",
  quantity: "3",
  delivered_quantity: "-",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Zamowione",
  action_at: "2026-04-28",
  ordered_at: "2026-05-01",
  delivery_at: null,
  supplier: {
    id: "sup1",
    name: "Dostawca X",
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: null,
    interval_weeks: null,
    stock_raw: null,
    stock: null,
    stats_mode: "LACZNIE",
    order_on_demand: false,
    is_active: true,
  },
};

describe("enrichMyOrderSalesUi", () => {
  it("po oznaczeniu z plikiem zamówienia — handlowiec dostaje nazwę do pobrania", () => {
    const { zamowienia } = presentMyOrders(
      [
        {
          ...baseOrder,
          is_teeth: true,
          status: "Zamowione",
          ordered_at: "2026-05-01",
          teeth_order_file_path: "teeth-orders/group/ivoclar/x.xlsx",
          teeth_order_file_name: "ivoclar-order.xlsx",
        },
      ],
      []
    );
    const line = zamowienia[0]?.lines[0];
    expect(line?.teethOrderFileName).toBe("ivoclar-order.xlsx");
  });

  it("zęby Zamowione z teeth_delivery_date — timingLabel z datą i ~N dni rob.", () => {
    const { zamowienia } = presentMyOrders(
      [
        {
          ...baseOrder,
          is_teeth: true,
          status: "Zamowione",
          ordered_at: "2026-05-04T10:00:00+02:00",
          teeth_ordered_at: "2026-05-04T10:00:00+02:00",
          teeth_delivery_date: "2026-05-08",
        },
      ],
      []
    );
    const row = zamowienia[0];
    expect(row?.timingLabel).toMatch(/Planowana dostawa: 08\.05\.2026/);
    expect(row?.timingLabel).toMatch(/~\d+ dni rob\./);
    expect(row?.statusDetail).toMatch(/Planowana dostawa: 08\.05\.2026/);
  });

  it("zęby po terminie — badge danger (nie tylko timingLabel)", () => {
    const { zamowienia } = presentMyOrders(
      [
        {
          ...baseOrder,
          is_teeth: true,
          status: "Zamowione",
          ordered_at: "2020-01-02T10:00:00+01:00",
          teeth_ordered_at: "2020-01-02T10:00:00+01:00",
          teeth_delivery_date: "2020-01-10",
        },
      ],
      []
    );
    expect(zamowienia[0]?.timingLabel).toMatch(/po terminie/i);
    expect(zamowienia[0]?.badgeVariant).toBe("danger");
  });

  it("zęby ze stałym ETA — teethEtaSource fixed", () => {
    const { zamowienia } = presentMyOrders(
      [
        {
          ...baseOrder,
          supplier_id: "sup1",
          is_teeth: true,
          status: "Zamowione",
          ordered_at: "2026-05-04T10:00:00+02:00",
          teeth_ordered_at: "2026-05-04T10:00:00+02:00",
          teeth_delivery_date: "2026-05-08",
        },
      ],
      [],
      { teethLeadDaysBySupplierId: { sup1: 4 } }
    );
    expect(zamowienia[0]?.teethEtaSource).toBe("fixed");
  });

  it("zęby z ręcznym override przy stałym ETA — teethEtaSource manual", () => {
    const { zamowienia } = presentMyOrders(
      [
        {
          ...baseOrder,
          supplier_id: "sup1",
          is_teeth: true,
          status: "Zamowione",
          ordered_at: "2026-05-04T10:00:00+02:00",
          teeth_ordered_at: "2026-05-04T10:00:00+02:00",
          // 10 dni rob. zamiast skonfigurowanych 4
          teeth_delivery_date: "2026-05-18",
        },
      ],
      [],
      { teethLeadDaysBySupplierId: { sup1: 4 } }
    );
    expect(zamowienia[0]?.teethEtaSource).toBe("manual");
  });

  it("zęby bez teeth_delivery_date nie biorą ETA z delivery_stats", () => {
    const { zamowienia } = presentMyOrders(
      [
        {
          ...baseOrder,
          is_teeth: true,
          status: "Zamowione",
          ordered_at: "2026-05-01",
          teeth_ordered_at: "2026-05-01",
          teeth_delivery_date: null,
        },
      ],
      [
        {
          supplier_id: "sup1",
          main_avg: 5,
          side_avg: 5,
          main_count: 10,
          side_count: 10,
        } as never,
      ]
    );
    expect(zamowienia[0]?.timingLabel).toBeNull();
  });

  it("bez ścieżki Storage nie pokazuje pliku (sama nazwa nie wystarczy)", () => {
    const { zamowienia } = presentMyOrders(
      [
        {
          ...baseOrder,
          is_teeth: true,
          status: "Zamowione",
          teeth_order_file_path: null,
          teeth_order_file_name: "ghost.xlsx",
        },
      ],
      []
    );
    expect(zamowienia[0]?.lines[0]?.teethOrderFileName).toBeNull();
  });

  it("priorytetyzuje odbiór z magazynu", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, status: "Zrealizowane" }],
      []
    ).zamowienia[0];
    const ui = enrichMyOrderSalesUi(row);
    expect(ui.headline).toBe("Gotowe do odbioru z regału");
    expect(ui.headlineTone).toBe("action");
    expect(ui.sortPriority).toBe(1);
    expect(ui.subline).toBeNull();
  });

  it("odbiór części grupy — tylko liczba pozostałych, bez subline X/Y", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, status: "Zrealizowane" }],
      []
    ).zamowienia[0]!;
    const ui = enrichMyOrderSalesUi({
      ...row,
      pickupReadyTotal: 11,
      pickupAcknowledgedCount: 9,
      pickupPendingCount: 2,
    });
    expect(ui.headline).toBe("Gotowe do odbioru z regału · 2 pozycje");
    expect(ui.subline).toBeNull();
  });

  it("priorytetyzuje osobisty odbiór zębów", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, status: "Zrealizowane", is_teeth: true }],
      []
    ).zamowienia[0];
    const ui = enrichMyOrderSalesUi(row);
    expect(ui.headline).toBe("Zęby gotowe do odbioru");
    expect(ui.subline).toContain("osobiste");
    expect(ui.sortPriority).toBe(1);
  });

  it("zęby zamówione — bez języka planowej dostawy", () => {
    const row = presentMyOrder(
      {
        ...baseOrder,
        is_teeth: true,
        status: "Zamowione",
        order_type: "Glowne",
        teeth_ordered_at: "2026-06-10",
        teeth_delivery_date: "2026-06-24",
      },
      {}
    );
    expect(row.statusTitle).toBe("Zamówione");
    expect(row.statusDetail).toContain("10.06.2026");
    expect(row.statusDetail).toContain("24.06.2026");
    expect(row.statusDetail).not.toContain("planowej dostawie");
  });

  it("zęby przed zamówieniem — neutralny copy", () => {
    const row = presentMyOrder(
      {
        ...baseOrder,
        is_teeth: true,
        status: "Nowe",
        ordered_at: null,
        teeth_ordered_at: null,
      },
      {}
    );
    expect(row.statusTitle).toBe("Przed zamówieniem");
    expect(row.statusDetail).toContain("działu dostaw");
  });

  it("zęby w Weryfikacji — neutralny copy jak zwykłe produkty", () => {
    const row = presentMyOrder(
      {
        ...baseOrder,
        is_teeth: true,
        status: "Weryfikacja",
      },
      {}
    );
    expect(row.statusTitle).toBe("W dziale dostaw");
    expect(row.statusDetail).toContain("Dział dostaw");
  });

  it("oznacza opóźnienie po terminie", () => {
    const row = presentMyOrder(baseOrder, {
      sup1: {
        supplier_id: "sup1",
        main_avg: 1,
        main_count: 5,
        main_sum: 5,
        side_avg: null,
        side_count: null,
        side_sum: null,
      },
    });
    const withUi = { ...row, ...enrichMyOrderSalesUi(row) };
    expect(withUi.headline).toBe("Po przewidywanym terminie");
    expect(withUi.headlineTone).toBe("warning");
  });

  it("informacja do potwierdzenia ma fioletowy ton, nie zielony odbiór", () => {
    const row = presentMyOrders(
      [
        {
          ...baseOrder,
          request_kind: "informacja",
          status: "Zrealizowane",
          quantity: "-",
        },
      ],
      []
    ).informacje[0]!;
    const ui = enrichMyOrderSalesUi(row);
    expect(ui.headline).toBe("Powiadomienie o dostępności");
    expect(ui.headline).not.toBe("Na magazynie");
    expect(ui.headlineTone).toBe("informacja");
    expect(ui.sortPriority).toBe(10);
  });

  it("informacja stock_auto — subline o Subiekcie, nie magazynie", () => {
    const row = presentMyOrders(
      [
        {
          ...baseOrder,
          request_kind: "informacja",
          status: "Zrealizowane",
          quantity: "-",
          delivery_at: "2026-05-15T10:00:00Z",
          informacja_arrived_source: "stock_auto",
        },
      ],
      []
    ).informacje[0]!;
    const ui = enrichMyOrderSalesUi(row);
    expect(ui.subline).toContain("Subiekcie");
    expect(ui.subline).not.toContain("magazynu");
  });

  it("część na magazynie ma ton stock, nie warning jak po terminie", () => {
    const partial = presentMyOrders(
      [{ ...baseOrder, status: "Czesciowo_zrealizowane", delivered_quantity: "2" }],
      []
    ).zamowienia[0]!;
    const ui = enrichMyOrderSalesUi(partial);
    expect(ui.headline).toBe("Część towaru na magazynie");
    expect(ui.headlineTone).toBe("stock");
  });
});

describe("sortMyOrderRows", () => {
  it("kładzie odbiór przed czekające zamówienie", () => {
    const ready = presentMyOrders(
      [{ ...baseOrder, id: "a", status: "Zrealizowane" }],
      []
    ).zamowienia[0];
    const waiting = presentMyOrders([{ ...baseOrder, id: "b" }], []).zamowienia[0];
    const sorted = sortMyOrderRows([waiting, ready]);
    expect(sorted[0].acknowledgeMode).toBe("pickup");
  });
});

describe("summarizeMyOrdersInbox", () => {
  it("liczy karty do odbioru", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, status: "Zrealizowane" }],
      []
    ).zamowienia[0];
    const s = summarizeMyOrdersInbox([row]);
    expect(s.pickupCount).toBe(1);
  });

  it("nie liczy prośby o dostępność jako zamówienie w toku", () => {
    const informacja = presentMyOrders(
      [
        {
          ...baseOrder,
          request_kind: "informacja",
          status: "Nowe",
          quantity: "-",
          ordered_at: null,
        },
      ],
      []
    ).informacje[0];
    const zamowienie = presentMyOrders([baseOrder], []).zamowienia[0];
    const s = summarizeMyOrdersInbox([informacja, zamowienie, zamowienie]);
    expect(s.zamowioneCount).toBe(2);
    expect(s.przedZamowieniemCount).toBe(0);
    expect(s.availabilityPendingCount).toBe(1);
  });

  it("liczy anulowania do potwierdzenia", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, id: "c1", status: "Anulowane" }],
      []
    ).zamowienia[0];
    const s = summarizeMyOrdersInbox([row]);
    expect(s.cancelAckCount).toBe(1);
    expect(row.acknowledgeMode).toBe("cancelled");
    expect(enrichMyOrderSalesUi(row).headlineTone).toBe("dismiss");
  });

  it("liczy rezygnację do potwierdzenia", () => {
    const row = presentMyOrders(
      [
        {
          ...baseOrder,
          id: "cn1",
          status: "Zamowione",
          sales_cancelled_at: "2026-05-01T10:00:00.000Z",
          sales_cancel_phase: "in_transit",
        },
      ],
      []
    ).zamowienia[0];
    const s = summarizeMyOrdersInbox([row]);
    expect(s.cancelAckCount).toBe(1);
    expect(row.acknowledgeMode).toBe("cancel_notice");
    expect(row.cancelNoticeOrderIds).toEqual(["cn1"]);
    expect(enrichMyOrderSalesUi(row).headlineTone).toBe("dismiss");
  });
});

describe("enrichMyOrderSalesUi — termin", () => {
  it("nie powtarza komunikatu o braku terminu, gdy jest szacunek", () => {
    const row = presentMyOrders([baseOrder], [
      {
        supplier_id: "sup1",
        main_avg: 5,
        main_count: 10,
        main_sum: 50,
        side_avg: null,
        side_count: null,
        side_sum: null,
      },
    ]).zamowienia[0];
    const ui = enrichMyOrderSalesUi(row);
    expect(row.timingLabel).toBeTruthy();
    expect(ui.subline ?? "").not.toContain("Termin pojawi się");
    expect(ui.subline ?? "").not.toContain("historię realizacji");
  });
});

describe("verificationSublineFromDetail", () => {
  it("skraca komunikat weryfikacji do jednej linii", () => {
    expect(
      verificationSublineFromDetail(
        "Dział dostaw dopasuje dostawcę. Prośba jest zapisana — nie musisz nic uzupełniać."
      )
    ).toBe("Zakupy dopasują dostawcę — bez Twojej akcji");
    expect(verificationSublineFromDetail(null)).toContain("dopracują");
  });
});

describe("myOrderMetaFields", () => {
  it("ma czytelne etykiety magazynu", () => {
    const row = presentMyOrders([baseOrder], [
      {
        supplier_id: "sup1",
        main_avg: 5,
        main_count: 10,
        main_sum: 50,
        side_avg: null,
        side_count: null,
        side_sum: null,
      },
    ]).zamowienia[0];
    const fields = myOrderMetaFields(row, true);
    expect(fields.some((f) => f.label === "Magazyn")).toBe(true);
    expect(fields.some((f) => f.label === "Szacunek" || f.label === "Termin")).toBe(
      false
    );
  });
});

describe("parseStatusDetailMetaParts", () => {
  it("wyciąga typ i datę zamówienia z statusDetail", () => {
    const parsed = parseStatusDetailMetaParts(
      "Osobne domówienie tylko na Twoją prośbę — poza planową dostawą · Zamówiono 06.05.2026"
    );
    expect(parsed.orderTypeLabel).toBe("Poza planem");
    expect(parsed.orderedAtLabel).toBe("06.05.2026");
    expect(parsed.remainder).toBeNull();
  });

  it("oddziela wspólny termin od daty zamówienia", () => {
    const parsed = parseStatusDetailMetaParts(
      "Osobne domówienie tylko na Twoją prośbę — poza planową dostawą · Zamówiono 11.06.2026 · Wspólny termin dla wszystkich pozycji."
    );
    expect(parsed.orderTypeLabel).toBe("Poza planem");
    expect(parsed.orderedAtLabel).toBe("11.06.2026");
    expect(parsed.remainder).toBe("Wspólny termin dla wszystkich pozycji.");
  });

  it("myOrderMetaFields pokazuje ZK gdy prośba z notatnika", () => {
    const row = presentMyOrders(
      [
        {
          ...baseOrder,
          source_zk_number: "ZK/2026/0138",
          sales_client_name: "Klinika",
        },
      ],
      []
    ).zamowienia[0];
    expect(myOrderMetaFields(row, false).some((f) => f.label === "ZK" && f.value === "2026/0138")).toBe(
      true
    );
  });

  it("myOrderExpandedMetaFields dodaje typ i zamówiono", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, order_type: "Poboczne", ordered_at: "2026-05-06" }],
      [
        {
          supplier_id: "sup1",
          main_avg: 5,
          main_count: 10,
          main_sum: 50,
          side_avg: null,
          side_count: null,
          side_sum: null,
        },
      ]
    ).zamowienia[0];
    const fields = myOrderExpandedMetaFields(row, true);
    expect(fields.some((f) => f.label === "Typ")).toBe(true);
    expect(fields.some((f) => f.label === "Zamówiono")).toBe(true);
  });
});
