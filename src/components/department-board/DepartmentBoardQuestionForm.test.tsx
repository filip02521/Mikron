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
  BoardQuestionProductField: ({ label, onRemoveRow }: { label?: string; onRemoveRow?: () => void }) => (
    <div data-testid="question-product-field-stub" data-removable={onRemoveRow ? "yes" : "no"}>
      {label}
    </div>
  ),
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
    products: [{ key: "p1", draft: { symbol: "", product: "", subiektTwId: null, mikranCode: "" } }],
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
    onAddProduct: vi.fn(),
    onRemoveProduct: vi.fn(),
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

  it("kolejny produkt: przycisk dopiero, gdy wiersz ma produkt; numeracja i usuwanie od drugiego", () => {
    const filled = { symbol: "A-1", product: "Wiertło", subiektTwId: 5, mikranCode: "" };
    const empty = { symbol: "", product: "", subiektTwId: null, mikranCode: "" };
    render(<DepartmentBoardQuestionForm {...baseProps} />);
    expect(screen.queryAllByRole("button", { name: /Dodaj kolejny produkt/ })).toHaveLength(0);
    expect(screen.getAllByTestId("question-product-field-stub")[0].textContent).toBe("Produkt (opcjonalnie)");
    cleanup();

    const onAddProduct = vi.fn();
    render(
      <DepartmentBoardQuestionForm {...baseProps} products={[{ key: "p1", draft: filled }]} onAddProduct={onAddProduct} />
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Dodaj kolejny produkt/ })[0]);
    expect(onAddProduct).toHaveBeenCalledTimes(1);
    cleanup();

    render(
      <DepartmentBoardQuestionForm
        {...baseProps}
        products={[
          { key: "p1", draft: filled },
          { key: "p2", draft: empty },
        ]}
      />
    );
    const stubs = screen.getAllByTestId("question-product-field-stub").slice(0, 2);
    expect(stubs.map((s) => s.textContent)).toEqual(["Produkt 1", "Produkt 2"]);
    expect(stubs.map((s) => s.dataset.removable)).toEqual(["no", "yes"]);
    // Pusty drugi wiersz: najpierw go wypełnij, potem kolejny.
    expect(screen.queryAllByRole("button", { name: /Dodaj kolejny produkt/ })).toHaveLength(0);
  });
});
