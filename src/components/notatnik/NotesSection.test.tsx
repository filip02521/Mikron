/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { testSalesNote } from "@/test-utils/fixtures";
import { NotesSection } from "./NotesSection";

vi.mock("@/app/actions/sales-notepad", () => ({
  actionArchiveSalesNote: vi.fn(),
  actionCreateSalesNote: vi.fn(),
  actionReorderSalesNotes: vi.fn(),
  actionUpdateSalesNote: vi.fn(),
}));

describe("NotesSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renderuje karteczki z tytułem i treścią", () => {
    render(
      <NotesSection
        embedded
        notes={[
          testSalesNote({
            id: "n1",
            title: "Do oddzwonienia",
            body: "Klient czeka na wycenę.",
            updated_at: "2026-01-01T00:00:00Z",
          }),
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Do oddzwonienia" })).toBeTruthy();
    expect(screen.getByText("Klient czeka na wycenę.")).toBeTruthy();
  });

  it("pokazuje pusty stan z zachętą do dodania karteczki", () => {
    render(<NotesSection embedded notes={[]} />);
    expect(screen.getByText(/Brak notatek — przypnij pierwszą karteczkę powyżej/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Przypnij nową karteczkę/i })).toBeTruthy();
  });

  it("otwiera formularz nowej karteczki po kliknięciu", () => {
    render(<NotesSection embedded notes={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Przypnij nową karteczkę/i }));
    expect(screen.getByText("Nowa karteczka")).toBeTruthy();
    expect(screen.getByPlaceholderText("Wpisz notatkę…")).toBeTruthy();
  });

  it("oznacza przypiętą notatkę", () => {
    render(
      <NotesSection
        embedded
        notes={[
          testSalesNote({
            id: "n-pin",
            body: "Przypięte",
            pinned: true,
            updated_at: "2026-01-01T00:00:00Z",
          }),
        ]}
      />
    );

    expect(screen.getByLabelText("Przypięta")).toBeTruthy();
  });

  it("pokazuje czerwoną ikonę usuwania zamiast tekstu Archiwum", () => {
    render(
      <NotesSection
        embedded
        notes={[
          testSalesNote({
            id: "n-del",
            body: "Do usunięcia",
            updated_at: "2026-01-01T00:00:00Z",
          }),
        ]}
      />
    );

    expect(screen.getByLabelText("Usuń notatkę")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archiwum" })).toBeNull();
  });
});
