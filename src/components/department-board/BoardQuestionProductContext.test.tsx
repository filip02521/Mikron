/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BoardQuestionProductContext } from "./BoardQuestionProductContext";

describe("BoardQuestionProductContext", () => {
  afterEach(cleanup);

  it("renderuje kontekst produktu w rozwiniętym wątku", () => {
    render(
      <BoardQuestionProductContext
        products={[
          {
            product_symbol: "606402",
            product_name: "Implant Straumann",
            subiekt_tw_id: 42,
            mikran_code: "180805",
          },
        ]}
      />
    );

    expect(screen.getByText("Produkt")).toBeTruthy();
    expect(screen.getByText("606402 - Implant Straumann")).toBeTruthy();
    // Symbol jest już w nazwie — bez powtórzenia w linii meta.
    expect(screen.queryByText(/Symbol: 606402/)).toBeNull();
    expect(screen.getByText(/Kod Mikran: 180805/)).toBeTruthy();
  });

  it("nie renderuje się bez danych produktu", () => {
    const { container } = render(
      <BoardQuestionProductContext
        products={[
          {
            product_symbol: null,
            product_name: null,
            subiekt_tw_id: null,
            mikran_code: null,
          },
        ]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("kilka produktów: nagłówek z liczbą, każdy produkt w wierszu z własną prośbą", () => {
    render(
      <BoardQuestionProductContext
        showQuickProsba
        threadId="t1"
        products={[
          { product_symbol: "A-1", product_name: "Wiertło", subiekt_tw_id: 1, mikran_code: null },
          { product_symbol: null, product_name: "Frez", subiekt_tw_id: null, mikran_code: null },
          { product_symbol: null, product_name: null, subiekt_tw_id: null, mikran_code: null },
        ]}
      />
    );
    expect(screen.getByText("Produkty (2)")).toBeTruthy();
    expect(screen.getByText("A-1 - Wiertło")).toBeTruthy();
    expect(screen.getByText("Frez")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Szybka prośba: A-1 - Wiertło" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Szybka prośba: Frez" })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("jeden produkt: jedna szybka prośba w pasku pod spodem", () => {
    render(
      <BoardQuestionProductContext
        showQuickProsba
        products={[{ product_symbol: "A-1", product_name: "Wiertło", subiekt_tw_id: 1, mikran_code: null }]}
      />
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link").textContent).toContain("Szybka prośba");
  });
});
