import { describe, expect, it } from "vitest";
import {
  canReadZkWatchTeethPreview,
  zkTeethPreviewUsesOwnSalesPerson,
} from "./zk-watch-teeth-preview-access";

describe("canReadZkWatchTeethPreview", () => {
  const watch = "sp-owner";

  it("pozwala właścicielowi notatnika", () => {
    expect(
      canReadZkWatchTeethPreview({
        watchSalesPersonId: watch,
        ownSalesPersonId: watch,
        isActiveDelegate: false,
        canAccessWatchOwner: false,
      })
    ).toBe(true);
  });

  it("pozwala aktywnemu zastępcy urlopowemu", () => {
    expect(
      canReadZkWatchTeethPreview({
        watchSalesPersonId: watch,
        ownSalesPersonId: "sp-other",
        isActiveDelegate: true,
        canAccessWatchOwner: false,
      })
    ).toBe(true);
  });

  it("pozwala adminowi / kierownikowi z dostępem do karty", () => {
    expect(
      canReadZkWatchTeethPreview({
        watchSalesPersonId: watch,
        ownSalesPersonId: null,
        isActiveDelegate: false,
        canAccessWatchOwner: true,
      })
    ).toBe(true);
  });

  it("odmawia obcemu handlowcowi bez delegacji", () => {
    expect(
      canReadZkWatchTeethPreview({
        watchSalesPersonId: watch,
        ownSalesPersonId: "sp-other",
        isActiveDelegate: false,
        canAccessWatchOwner: false,
      })
    ).toBe(false);
  });

  it("odmawia przy pustym id handlowca", () => {
    expect(
      canReadZkWatchTeethPreview({
        watchSalesPersonId: "  ",
        ownSalesPersonId: "sp-other",
        isActiveDelegate: false,
        canAccessWatchOwner: true,
      })
    ).toBe(false);
  });
});

describe("zkTeethPreviewUsesOwnSalesPerson", () => {
  it("tylko dla ról sprzedażowych", () => {
    expect(zkTeethPreviewUsesOwnSalesPerson("sales")).toBe(true);
    expect(zkTeethPreviewUsesOwnSalesPerson("sales_manager")).toBe(true);
    expect(zkTeethPreviewUsesOwnSalesPerson("admin")).toBe(false);
  });
});
