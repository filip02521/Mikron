import { describe, expect, it } from "vitest";

/**
 * Symulacja paginacji wierszy linków — regresja: nie kończymy po pierwszej stronie,
 * gdy jest więcej wierszy niż unikalnych tw_Id.
 */
function collectLinkedTwIdsFromLinkRows(
  allRows: Array<{ subiekt_tw_id: number; supplier_id: string }>,
  pageSize: number
): Set<number> {
  const linked = new Set<number>();
  let offset = 0;
  while (true) {
    const batch = allRows
      .sort(
        (a, b) =>
          a.subiekt_tw_id - b.subiekt_tw_id || a.supplier_id.localeCompare(b.supplier_id)
      )
      .slice(offset, offset + pageSize);
    for (const row of batch) {
      linked.add(row.subiekt_tw_id);
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return linked;
}

describe("collectLinkedTwIdsFromLinkRows", () => {
  it("zbiera wszystkie tw_Id mimo wielu dostawców na jeden produkt", () => {
    const rows: Array<{ subiekt_tw_id: number; supplier_id: string }> = [];
    for (let tw = 1; tw <= 5; tw++) {
      for (let s = 0; s < 300; s++) {
        rows.push({ subiekt_tw_id: tw, supplier_id: `s-${s}` });
      }
    }
    const linked = collectLinkedTwIdsFromLinkRows(rows, 1000);
    expect(linked.size).toBe(5);
  });

  it("stary błąd: jedna strona bez drugiego przebiegu gubi tw_Id", () => {
    const rows: Array<{ subiekt_tw_id: number; supplier_id: string }> = [];
    for (let s = 0; s < 1500; s++) {
      rows.push({ subiekt_tw_id: 1, supplier_id: `s-${s}` });
    }
    rows.push({ subiekt_tw_id: 99, supplier_id: "only" });

    const onePage = new Set(
      rows
        .sort(
          (a, b) =>
            a.subiekt_tw_id - b.subiekt_tw_id || a.supplier_id.localeCompare(b.supplier_id)
        )
        .slice(0, 1000)
        .map((r) => r.subiekt_tw_id)
    );
    expect(onePage.has(99)).toBe(false);

    const full = collectLinkedTwIdsFromLinkRows(rows, 1000);
    expect(full.has(99)).toBe(true);
  });
});
