/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { SubiektProductLineFields } from "./SubiektProductLineFields";
import type { SubiektProductLineValue } from "./SubiektProductLineFields";
import {
  actionSubiektSuggestProducts,
  actionSubiektSuggestionsEnabled,
} from "@/app/actions/subiekt";

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("@/app/actions/subiekt", () => ({
  actionSubiektSuggestProducts: vi.fn().mockResolvedValue({
    ok: true,
    items: [],
  }),
  actionSubiektSuggestionsEnabled: vi.fn().mockResolvedValue({
    enabled: false,
  }),
}));

const baseValue = {
  symbol: "",
  mikranCode: "",
  product: "",
  quantity: "1",
};

const subiektProduct = {
  tw_Id: 1001,
  tw_Symbol: "4200",
  tw_Nazwa: "Gumka test",
  tw_PLU: "789",
};

function ControlledSubiektLine({
  initialValue = baseValue,
  ...props
}: Omit<
  ComponentProps<typeof SubiektProductLineFields>,
  "value" | "onChange"
> & { initialValue?: SubiektProductLineValue }) {
  const [value, setValue] = useState(initialValue);
  return (
    <SubiektProductLineFields
      {...props}
      value={value}
      onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
    />
  );
}

describe("SubiektProductLineFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: false });
    vi.mocked(actionSubiektSuggestProducts).mockResolvedValue({
      ok: true,
      items: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renderuje scalony układ także w appearance default", () => {
    render(
      <SubiektProductLineFields
        appearance="default"
        requestKind="zamowienie"
        value={baseValue}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Produkt — symbol lub nazwa")).toBeTruthy();
    expect(screen.getByPlaceholderText("896")).toBeTruthy();
    expect(screen.queryByLabelText(/^Symbol$/i)).toBeNull();
  });

  it("pokazuje podgląd symbolu pod nazwą", () => {
    render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="zamowienie"
        value={{
          ...baseValue,
          symbol: "SR6",
          product: "Śruba M6",
        }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Symbol w Subiekcie:/)).toBeTruthy();
    expect(screen.getByText("SR6")).toBeTruthy();
  });

  it("pokazuje jeden komunikat Powiązano z Subiektem z metadanymi", () => {
    render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="zamowienie"
        value={{
          ...baseValue,
          symbol: "4200",
          product: "Gumka test",
          mikranCode: "789",
          subiektTwId: 1001,
        }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Powiązano z Subiektem")).toBeTruthy();
    expect(screen.getByText(/Powiązano z Subiektem/)).toBeTruthy();
    expect(screen.getByText(/Symbol: 4200/)).toBeTruthy();
    expect(screen.getByText(/Kod Mikran: 789/)).toBeTruthy();
    expect(screen.queryAllByLabelText("Wybrano z Subiekta")).toHaveLength(0);
  });

  it("wywołuje onChange przy wpisie w scalonym polu", () => {
    const onChange = vi.fn();
    const view = render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="zamowienie"
        value={baseValue}
        onChange={onChange}
      />
    );

    const input = within(view.container).getByPlaceholderText(
      "Nazwa lub symbol produktu"
    );
    fireEvent.change(input, { target: { value: "wkręt" } });

    expect(onChange).toHaveBeenCalled();
    const patch = onChange.mock.calls.at(-1)?.[0];
    expect(patch).toMatchObject({ product: "wkręt", symbol: "" });
    expect(patch.subiektTwId).toBeNull();
  });

  it("renderuje pole ilości przy zamówieniu", () => {
    const view = render(
      <SubiektProductLineFields
        appearance="default"
        requestKind="zamowienie"
        value={baseValue}
        onChange={vi.fn()}
      />
    );

    expect(within(view.container).getByText("Ilość")).toBeTruthy();
    expect(within(view.container).getByLabelText("Ilość sztuk")).toBeTruthy();
  });

  it("pokazuje hint gdy wypełniono tylko kod Mikran", () => {
    render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="zamowienie"
        value={{ ...baseValue, mikranCode: "896" }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Kod Mikran wystarczy/)).toBeTruthy();
  });

  it("odpina Subiekt po Zmień towar", () => {
    const onChange = vi.fn();
    render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="zamowienie"
        value={{
          ...baseValue,
          symbol: "4200",
          product: "Gumka test",
          mikranCode: "789",
          subiektTwId: 1001,
        }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Zmień towar" }));
    expect(onChange).toHaveBeenCalledWith({ subiektTwId: null });
  });

  it("nie renderuje ilości przy prośbie typu informacja", () => {
    render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="informacja"
        value={{ ...baseValue, quantity: "" }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Ilość sztuk")).toBeNull();
    expect(screen.queryByText("Ilość")).toBeNull();
  });

  it("aktualizuje ilość niezależnie od pól Subiekta", () => {
    const onChange = vi.fn();
    render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="zamowienie"
        value={{ ...baseValue, quantity: "1" }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Ilość sztuk"), {
      target: { value: "5" },
    });

    expect(onChange).toHaveBeenCalledWith({ quantity: "5" });
  });

  it("pokazuje typeahead Subiekta pod polem produktu", async () => {
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: true });
    vi.mocked(actionSubiektSuggestProducts).mockResolvedValue({
      ok: true,
      items: [subiektProduct],
    });

    render(
      <ControlledSubiektLine
        appearance="prosba"
        requestKind="zamowienie"
        initialValue={baseValue}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Szukaj w Subiekcie: nazwa lub symbol…")
      ).toBeTruthy()
    );

    fireEvent.change(
      screen.getByPlaceholderText("Szukaj w Subiekcie: nazwa lub symbol…"),
      { target: { value: "gum" } }
    );

    await waitFor(() => {
      expect(actionSubiektSuggestProducts).toHaveBeenCalledWith("gum", "combined");
    });
    expect(screen.getByText(/Subiekt — po symbolu i nazwie/)).toBeTruthy();
    expect(screen.getByText(/4200 — Gumka test/)).toBeTruthy();
  });

  it("zachowuje ilość po wyborze towaru z Subiekta", async () => {
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: true });
    vi.mocked(actionSubiektSuggestProducts).mockResolvedValue({
      ok: true,
      items: [subiektProduct],
    });

    const onChange = vi.fn();
    function PickHarness() {
      const [value, setValue] = useState({ ...baseValue, quantity: "3" });
      return (
        <SubiektProductLineFields
          appearance="prosba"
          requestKind="zamowienie"
          value={value}
          onChange={(patch) => {
            setValue((prev) => ({ ...prev, ...patch }));
            onChange(patch);
          }}
        />
      );
    }

    render(<PickHarness />);

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Szukaj w Subiekcie: nazwa lub symbol…")
      ).toBeTruthy()
    );

    fireEvent.change(
      screen.getByPlaceholderText("Szukaj w Subiekcie: nazwa lub symbol…"),
      { target: { value: "gum" } }
    );

    await waitFor(() => screen.getByText(/4200 — Gumka test/));
    fireEvent.click(screen.getByText(/4200 — Gumka test/));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "4200",
        product: "Gumka test",
        mikranCode: "789",
        quantity: "3",
        subiektTwId: 1001,
      })
    );
  });

  it("po powiązaniu z Subiektem ukrywa podgląd symbolu i listę wyników", async () => {
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: true });

    render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="zamowienie"
        value={{
          ...baseValue,
          symbol: "4200",
          product: "Gumka test",
          mikranCode: "789",
          subiektTwId: 1001,
        }}
        onChange={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(actionSubiektSuggestionsEnabled).toHaveBeenCalled()
    );

    expect(screen.queryByText(/Symbol w Subiekcie:/)).toBeNull();
    expect(actionSubiektSuggestProducts).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Powiązano z Subiektem")).toBeTruthy();
  });

  it("w trybie prośby nie pokazuje statycznego bloku informacji o polach", async () => {
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: true });

    render(
      <SubiektProductLineFields
        appearance="prosba"
        requestKind="zamowienie"
        value={baseValue}
        onChange={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(actionSubiektSuggestionsEnabled).toHaveBeenCalled()
    );

    expect(screen.queryByText(/Informacje — produkt/i)).toBeNull();
    expect(screen.queryByText(/Kod Mikran i ilość obok/)).toBeNull();
    expect(
      screen.getByPlaceholderText(/Szukaj w Subiekcie/i)
    ).toBeTruthy();
  });
});
