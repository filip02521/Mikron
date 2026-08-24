import { describe, expect, it } from "vitest";
import {
  SALES_PLAN_COPY,
  salesPlanOpenRequestsLabel,
  salesPlanYouHaveOpenRequests,
} from "./sales-plan-ui-copy";

describe("sales-plan-ui-copy", () => {
  it("trzyma spójną nazwę działu zakupów (nie „dział dostaw”)", () => {
    const blob = JSON.stringify(SALES_PLAN_COPY);
    expect(blob).toMatch(/dział zakupów/i);
    expect(blob).not.toMatch(/dział dostaw/i);
  });

  it("odmienia „prośba” poprawnie", () => {
    expect(salesPlanOpenRequestsLabel(1)).toBe("1 otwarta prośba");
    expect(salesPlanOpenRequestsLabel(2)).toBe("2 otwarte prośby");
    expect(salesPlanOpenRequestsLabel(4)).toBe("4 otwarte prośby");
    expect(salesPlanOpenRequestsLabel(5)).toBe("5 otwartych próśb");
    expect(salesPlanOpenRequestsLabel(12)).toBe("12 otwartych próśb");
    expect(salesPlanOpenRequestsLabel(22)).toBe("22 otwarte prośby");
    expect(salesPlanYouHaveOpenRequests(1)).toBe("Masz 1 otwartą prośbę");
    expect(salesPlanYouHaveOpenRequests(5)).toBe("Masz 5 otwartych próśb");
  });

  it("rozróżnia zamówienie u dostawcy od daty na magazynie", () => {
    expect(SALES_PLAN_COPY.helpTwoDatesBody).toMatch(/Zamówienie/);
    expect(SALES_PLAN_COPY.helpTwoDatesBody).toMatch(/Na magazynie/);
    expect(SALES_PLAN_COPY.weekHint).toMatch(/nie dzień/i);
  });
});
