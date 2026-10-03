/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BoardQuestionProductContext } from "./BoardQuestionProductContext";

describe("BoardQuestionProductContext", () => {
  it("renderuje kontekst produktu w rozwiniętym wątku", () => {
    render(
      <BoardQuestionProductContext
        product={{
          product_symbol: "606402",
          product_name: "Implant Straumann",
          subiekt_tw_id: 42,
          mikran_code: "180805",
        }}
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
        product={{
          product_symbol: null,
          product_name: null,
          subiekt_tw_id: null,
          mikran_code: null,
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
