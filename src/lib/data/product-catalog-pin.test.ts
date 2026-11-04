import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/pool", () => ({ query: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { collectLinksToRestore } from "@/lib/data/product-catalog";
import { formatCatalogSupplierSubtitle, type ProductCatalogRow } from "@/lib/data/product-catalog-shared";

const link = (supplier_id: string, order_count: number) => ({
  supplier_id,
  order_count,
  last_action_at: "2026-11-04T10:00:00Z",
  last_order_id: null,
  last_source: "zd_import",
  note: "",
});

describe("collectLinksToRestore", () => {
  it("zbiera migawki od ostatniego odpięcia, najnowsza wygrywa", () => {
    const out = collectLinksToRestore([
      { manualAdmin: true, removedLinks: [link("sep", 5)] },
      { manualAdmin: true, removedLinks: [link("sep", 88), link("dent", 3)] },
      { manualUnpin: true },
      { manualAdmin: true, removedLinks: [link("stary", 1)] },
    ]);
    expect(out.map((l) => [l.supplier_id, l.order_count])).toEqual([
      ["sep", 5],
      ["dent", 3],
    ]);
  });

  it("stare przypięcia bez migawki nic nie zwracają", () => {
    expect(collectLinksToRestore([{ manualAdmin: true }])).toEqual([]);
  });
});

describe("formatCatalogSupplierSubtitle — przypięcie", () => {
  const base: ProductCatalogRow = {
    subiektTwId: 2134,
    symbol: "40/0,5",
    name: "Motyl tarcza zbrojona 40/0,5 żółta",
    plu: null,
    note: "",
    lastSeenAt: "",
    totalOrders: 179,
    topSupplier: { id: "tarcze", name: "MOTYL-Pro (tarcze)", orderCount: 89 },
    lastActionAt: null,
    manualSupplierId: null,
  };

  it("oznacza ręcznie przypiętego dostawcę", () => {
    expect(formatCatalogSupplierSubtitle({ ...base, manualSupplierId: "tarcze" }, null, null)).toBe(
      "MOTYL-Pro (tarcze) (89) · ręcznie"
    );
  });

  it("w trybie auto bez dopisku", () => {
    expect(formatCatalogSupplierSubtitle(base, null, null)).toBe("MOTYL-Pro (tarcze) (89)");
  });
});
