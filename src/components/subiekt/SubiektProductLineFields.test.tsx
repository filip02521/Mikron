/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SubiektProductLineFields } from "./SubiektProductLineFields";

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

describe("SubiektProductLineFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(within(view.container).getByText("Ilość (wymagane)")).toBeTruthy();
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
});
