/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DepartmentBoardQuestionForm } from "./DepartmentBoardQuestionForm";

vi.mock("@/components/ui/ModalShell", () => ({
  ModalShell: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="question-modal">{children}</div> : null),
}));

vi.mock("@/app/actions/subiekt", () => ({
  actionSubiektSuggestProductsForZdLookup: vi.fn().mockResolvedValue({ ok: true, items: [] }),
  actionSubiektSuggestionsEnabled: vi.fn().mockResolvedValue({ enabled: false }),
}));

describe("DepartmentBoardQuestionForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const baseProps = {
    title: "Temat",
    body: "Treść pytania",
    product: { symbol: "", product: "", subiektTwId: null, mikranCode: "" },
    error: null,
    saving: false,
    tourDemo: false,
    defaultExpanded: true,
    hasQuestions: false,
    onTitleChange: vi.fn(),
    onBodyChange: vi.fn(),
    onProductChange: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
  };

  it("nie zamyka modala mobile po błędzie wysyłki", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Błąd sieci"));
    render(
      <DepartmentBoardQuestionForm {...baseProps} onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByLabelText("Zadaj pytanie"));
    expect(screen.getByTestId("question-modal")).toBeTruthy();

    const modal = screen.getByTestId("question-modal");
    fireEvent.click(within(modal).getByRole("button", { name: "Wyślij" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(screen.getByTestId("question-modal")).toBeTruthy();
  });

  it("zamyka modala mobile po udanej wysyłce", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <DepartmentBoardQuestionForm {...baseProps} onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByLabelText("Zadaj pytanie"));
    const modal = screen.getByTestId("question-modal");
    fireEvent.click(within(modal).getByRole("button", { name: "Wyślij" }));

    await vi.waitFor(() => {
      expect(screen.queryByTestId("question-modal")).toBeNull();
    });
  });
});
