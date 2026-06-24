/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductZdLookupModal } from "./ProductZdLookupModal";
import { PRODUCT_ZD_LOOKUP_MODAL } from "@/lib/orders/product-zd-lookup-ui";
import { actionLookupProductZdDelivery } from "@/app/actions/product-zd-lookup";
import { actionSubiektSuggestProductsForZdLookup } from "@/app/actions/subiekt";

vi.mock("@/app/actions/subiekt", () => ({
  actionSubiektSuggestProductsForZdLookup: vi.fn().mockResolvedValue({ ok: true, items: [] }),
}));

vi.mock("@/app/actions/product-zd-lookup", () => ({
  actionLookupProductZdDelivery: vi.fn(),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

const sampleProduct = {
  tw_Id: 16012,
  tw_Symbol: "MSDHLGY-104C",
  tw_Nazwa: "Craftsman",
};

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

  it("pokazuje termin ZD po znalezieniu otwartego dokumentu", async () => {
    vi.mocked(actionSubiektSuggestProductsForZdLookup).mockResolvedValue({
      ok: true,
      items: [sampleProduct],
    });
    vi.mocked(actionLookupProductZdDelivery).mockResolvedValue({
      status: "found",
      supplierId: "s-any",
      supplierName: "Anycubic",
      matches: [
        {
          dokId: 1747405,
          dokNr: "ZD 197/M/02/2026",
          deadline: "2026-07-03",
          supplierId: "s-any",
          supplierName: "Anycubic",
          quantity: 3,
        },
      ],
    });

    const user = { type: (el: HTMLElement, text: string) => fireEvent.change(el, { target: { value: text } }) };
    render(<ProductZdLookupModal open onClose={vi.fn()} suppliers={[]} />);

    user.type(
      screen.getByPlaceholderText(PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder),
      "MSDHLGY"
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /MSDHLGY-104C/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("option", { name: /MSDHLGY-104C/i }));

    await waitFor(() => {
      expect(screen.getByText("ZD 197/M/02/2026")).toBeTruthy();
    });
    expect(screen.getByText("Termin z dokumentu ZD")).toBeTruthy();
    expect(screen.getByText("03.07.2026")).toBeTruthy();
  });

  it("pokazuje prośbę o dostawcę gdy brak powiązania w bazie", async () => {
    vi.mocked(actionSubiektSuggestProductsForZdLookup).mockResolvedValue({
      ok: true,
      items: [sampleProduct],
    });
    vi.mocked(actionLookupProductZdDelivery).mockResolvedValue({
      status: "needs_supplier",
      message: "Wybierz dostawcę ręcznie.",
    });

    render(
      <ProductZdLookupModal
        open
        onClose={vi.fn()}
        suppliers={[{ id: "s1", name: "Test Supplier", subiekt_kh_id: 100 }]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder), {
      target: { value: "MSDHLGY" },
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /MSDHLGY-104C/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("option", { name: /MSDHLGY-104C/i }));

    await waitFor(() => {
      expect(screen.getByText("Wybierz dostawcę ręcznie.")).toBeTruthy();
    });
    expect(screen.getByText(PRODUCT_ZD_LOOKUP_MODAL.searchWithSupplier)).toBeTruthy();
  });

  it("wybiera produkt strzałkami i Enter", async () => {
    const secondProduct = { tw_Id: 99999, tw_Symbol: "OTHER-1", tw_Nazwa: "Inny produkt" };
    vi.mocked(actionSubiektSuggestProductsForZdLookup).mockResolvedValue({
      ok: true,
      items: [sampleProduct, secondProduct],
    });
    vi.mocked(actionLookupProductZdDelivery).mockResolvedValue({
      status: "found",
      supplierId: "s-any",
      supplierName: "Anycubic",
      matches: [
        {
          dokId: 1,
          dokNr: "ZD 1/2026",
          deadline: "2026-07-03",
          supplierId: "s-any",
          supplierName: "Anycubic",
          quantity: 1,
        },
      ],
    });

    render(<ProductZdLookupModal open onClose={vi.fn()} suppliers={[]} />);

    fireEvent.change(screen.getByPlaceholderText(PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder), {
      target: { value: "MSD" },
    });
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    const input = screen.getByPlaceholderText(PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(actionLookupProductZdDelivery).toHaveBeenCalledWith(
        expect.objectContaining({ tw_Id: 99999 }),
        expect.anything()
      );
    });
  });

  it("pokazuje szacowany termin z prośby gdy brak ZD", async () => {
    vi.mocked(actionSubiektSuggestProductsForZdLookup).mockResolvedValue({
      ok: true,
      items: [sampleProduct],
    });
    vi.mocked(actionLookupProductZdDelivery).mockResolvedValue({
      status: "no_match",
      supplierId: "s-any",
      supplierName: "Anycubic",
      searchIncomplete: false,
      appOrderHint: {
        orderId: "ord-1",
        orderedAt: "2026-06-01",
        orderType: "Glowne",
        estimatedDeadline: "2026-06-20",
        estimateLabel: "ok. 20.06.2026 · ~15 dni rob.",
        lowConfidence: false,
      },
    });

    const user = { type: (el: HTMLElement, text: string) => fireEvent.change(el, { target: { value: text } }) };
    render(<ProductZdLookupModal open onClose={vi.fn()} suppliers={[]} />);

    user.type(
      screen.getByPlaceholderText(PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder),
      "MSDHLGY"
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /MSDHLGY-104C/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("option", { name: /MSDHLGY-104C/i }));

    await waitFor(() => {
      expect(screen.getByText(/Szacowany termin z prośby/)).toBeTruthy();
    });
    expect(screen.getByText(/~15 dni rob/)).toBeTruthy();
    expect(screen.getByText(PRODUCT_ZD_LOOKUP_MODAL.noZdWarehouseNote)).toBeTruthy();
  });

  it("zamyka panel produktu Esc podczas ładowania (nie zamyka modala)", async () => {
    vi.mocked(actionSubiektSuggestProductsForZdLookup).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ProductZdLookupModal open onClose={vi.fn()} suppliers={[]} />);

    fireEvent.change(screen.getByPlaceholderText(PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder), {
      target: { value: "MSDHLGY" },
    });

    const input = screen.getByPlaceholderText(PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder);
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByText("Szukam w Subiekcie…")).toBeNull();
    expect(screen.getByText(PRODUCT_ZD_LOOKUP_MODAL.title)).toBeTruthy();
  });
});
