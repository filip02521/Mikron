import { describe, expect, it } from "vitest";
import {
  isVerificationInformacjaPathLocked,
  resolveVerificationInformacjaFlags,
  verificationInformacjaUiForOrder,
} from "./verification-informacja-ui";
import type { IndividualOrder } from "@/types/database";

function order(partial: Partial<IndividualOrder>): IndividualOrder {
  return {
    id: "1",
    supplier_id: null,
    sales_person_id: "sp",
    symbol: "-",
    products: "Towar",
    quantity: "-",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "informacja",
    status: "Weryfikacja",
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    ...partial,
  } as IndividualOrder;
}

describe("verification-informacja-ui", () => {
  it("stock_out — badge i zablokowana ścieżka", () => {
    const ui = verificationInformacjaUiForOrder(
      order({ informacja_stock_out_reorder: true })
    );
    expect(ui?.badgeLabel).toBe("Brak na stanie");
    expect(ui?.pathLocked).toBe(true);
    expect(ui?.completeSuccessMessage).toContain("Brak na stanie");
  });

  it("direct — picker dostępny", () => {
    const row = order({
      informacja_stock_out_reorder: false,
      informacja_queue_via_daily_panel: false,
    });
    expect(isVerificationInformacjaPathLocked(row)).toBe(false);
    expect(verificationInformacjaUiForOrder(row)?.path).toBe("direct");
  });

  it("resolveVerificationInformacjaFlags zachowuje stock_out mimo zmiany w formularzu", () => {
    const prior = order({ informacja_stock_out_reorder: true });
    const flags = resolveVerificationInformacjaFlags({
      requestKind: "informacja",
      informacjaPath: "direct",
      priorOrder: prior,
    });
    expect(flags.informacjaStockOutReorder).toBe(true);
    expect(flags.informacjaQueueViaDailyPanel).toBe(false);
  });

  it("resolveVerificationInformacjaFlags — zmiana ścieżki gdy nie zablokowana", () => {
    const prior = order({
      informacja_stock_out_reorder: false,
      informacja_queue_via_daily_panel: false,
    });
    const flags = resolveVerificationInformacjaFlags({
      requestKind: "informacja",
      informacjaPath: "stock_out",
      priorOrder: prior,
    });
    expect(flags.informacjaStockOutReorder).toBe(true);
  });

  it("zamówienie czyści flagi informacji", () => {
    const flags = resolveVerificationInformacjaFlags({
      requestKind: "zamowienie",
      informacjaPath: "stock_out",
      priorOrder: order({ informacja_stock_out_reorder: true }),
    });
    expect(flags.informacjaStockOutReorder).toBe(false);
  });
});
