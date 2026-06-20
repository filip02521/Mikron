import { describe, expect, it } from "vitest";
import {
  MY_ORDER_HISTORY_ESTIMATE_CAPTION,
  MY_ORDER_HISTORY_ESTIMATE_TITLE,
  formatMyOrderHistoryEstimateLineLabel,
} from "@/lib/orders/my-order-history-estimate-copy";

describe("my-order-history-estimate-copy", () => {
  it("używa jednoznacznych etykiet bez słowa szacunek", () => {
    expect(MY_ORDER_HISTORY_ESTIMATE_CAPTION).toBe("Z historii");
    expect(MY_ORDER_HISTORY_ESTIMATE_TITLE).toBe("Termin z historii dostaw");
    expect(formatMyOrderHistoryEstimateLineLabel("ok. 10.05.2026")).toBe(
      "Z historii: ok. 10.05.2026"
    );
    expect(
      formatMyOrderHistoryEstimateLineLabel("ok. 10.05.2026", { lowConfidence: true })
    ).toBe("Z historii: ok. 10.05.2026 (orientacyjnie)");
  });
});
