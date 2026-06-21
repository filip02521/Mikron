import { describe, expect, it } from "vitest";
import { computeZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import {
  buildZkWatchOpenProsbaPreviewEntries,
  formatZkProsbaProductLabel,
  formatZkProsbaPreviewMetaLine,
  formatZkProsbaPreviewMetaTooltip,
  resolveZkProsbaPreviewDelivery,
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
});

describe("resolveZkProsbaPreviewDelivery", () => {
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
