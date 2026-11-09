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

/** Podpowiedź terminu woła server action — poza zakresem testu formularza. */
vi.mock("@/components/department-board/BoardQuestionZdHint", () => ({
  BoardQuestionZdHint: () => null,
}));

/** Stub pola produktu — bez łańcucha importów Subiekt/Supabase (EnvironmentTeardownError na CI). */
vi.mock("@/components/department-board/BoardQuestionProductField", () => ({
  BoardQuestionProductField: () => <div data-testid="question-product-field-stub" />,
}));

vi.mock("@/app/actions/subiekt", () => ({
  actionSubiektSuggestProductsForZdLookup: vi.fn().mockResolvedValue({ ok: true, items: [] }),
  actionSubiektSuggestionsEnabled: vi.fn().mockResolvedValue({ enabled: false }),
}));

describe("DepartmentBoardQuestionForm", () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    title: "Temat",
    body: "Treść pytania",
    product: { symbol: "", product: "", subiektTwId: null, mikranCode: "" },
    attachments: {
      images: [],
      docs: [],
      issues: [],
      dismissIssues: vi.fn(),
      pendingImages: 0,
      compressing: false,
      addFiles: vi.fn(),
      removeImage: vi.fn(),
      removeDoc: vi.fn(),
      clearImages: vi.fn(),
      imageFiles: [],
      docFiles: [],
      totalBytes: 0,
    },
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

  it("blokuje pola tekstowe podczas wysyłki", () => {
    render(
      <DepartmentBoardQuestionForm {...baseProps} saving />
    );

    expect(screen.getByLabelText("Temat").getAttribute("disabled")).not.toBeNull();
    expect(screen.getByLabelText("Treść").getAttribute("disabled")).not.toBeNull();
  });

  it("przy nieaktywnym Wyślij mówi, czego brakuje", () => {
    render(<DepartmentBoardQuestionForm {...baseProps} title="" body="  " />);
    expect(screen.getAllByText("Wpisz temat i treść pytania.").length).toBeGreaterThan(0);
    cleanup();
    render(<DepartmentBoardQuestionForm {...baseProps} body="" />);
    expect(screen.getAllByText("Wpisz treść pytania.").length).toBeGreaterThan(0);
    cleanup();
    render(<DepartmentBoardQuestionForm {...baseProps} />);
    expect(screen.queryByText(/^Wpisz /)).toBeNull();
  });

  it("upuszczony PDF trafia do załączników; kompresja zdjęcia nie blokuje pisania, tylko wysyłkę", () => {
    const addFiles = vi.fn();
    const attachments = { ...baseProps.attachments, addFiles, compressing: true, pendingImages: 1 };
    render(<DepartmentBoardQuestionForm {...baseProps} attachments={attachments} />);
    const title = screen.getAllByLabelText(/Temat/)[0] as HTMLInputElement;
    expect(title.disabled).toBe(false);
    const send = screen.getAllByRole("button").find((b) => /Przetwarzanie zdjęć/.test(b.textContent ?? "")) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    const pdf = new File(["%PDF-1.7"], "oferta.pdf", { type: "application/pdf" });
    const form = title.closest("div")!.parentElement!;
    fireEvent.drop(form, { dataTransfer: { types: ["Files"], files: [pdf] } });
    expect(addFiles).toHaveBeenCalledWith([pdf]);
  });
});
