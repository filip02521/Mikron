import { describe, expect, it } from "vitest";
import { buildSummaryWorkspace } from "@/lib/orders/summary-workspace";
import { computeOperationsDailyPanelVersion } from "./operations-daily-panel-version";

const emptyWorkspace = buildSummaryWorkspace([], []);

describe("computeOperationsDailyPanelVersion", () => {
  it("zmienia się przy nowej grupie prośby", () => {
    const before = computeOperationsDailyPanelVersion({
      workspace: emptyWorkspace,
      verificationCount: 0,
    });

    const withRequest = computeOperationsDailyPanelVersion({
      workspace: buildSummaryWorkspace(
        [],
        [
          {
            id: "o1",
            sales_person_id: "sp1",
            supplier_id: "s1",
            status: "Nowe",
            action_at: "2026-05-28T10:00:00Z",
            ordered_at: null,
            delivery_at: null,
            products: "Produkt A",
            symbol: "A",
            quantity: "1",
            request_kind: "zamowienie",
            procurement_seen_at: null,
          } as never,
        ],
        undefined,
        [{ id: "sp1", name: "Jan" }]
      ),
      verificationCount: 0,
    });

    expect(before).not.toBe(withRequest);
  });

  it("zmienia się przy nowej pozycji w weryfikacji", () => {
    const a = computeOperationsDailyPanelVersion({
      workspace: emptyWorkspace,
      verificationCount: 0,
    });
    const b = computeOperationsDailyPanelVersion({
      workspace: emptyWorkspace,
      verificationCount: 2,
    });
    expect(a).not.toBe(b);
  });

  it("nie zmienia się przy samym oznaczeniu prośby jako przeczytanej", () => {
    const unseen = buildSummaryWorkspace(
      [],
      [
        {
          id: "o1",
          sales_person_id: "sp1",
          supplier_id: "s1",
          status: "Nowe",
          action_at: "2026-05-28T10:00:00Z",
          ordered_at: null,
          delivery_at: null,
          products: "Produkt A",
          symbol: "A",
          quantity: "1",
          request_kind: "zamowienie",
          procurement_seen_at: null,
        } as never,
      ],
      undefined,
      [{ id: "sp1", name: "Jan" }]
    );

    const seen = buildSummaryWorkspace(
      [],
      [
        {
          id: "o1",
          sales_person_id: "sp1",
          supplier_id: "s1",
          status: "Nowe",
          action_at: "2026-05-28T10:00:00Z",
          ordered_at: null,
          delivery_at: null,
          products: "Produkt A",
          symbol: "A",
          quantity: "1",
          request_kind: "zamowienie",
          procurement_seen_at: "2026-05-28T11:00:00Z",
        } as never,
      ],
      undefined,
      [{ id: "sp1", name: "Jan" }]
    );

    const unseenVersion = computeOperationsDailyPanelVersion({
      workspace: unseen,
      verificationCount: 0,
    });
    const seenVersion = computeOperationsDailyPanelVersion({
      workspace: seen,
      verificationCount: 0,
    });

    expect(unseenVersion).toBe(seenVersion);
  });
});
