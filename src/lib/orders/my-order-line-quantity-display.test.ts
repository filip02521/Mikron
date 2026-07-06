import { describe, expect, it } from "vitest";
import { resolveExpandedLineQuantityDisplay } from "@/lib/orders/my-order-line-quantity-display";
import type { MyOrderLine } from "@/lib/orders/my-order-presenter";
import type { TeethLineDetail } from "@/lib/teeth/teeth-catalog";

function teethRows(count: number, spec: Omit<TeethLineDetail, "position">): TeethLineDetail[] {
  return Array.from({ length: count }, (_, i) => ({
    position: i + 1,
    ...spec,
  }));
}

function line(
  extra: Partial<
    Pick<MyOrderLine, "quantityLabel" | "progressLabel" | "teethDetails">
  > = {}
): Pick<MyOrderLine, "quantityLabel" | "progressLabel" | "teethDetails"> {
  return {
    quantityLabel: "4 szt.",
    progressLabel: "wszystkie 4 szt.",
    teethDetails: teethRows(4, {
      color: "B3",
      mould: "NU6",
      kind: "posterior",
      jaw: "lower",
    }),
    ...extra,
  };
}

describe("resolveExpandedLineQuantityDisplay", () => {
  it("przy zębach w compact — zostawia tylko chipy (bez szt. w nagłówku i progress)", () => {
    const result = resolveExpandedLineQuantityDisplay(line(), {
      compact: true,
      showProgress: true,
    });
    expect(result.quantityLabel).toBeNull();
    expect(result.progressInDetail).toBeNull();
  });

  it("przy częściowym wycofaniu — zostawia adnotację, bez progress", () => {
    const result = resolveExpandedLineQuantityDisplay(
      line({
        quantityLabel: "3 szt. (z 6 · 3 wycofane)",
        progressLabel: "wszystkie 6 szt.",
        teethDetails: teethRows(3, {
          color: "A1",
          mould: "S62",
          kind: "anterior",
          jaw: "upper",
        }),
      }),
      { compact: true, showProgress: true }
    );
    expect(result.quantityLabel).toBe("(z 6 · 3 wycofane)");
    expect(result.progressInDetail).toBeNull();
  });

  it("poza compact — bez zmian", () => {
    const result = resolveExpandedLineQuantityDisplay(line(), {
      compact: false,
      showProgress: true,
    });
    expect(result.quantityLabel).toBe("4 szt.");
    expect(result.progressInDetail).toBe("wszystkie 4 szt.");
  });

  it("zwykły produkt — ukrywa progress powtarzający quantityLabel", () => {
    const result = resolveExpandedLineQuantityDisplay(
      line({ teethDetails: undefined, progressLabel: "wszystkie 4 szt." }),
      { compact: true, showProgress: true }
    );
    expect(result.quantityLabel).toBe("4 szt.");
    expect(result.progressInDetail).toBeNull();
  });

  it("magazyn grupy — ukrywa „0 z 3 szt.” przy pozycji", () => {
    const result = resolveExpandedLineQuantityDisplay(
      line({ teethDetails: undefined, progressLabel: "0 z 3 szt." }),
      { compact: true, showProgress: true, hideWarehouseProgress: true }
    );
    expect(result.progressInDetail).toBeNull();
  });
});
