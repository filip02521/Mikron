import { describe, expect, it } from "vitest";
import { computeZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import {
  buildZkWatchOpenProsbaPreviewEntries,
  buildZkWatchProsbaPreviewEntries,
  formatZkProsbaProductLabel,
  formatZkProsbaPreviewMetaLine,
  formatZkProsbaPreviewMetaTooltip,
  resolveZkProsbaPreviewDelivery,
  resolveZkProsbaPreviewStatusBadgeVariant,
} from "@/lib/sales/zk-watch-prosba-preview";
import type { SalesZkWatch } from "@/types/database";

const watch = {
  id: "watch-1",
  sales_person_id: "sp-1",
  client_label: "Klinika Test",
  client_kh_id: 100,
  zk_number: "ZK/1/2026",
} as SalesZkWatch;

const baseOrder = {
  sales_person_id: "sp-1",
  sales_client_name: "Klinika Test",
  sales_client_kh_id: 100,
  source_zk_watch_id: "watch-1",
  source_zk_number: "ZK/1/2026",
  subiekt_tw_id: 10,
  symbol: "ABC",
  products: "Implant testowy",
  mikran_code: null,
  quantity: "2",
  delivered_quantity: "0",
  status: "Zamowione",
  request_kind: "zamowienie" as const,
  ordered_at: "2026-07-15T08:00:00Z",
  action_at: "2026-06-01T08:00:00Z",
  delivery_at: "2026-07-15",
  zd_fulfillment_deadline: null,
  zd_fulfillment_deadline_changed_at: null,
  sales_acknowledged_at: null,
  sales_cancelled_at: null,
};

describe("buildZkWatchOpenProsbaPreviewEntries", () => {
  it("returns open linked orders with product labels", () => {
    const orders = [{ id: "order-1", ...baseOrder }];
    const hints = computeZkWatchOrderHints(watch, orders);
    const entries = buildZkWatchOpenProsbaPreviewEntries(watch, orders, hints);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.order.id).toBe("order-1");
    expect(entries[0]?.productLabel).toBe("Implant testowy (ABC)");
    expect(entries[0]?.isOpen).toBe(true);
    expect(entries[0]?.deliveryDisplay?.primaryLabel).toBeTruthy();
  });

  it("pokazuje częściową prośbę po odbiorze z regału gdy u dostawcy brakuje sztuk", () => {
    const orders = [
      {
        id: "partial-ack",
        ...baseOrder,
        status: "Czesciowo_zrealizowane",
        quantity: "5",
        delivered_quantity: "3",
        sales_acknowledged_at: "2026-06-18T10:00:00Z",
      },
    ];
    const hints = computeZkWatchOrderHints(watch, orders);
    const entries = buildZkWatchOpenProsbaPreviewEntries(watch, orders, hints);

    expect(hints.matchingOpenRequestIds).toContain("partial-ack");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.order.id).toBe("partial-ack");
    expect(entries[0]?.progressLabel).toBe("3/5 szt.");
  });
});

describe("buildZkWatchProsbaPreviewEntries", () => {
  it("pokazuje też zamknięte prośby (nie tylko otwarte)", () => {
    const orders = [
      { id: "order-closed", ...baseOrder, status: "Zrealizowane", delivered_quantity: "2" },
    ];
    const hints = computeZkWatchOrderHints(watch, orders);
    const entries = buildZkWatchProsbaPreviewEntries(watch, orders, hints);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.order.id).toBe("order-closed");
    expect(entries[0]?.isOpen).toBe(false);
  });

  it("otwarte prośby są przed zamkniętymi", () => {
    const orders = [
      { id: "closed", ...baseOrder, status: "Zrealizowane", delivered_quantity: "2" },
      { id: "open", ...baseOrder, status: "Zamowione", delivered_quantity: "0" },
    ];
    const hints = computeZkWatchOrderHints(watch, orders);
    const entries = buildZkWatchProsbaPreviewEntries(watch, orders, hints);

    expect(entries.map((entry) => entry.order.id)).toEqual(["open", "closed"]);
  });

  it("nie pokazuje prośb innego klienta ani innego towaru", () => {
    const orders = [
      { id: "mine", ...baseOrder },
      {
        id: "other-client",
        ...baseOrder,
        source_zk_watch_id: null,
        source_zk_number: null,
        sales_client_kh_id: 999,
        sales_client_name: "Inna klinika",
      },
      {
        id: "other-product",
        ...baseOrder,
        source_zk_watch_id: null,
        source_zk_number: null,
        subiekt_tw_id: 999,
        symbol: "ZZZ",
        products: "Inny produkt",
      },
      {
        id: "open-everywhere",
        ...baseOrder,
        source_zk_watch_id: null,
        source_zk_number: null,
        sales_client_kh_id: 999,
        sales_client_name: "Inna klinika",
        status: "Zamowione",
      },
    ];
    const hints = computeZkWatchOrderHints(watch, orders);
    const entries = buildZkWatchProsbaPreviewEntries(watch, orders, hints);

    expect(entries.map((entry) => entry.order.id)).toEqual(["mine"]);
  });
});

