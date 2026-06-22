import { describe, expect, it } from "vitest";
import { zdFulfillmentDeadlineChangeShortLabel } from "@/components/orders/ZdFulfillmentDeadlineChangeNotice";
import { buildZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";

describe("ZdFulfillmentDeadlineChangeNotice", () => {
  it("skraca zmianę terminu do jednej linii z datami", () => {
    const change = buildZdFulfillmentDeadlineChangeDisplay(
      "2026-07-15",
      "2026-07-22",
      "2026-06-18T08:00:00Z"
    );
    expect(zdFulfillmentDeadlineChangeShortLabel(change)).toBe(
      "Termin przesunięty · 15.07.2026 → 22.07.2026"
    );
  });
});
