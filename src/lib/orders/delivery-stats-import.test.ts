import { describe, expect, it } from "vitest";
import { parseDeliveryStatsLine } from "./delivery-stats-import";

describe("parseDeliveryStatsLine", () => {
  it("parsuje wiersz tylko główny", () => {
    const row = parseDeliveryStatsLine(
      "3D Jake (niceshops)\t11\t2\t6\t2026-05-16 10:34:05"
    );
    expect(row?.supplierName).toBe("3D Jake (niceshops)");
    expect(row?.main_sum).toBe(11);
    expect(row?.main_count).toBe(2);
    expect(row?.main_avg).toBe(6);
    expect(row?.side_sum).toBeNull();
  });

  it("parsuje wiersz główny i poboczny", () => {
    const row = parseDeliveryStatsLine(
      "Amadar\t11\t5\t2\t5\t4\t1\t2026-05-16 10:34:05"
    );
    expect(row?.main_avg).toBe(2);
    expect(row?.side_avg).toBe(1);
    expect(row?.side_count).toBe(4);
  });
});
