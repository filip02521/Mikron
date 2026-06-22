/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProductZdLookupModal } from "./ProductZdLookupModal";
import { PRODUCT_ZD_LOOKUP_MODAL } from "@/lib/orders/product-zd-lookup-ui";

vi.mock("@/app/actions/subiekt", () => ({
  actionSubiektSuggestProductsForZdLookup: vi.fn().mockResolvedValue({ ok: true, items: [] }),
}));

vi.mock("@/app/actions/product-zd-lookup", () => ({
  actionLookupProductZdDelivery: vi.fn(),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

describe("ProductZdLookupModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("pokazuje ekran wyszukiwania z intro i polem produktu", () => {
    render(<ProductZdLookupModal open onClose={vi.fn()} suppliers={[]} />);

    expect(screen.getByText(PRODUCT_ZD_LOOKUP_MODAL.title)).toBeTruthy();
    expect(screen.getByText(PRODUCT_ZD_LOOKUP_MODAL.description)).toBeTruthy();
    expect(screen.getByText(PRODUCT_ZD_LOOKUP_MODAL.introSteps[0]!.title)).toBeTruthy();
    expect(screen.getByText(PRODUCT_ZD_LOOKUP_MODAL.searchLabel)).toBeTruthy();
    expect(
      screen.getByPlaceholderText(PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder)
    ).toBeTruthy();
  });
});
