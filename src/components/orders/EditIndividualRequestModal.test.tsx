/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { EditIndividualRequestModal } from "./EditIndividualRequestModal";
import { newProductLine } from "./request-product-lines";
import { actionUpdateMyIndividualRequest } from "@/app/actions/my-orders";

vi.mock("@/app/actions/admin", () => ({
  actionUpdateIndividualRequest: vi.fn(),
}));

vi.mock("@/app/actions/my-orders", () => ({
  actionUpdateMyIndividualRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/subiekt", () => ({
  actionSubiektSuggestionsEnabled: vi.fn().mockResolvedValue({ enabled: false }),
  actionSubiektSuggestProducts: vi.fn().mockResolvedValue({ ok: true, items: [] }),
  actionLookupSupplierFromCatalogTwId: vi.fn(),
}));

vi.mock("@/hooks/useActionPending", () => ({
  useActionPending: () => ({
    pending: false,
    pendingMessage: null,
    run: (fn: () => void) => fn(),
  }),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("@/components/layout/TeethExemptContext", () => ({
  useTeethExemptTwIds: () => new Set<number>([42]),
  useTeethProductInfo: () => ({
    twIds: new Set<number>([42]),
    manufacturerByTwId: new Map(),
    kindByTwId: new Map(),
    productLineByTwId: new Map(),
  }),
  useSupportsDualKindBuilder: () => false,
}));

const initial = {
  supplierId: "",
  salesPersonId: "sp1",
  requestKind: "informacja" as const,
  informacjaPath: "direct" as const,
  lines: [
    {
      ...newProductLine(),
      id: "ord-1",
      product: "Towar testowy",
      symbol: "SYM",
    },
  ],
};

describe("EditIndividualRequestModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("w trybie handlowca pokazuje wybór ścieżki informacji z opcją Brak na stanie", () => {
    render(
      <EditIndividualRequestModal
        open
        onClose={vi.fn()}
        mode="sales"
        orderIds={["ord-1"]}
        initial={initial}
        suppliers={[]}
      />
    );

    const flowPicker = screen.getByRole("radiogroup", { name: /Ścieżka informacji/i });
    expect(within(flowPicker).getByRole("radio", { name: /Informacja o dostępności/i })).toBeTruthy();
    expect(within(flowPicker).getByRole("radio", { name: /Brak na stanie/i })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Najpierw zamówienie u dostawcy/i })).toBeNull();
  });

  it("nie pokazuje pickera ścieżki dla zamówienia", () => {
    render(
      <EditIndividualRequestModal
        open
        onClose={vi.fn()}
        mode="sales"
        orderIds={["ord-1"]}
        initial={{ ...initial, requestKind: "zamowienie", informacjaPath: undefined }}
        suppliers={[]}
      />
    );

    expect(screen.queryByRole("radiogroup", { name: /Ścieżka informacji/i })).toBeNull();
  });

  it("zapisuje ścieżkę Brak na stanie dla handlowca", async () => {
    const onClose = vi.fn();

    render(
      <EditIndividualRequestModal
        open
        onClose={onClose}
        mode="sales"
        orderIds={["ord-1"]}
        initial={initial}
        suppliers={[]}
      />
    );

    const flowPicker = screen.getByRole("radiogroup", { name: /Ścieżka informacji/i });
    fireEvent.click(within(flowPicker).getByRole("radio", { name: /Brak na stanie/i }));
    fireEvent.click(screen.getByRole("button", { name: /Zapisz zmiany/i }));

    expect(actionUpdateMyIndividualRequest).toHaveBeenCalledWith(
      ["ord-1"],
      expect.objectContaining({
        requestKind: "informacja",
        informacjaPath: "stock_out",
      })
    );
  });

  it("pokazuje baner edycji prośby zębowej", () => {
    render(
      <EditIndividualRequestModal
        open
        onClose={vi.fn()}
        mode="procurement"
        orderIds={["ord-1"]}
        initial={{
          ...initial,
          requestKind: "zamowienie",
          lines: [
            {
              ...newProductLine(),
              id: "ord-1",
              product: "Phonares",
              quantity: "4",
              subiektTwId: 42,
            },
          ],
        }}
        suppliers={[]}
        teethRequest
      />
    );

    expect(screen.getByRole("note").textContent).toContain("panel zębów");
    expect(screen.getByRole("heading", { name: "Edycja prośby zębowej" })).toBeTruthy();
  });

  it("zapisuje notatkę dodaną przy edycji prośby bez wcześniejszej notatki", async () => {
    render(
      <EditIndividualRequestModal
        open
        onClose={vi.fn()}
        mode="sales"
        orderIds={["ord-1"]}
        initial={{
          ...initial,
          requestKind: "zamowienie",
          informacjaPath: undefined,
          lines: [
            {
              ...newProductLine(),
              id: "ord-1",
              product: "Towar testowy",
              symbol: "SYM",
              quantity: "1",
            },
          ],
        }}
        suppliers={[]}
      />
    );

    fireEvent.click(screen.getByText(/Notatka do tej pozycji/i));
    fireEvent.change(
      screen.getByPlaceholderText(/klient czeka na potwierdzenie terminu/i),
      {
        target: { value: "pilne — termin piątek" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: /Zapisz zmiany/i }));

    expect(actionUpdateMyIndividualRequest).toHaveBeenCalledWith(
      ["ord-1"],
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            id: "ord-1",
            requestNote: "pilne — termin piątek",
          }),
        ],
      })
    );
  });
});
