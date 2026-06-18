import { describe, expect, it } from "vitest";
import {
  composeSalesActivityVersion,
  computeSalesActivityVersionFromRows,
  filterSalesActivityRows,
} from "./sales-activity-version";
import type { SalesActivityRow } from "./sales-activity-version";

function row(partial: Partial<SalesActivityRow>): SalesActivityRow {
  return {
    action_at: "2026-01-01T10:00:00Z",
    ordered_at: null,
    delivery_at: null,
    status: "Nowe",
    sales_acknowledged_at: null,
    request_kind: "zamowienie",
    informacja_stock_out_reorder: false,
    ...partial,
  };
}

describe("computeSalesActivityVersionFromRows", () => {
  it("uwzględnia wszystkie wiersze (także potwierdzone archiwum)", () => {
    const v = computeSalesActivityVersionFromRows([
      row({ action_at: "2026-01-02T10:00:00Z", status: "Zamowione" }),
      row({
        action_at: "2026-01-01T10:00:00Z",
        status: "Zrealizowane",
        sales_acknowledged_at: "2026-01-03T10:00:00Z",
      }),
    ]);
    expect(v.startsWith("1|")).toBe(true);
    expect(v).toContain("Zamowione:1");
    expect(v).toContain("Zrealizowane:1");
  });

  it("zmienia się przy nowszym action_at", () => {
    const a = computeSalesActivityVersionFromRows([
      row({ action_at: "2026-01-01T10:00:00Z" }),
    ]);
    const b = computeSalesActivityVersionFromRows([
      row({ action_at: "2026-02-01T10:00:00Z" }),
    ]);
    expect(a).not.toBe(b);
  });

  it("zmienia się po synchronizacji terminu z ZD", () => {
    const before = computeSalesActivityVersionFromRows([row({})]);
    const after = computeSalesActivityVersionFromRows([
      row({
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: "2026-07-03",
      }),
    ]);
    expect(before).not.toBe(after);
    expect(after).toContain("zd:1:2026-07-03");
  });

  it("zmienia się po zakończeniu sync ZD bez dopasowania (synced_at)", () => {
    const before = computeSalesActivityVersionFromRows([row({})]);
    const after = computeSalesActivityVersionFromRows([
      row({
        zd_fulfillment_synced_at: "2026-06-18T14:20:40.887Z",
      }),
    ]);
    expect(before).not.toBe(after);
    expect(after).toContain("zds:2026-06-18T14:20:40.887Z");
  });

  it("zmienia się po zapisaniu numeru dokumentu ZD", () => {
    const before = computeSalesActivityVersionFromRows([row({})]);
    const after = computeSalesActivityVersionFromRows([
      row({
        zd_fulfillment_dok_id: 101,
        zd_fulfillment_dok_nr: "ZD/101/2026",
      }),
    ]);
    expect(before).not.toBe(after);
    expect(after).toContain("zdk:");
    expect(after).toContain("ZD/101/2026");
  });

  it("ignoruje stock_out przy filtrowaniu (zgodnie z SSR handlowca)", () => {
    const visible = row({ action_at: "2026-01-01T10:00:00Z", status: "Nowe" });
    const stockOut = row({
      action_at: "2026-02-15T12:00:00Z",
      status: "Zamowione",
      request_kind: "informacja",
      informacja_stock_out_reorder: true,
    });
    const all = [visible, stockOut];
    const filtered = filterSalesActivityRows(all);

    expect(filtered).toHaveLength(1);
    expect(computeSalesActivityVersionFromRows(filtered)).toBe(
      computeSalesActivityVersionFromRows([visible])
    );
    expect(computeSalesActivityVersionFromRows(all)).not.toBe(
      computeSalesActivityVersionFromRows(filtered)
    );
  });
});

describe("composeSalesActivityVersion", () => {
  it("dopasowuje format SSR i API", () => {
    const ordersPart = computeSalesActivityVersionFromRows([
      {
        action_at: "2026-06-01T10:00:00Z",
        ordered_at: null,
        delivery_at: null,
        status: "Nowe",
        sales_acknowledged_at: null,
      },
    ]);
    const full = composeSalesActivityVersion(ordersPart, [
      { updated_at: "2026-06-09T12:00:00Z", line_checks: [{ key: "a", arrived: true }] },
    ]);
    expect(full).toContain("::");
    expect(full.startsWith(ordersPart)).toBe(true);
  });
});