describe("resolveZkProsbaPreviewDelivery", () => {
  it("nie pokazuje terminu gdy prośba jest zrealizowana", () => {
    const delivery = resolveZkProsbaPreviewDelivery({
      ...baseOrder,
      status: "Zrealizowane",
      delivery_at: "2026-07-15",
      zd_fulfillment_deadline: "2026-07-16",
    });

    expect(delivery.deliveryDisplay).toBeNull();
    expect(delivery.deliveryEmptyLabel).toBeNull();
    expect(
      formatZkProsbaPreviewMetaLine({
        quantityLabel: "2 szt.",
        progressLabel: "2/2 szt.",
        ...delivery,
      })
    ).toBe("Liczba: 2 szt. · 2/2 szt.");
  });

  it("prefers ZD deadline over email estimate", () => {
    const delivery = resolveZkProsbaPreviewDelivery({
      ...baseOrder,
      zd_fulfillment_deadline: "2026-08-01",
      delivery_at: "2026-07-15",
    });

    expect(delivery.deliveryCaption).toContain("Planowana dostawa");
    expect(delivery.deliveryDisplay).not.toBeNull();
    expect(delivery.deliveryDisplay?.title).toContain("2026");
  });

  it("uses delivery_at when ZD missing", () => {
    const delivery = resolveZkProsbaPreviewDelivery({
      ...baseOrder,
      zd_fulfillment_deadline: null,
      delivery_at: "2026-07-15",
    });

    expect(delivery.deliveryCaption).toBe("Z historii");
    expect(delivery.deliveryDisplay).not.toBeNull();
  });
});

describe("formatZkProsbaProductLabel", () => {
  it("falls back to symbol when product name missing", () => {
    expect(formatZkProsbaProductLabel({ products: null, symbol: "XYZ", mikran_code: null })).toBe(
      "XYZ"
    );
  });
});

describe("resolveZkProsbaPreviewStatusBadgeVariant", () => {
  it("oznacza zrealizowane na zielono", () => {
    expect(resolveZkProsbaPreviewStatusBadgeVariant("Zrealizowane")).toBe("success");
    expect(resolveZkProsbaPreviewStatusBadgeVariant("Czesciowo_zrealizowane")).toBe("warning");
    expect(resolveZkProsbaPreviewStatusBadgeVariant("Zamowione")).toBe("info");
  });
});

describe("formatZkProsbaPreviewMetaLine", () => {
  it("shows delivery date when available", () => {
    const delivery = resolveZkProsbaPreviewDelivery(baseOrder);
    expect(
      formatZkProsbaPreviewMetaLine({
        quantityLabel: "2 szt.",
        progressLabel: "0/2",
        ...delivery,
      })
    ).toContain("Z historii:");
  });

  it("uses deliveryEmptyLabel instead of generic missing-date text", () => {
    const delivery = resolveZkProsbaPreviewDelivery({
      ...baseOrder,
      request_kind: "informacja",
      delivery_at: null,
      zd_fulfillment_deadline: null,
    });

    expect(formatZkProsbaPreviewMetaLine({
      quantityLabel: "1 szt.",
      progressLabel: null,
      ...delivery,
    })).toContain("Termin dostawy nie dotyczy");
    expect(formatZkProsbaPreviewMetaLine({
      quantityLabel: "1 szt.",
      progressLabel: null,
      ...delivery,
    })).not.toContain("brak terminu");
  });

  it("nie pokazuje Dziś gdy termin ZD = dzień złożenia u dostawcy", () => {
    const delivery = resolveZkProsbaPreviewDelivery({
      ...baseOrder,
      ordered_at: "2026-06-18T08:00:00Z",
      zd_fulfillment_deadline: "2026-06-18",
      zd_fulfillment_deadline_changed_at: null,
    });

    expect(delivery.deliveryDisplay?.primaryLabel).toBe("Ustalamy termin dostawy");
    expect(formatZkProsbaPreviewMetaLine({
      quantityLabel: "2 szt.",
      progressLabel: null,
      ...delivery,
    })).toBe("Liczba: 2 szt. · Ustalamy termin dostawy");
    expect(formatZkProsbaPreviewMetaTooltip({
      quantityLabel: "2 szt.",
      progressLabel: null,
      ...delivery,
    })).toContain("Potwierdzanie terminu");
  });
});
