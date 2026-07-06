/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { BoardQuestionProductField } from "./BoardQuestionProductField";
import {
  actionSubiektSuggestProductsForZdLookup,
  actionSubiektSuggestionsEnabled,
} from "@/app/actions/subiekt";
import {
  emptyBoardQuestionProductDraft,
  type BoardQuestionProductDraft,
} from "@/lib/department-board/question-product";

vi.mock("@/app/actions/subiekt", () => ({
  actionSubiektSuggestProductsForZdLookup: vi.fn(),
  actionSubiektSuggestionsEnabled: vi.fn().mockResolvedValue({ enabled: true }),
}));

function ProductFieldHarness() {
  const [value, setValue] = useState<BoardQuestionProductDraft>(emptyBoardQuestionProductDraft());
  return (
    <BoardQuestionProductField
      value={value}
      onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
      idPrefix="test"
    />
  );
}

describe("BoardQuestionProductField", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("po wpisaniu nazwy wysyła zapytanie do Subiekta", async () => {
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: true });
    vi.mocked(actionSubiektSuggestProductsForZdLookup).mockResolvedValue({
      ok: true,
      items: [],
      feedback: undefined,
    });

    render(<ProductFieldHarness />);

    await waitFor(() => {
      expect(actionSubiektSuggestionsEnabled).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "implant" } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    await waitFor(() => {
      expect(actionSubiektSuggestProductsForZdLookup).toHaveBeenCalledWith("implant");
    });
  });

  it("po wpisaniu kodu Mikran (PLU) wysyła zapytanie od jednej cyfry", async () => {
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: true });
    vi.mocked(actionSubiektSuggestProductsForZdLookup).mockResolvedValue({
      ok: true,
      items: [],
      feedback: undefined,
    });

    render(<ProductFieldHarness />);

    await waitFor(() => {
      expect(actionSubiektSuggestionsEnabled).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "896" } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    await waitFor(() => {
      expect(actionSubiektSuggestProductsForZdLookup).toHaveBeenCalledWith("896");
    });
  });

  it("po opuszczeniu pola zapisuje ręcznie wpisany produkt jako wybrany", async () => {
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: false });

    render(<ProductFieldHarness />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Implant ręczny" } });
    fireEvent.blur(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByText("Wybrano")).toBeTruthy();
      expect(screen.getByText("Implant ręczny")).toBeTruthy();
      expect(screen.queryByRole("combobox")).toBeNull();
    });
  });

  it("po wyborze z listy pokazuje kartę wybranego produktu", async () => {
    vi.mocked(actionSubiektSuggestionsEnabled).mockResolvedValue({ enabled: true });
    vi.mocked(actionSubiektSuggestProductsForZdLookup).mockResolvedValue({
      ok: true,
      items: [
        {
          tw_Id: 202,
          tw_Symbol: "SYM-896",
          tw_Nazwa: "Produkt po PLU",
          tw_PLU: "896",
        },
      ],
      feedback: undefined,
    });

    render(<ProductFieldHarness />);

    await waitFor(() => {
      expect(actionSubiektSuggestionsEnabled).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "896" } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    await waitFor(() => {
      expect(screen.getByText(/SYM-896 — Produkt po PLU/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/SYM-896 — Produkt po PLU/i));

    await waitFor(() => {
      expect(screen.getByText("Wybrano z Subiekta")).toBeTruthy();
      expect(screen.getByText(/SYM-896 — Produkt po PLU/i)).toBeTruthy();
      expect(screen.queryByRole("combobox")).toBeNull();
    });
  });
});
