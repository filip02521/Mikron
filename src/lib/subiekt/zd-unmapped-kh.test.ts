import { describe, expect, it } from "vitest";
import { aggregateZdUnmappedByKh } from "./zd-unmapped-kh";

describe("aggregateZdUnmappedByKh", () => {
  it("grupuje po kh_Id i wykrywa brak dostawcy", () => {
    const supplierByKh = new Map([[100, "Ivoclar"]]);
    const rows = aggregateZdUnmappedByKh(
      [
        { subiekt_kh_id: 200, dok_nr_pelny: "ZD/1", dok_data_wyst: "2026-01-01" },
        { subiekt_kh_id: 200, dok_nr_pelny: "ZD/2", dok_data_wyst: "2026-02-01" },
      ],
      supplierByKh
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subiektKhId).toBe(200);
    expect(rows[0]?.zdCount).toBe(2);
    expect(rows[0]?.reason).toBe("no_supplier_kh");
  });

  it("gdy dostawca ma ten kh_Id — podpowiedź o reindeksie", () => {
    const supplierByKh = new Map([[688, "Renfert"]]);
    const rows = aggregateZdUnmappedByKh(
      [{ subiekt_kh_id: 688, dok_nr_pelny: "ZD/9", dok_data_wyst: "2026-03-01" }],
      supplierByKh
    );
    expect(rows[0]?.reason).toBe("supplier_exists_reindex");
    expect(rows[0]?.supplierHint).toBe("Renfert");
  });
});
