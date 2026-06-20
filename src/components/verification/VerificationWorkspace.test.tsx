/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { IndividualOrder } from "@/types/database";
import { VerificationWorkspace } from "./VerificationWorkspace";

const mockRefresh = vi.fn();
const mockComplete = vi.fn();
const mockCancel = vi.fn();
const mockLookup = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/app/actions/admin", () => ({
  actionCompleteVerification: (...args: unknown[]) => mockComplete(...args),
  actionCancelVerification: (...args: unknown[]) => mockCancel(...args),
}));

vi.mock("@/app/actions/subiekt", () => ({
  actionLookupSupplierFromCatalogTwId: (...args: unknown[]) => mockLookup(...args),
  actionSubiektSuggestProducts: vi.fn().mockResolvedValue({ ok: true, items: [] }),
  actionSubiektSuggestionsEnabled: vi.fn().mockResolvedValue({ enabled: false }),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("@/components/orders/SupplierPickerField", () => ({
  SupplierPickerField: ({
    value,
    onChange,
    suppliers,
  }: {
    value: string;
    onChange: (id: string) => void;
    suppliers: Array<{ id: string; name: string }>;
  }) => (
    <select
      aria-label="Dostawca"
      data-testid="supplier-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/components/subiekt/SubiektProductLineFields", () => ({
  SubiektProductLineFields: ({
    value,
    onChange,
  }: {
    value: {
      symbol: string;
      product: string;
      quantity: string;
      mikranCode: string;
      subiektTwId?: number | null;
    };
    onChange: (patch: Partial<typeof value>) => void;
  }) => (
    <div data-testid="product-fields">
      <input
        aria-label="Symbol"
        data-testid="product-symbol"
        value={value.symbol}
        onChange={(e) => onChange({ symbol: e.target.value })}
      />
      <input
        aria-label="Produkt"
        data-testid="product-name"
        value={value.product}
        onChange={(e) => onChange({ product: e.target.value })}
      />
      <input
        aria-label="Ilość"
        data-testid="product-qty"
        value={value.quantity}
        onChange={(e) => onChange({ quantity: e.target.value })}
      />
    </div>
  ),
}));

const salesPeople = [{ id: "sp-1", name: "Jan Kowalski" }];
const suppliers = [
  { id: "sup-a", name: "Dostawca A", subiekt_kh_id: 100 },
  { id: "sup-b", name: "Dostawca B", subiekt_kh_id: null },
];

function baseOrder(overrides: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "o1",
    supplier_id: null,
    sales_person_id: "sp-1",
    symbol: "-",
    products: "Do uzupełnienia",
    quantity: "-",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Weryfikacja",
    action_at: "2026-05-01T10:00:00Z",
    ordered_at: null,
    delivery_at: null,
    sales_person: { id: "sp-1", name: "Jan Kowalski", email: "jan@test.pl" },
    ...overrides,
  };
}

describe("VerificationWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComplete.mockResolvedValue({ success: true });
    mockLookup.mockResolvedValue({ ok: true, supplierId: "sup-a" });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("pokazuje pusty stan bez pozycji w kolejce", () => {
    render(
      <VerificationWorkspace orders={[]} suppliers={suppliers} salesPeople={salesPeople} />
    );
    expect(screen.getByText("Brak pozycji do weryfikacji")).toBeTruthy();
  });

  it("wczytuje handlowca, produkt i dostawcę z zamówienia", async () => {
    const order = baseOrder({
      supplier_id: "sup-b",
      symbol: "SR6",
      products: "Śruba M6",
      quantity: "3",
    });

    render(
      <VerificationWorkspace orders={[order]} suppliers={suppliers} salesPeople={salesPeople} />
    );

    expect(screen.getByText("Uzupełnianie prośby")).toBeTruthy();
    expect((screen.getByTestId("supplier-picker") as HTMLSelectElement).value).toBe("sup-b");
    expect((screen.getByLabelText("Dla kogo (handlowiec)") as HTMLSelectElement).value).toBe("sp-1");
    expect((screen.getByTestId("product-symbol") as HTMLInputElement).value).toBe("SR6");
    expect((screen.getByTestId("product-name") as HTMLInputElement).value).toBe("Śruba M6");
    expect((screen.getByTestId("product-qty") as HTMLInputElement).value).toBe("3");
  });

  it("dopasowuje dostawcę po subiekt_tw_id gdy brak supplier_id", async () => {
    const order = baseOrder({
      subiekt_tw_id: 9001,
      supplier_id: null,
    });

    render(
      <VerificationWorkspace orders={[order]} suppliers={suppliers} salesPeople={salesPeople} />
    );

    await waitFor(() => {
      expect(mockLookup).toHaveBeenCalledWith(
        9001,
        expect.arrayContaining([
          expect.objectContaining({ id: "sup-a", subiektKhId: 100 }),
          expect.objectContaining({ id: "sup-b", subiektKhId: null }),
        ])
      );
    });

    await waitFor(() => {
      expect((screen.getByTestId("supplier-picker") as HTMLSelectElement).value).toBe("sup-a");
    });
  });

  it("przełącza formularz po wyborze innej prośby w kolejce", async () => {
    const first = baseOrder({
      id: "o1",
      supplier_id: "sup-a",
      symbol: "A",
      products: "Produkt A",
      quantity: "1",
    });
    const second = baseOrder({
      id: "o2",
      supplier_id: "sup-b",
      symbol: "B",
      products: "Produkt B",
      quantity: "2",
      sales_person_id: "sp-1",
    });

    render(
      <VerificationWorkspace
        orders={[first, second]}
        suppliers={suppliers}
        salesPeople={salesPeople}
      />
    );

    expect((screen.getByTestId("product-name") as HTMLInputElement).value).toBe("Produkt A");

    const queueItems = screen.getAllByRole("option");
    fireEvent.click(queueItems.find((el) => el.textContent?.includes("Produkt B"))!);

    await waitFor(() => {
      expect((screen.getByTestId("product-name") as HTMLInputElement).value).toBe("Produkt B");
      expect((screen.getByTestId("supplier-picker") as HTMLSelectElement).value).toBe("sup-b");
    });
  });

  it("blokuje zatwierdzenie gdy formularz niekompletny", () => {
    render(
      <VerificationWorkspace
        orders={[baseOrder()]}
        suppliers={suppliers}
        salesPeople={salesPeople}
      />
    );

    const submit = screen.getByRole("button", { name: /Zatwierdź/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("zapisuje kompletne zgłoszenie z danymi formularza", async () => {
    const order = baseOrder({
      supplier_id: "sup-a",
      symbol: "XYZ",
      products: "Gumka",
      quantity: "1",
    });

    render(
      <VerificationWorkspace orders={[order]} suppliers={suppliers} salesPeople={salesPeople} />
    );

    const submit = screen.getByRole("button", { name: /Zatwierdź/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith("o1", {
        supplierId: "sup-a",
        salesPersonId: "sp-1",
        symbol: "XYZ",
        mikranCode: "",
        product: "Gumka",
        quantity: "1",
        requestKind: "zamowienie",
        subiektTwId: null,
        informacjaPath: undefined,
      });
    });
  });

  it("pokazuje liczbę brakujących pól w kolejce", () => {
    render(
      <VerificationWorkspace
        orders={[baseOrder()]}
        suppliers={suppliers}
        salesPeople={salesPeople}
      />
    );

    expect(screen.getByText(/Brakuje 3/i)).toBeTruthy();
  });
});
