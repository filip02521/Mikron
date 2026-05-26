import { describe, expect, it } from "vitest";
import {
  matchSupplierId,
  parseDeliveryStatsLine,
  parseDeliveryStatsRows,
} from "./delivery-stats-import";

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

  it("parsuje eksport CSV z arkusza", () => {
    const rows = parseDeliveryStatsRows([
      [
        "DOSTAWCA",
        "SUMA DNI (GŁÓWNE)",
        "LICZBA DOSTAW (GŁÓWNE)",
        "ŚREDNI CZAS (GŁÓWNE)",
        "SUMA DNI (POBOCZNE)",
        "LICZBA DOSTAW (POBOCZNE)",
        "ŚREDNI CZAS (POBOCZNE)",
        "OSTATNIA AKTUALIZACJA",
      ],
      ["Amadar", "18", "4", "5", "5", "4", "1", "2026-05-25 19:24:17"],
      ["3D Jake (niceshops)", "", "", "", "11", "2", "6", "2026-05-25 19:24:17"],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.main_avg).toBe(5);
    expect(rows[0]?.side_avg).toBe(1);
    expect(rows[1]?.main_sum).toBeNull();
    expect(rows[1]?.side_count).toBe(2);
  });

  it("dopasowuje alias Erkodent do Giedrius Juzenas", () => {
    const suppliers = [
      { id: "erk-1", name: "Giedrius Juzenas (Erkodent / Komet)" },
    ];
    expect(matchSupplierId("Erkodent (Giedrius Juzenas)", suppliers)).toBe("erk-1");
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
