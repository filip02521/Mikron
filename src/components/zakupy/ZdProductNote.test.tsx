/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const getNote = vi.fn();
const saveNote = vi.fn();
vi.mock("@/app/actions/zd-estimate", () => ({
  actionGetZdProductNote: (...a: unknown[]) => getNote(...a),
  actionSaveZdProductNote: (...a: unknown[]) => saveNote(...a),
}));

import { ZdProductNote } from "./ZdProductNote";

afterEach(() => {
  cleanup();
  getNote.mockReset();
  saveNote.mockReset();
});

const props = { twId: 10, symbol: "AB", name: "Gips", canEdit: true, titleId: "t" };

describe("notatka przy towarze w karcie Kreatora", () => {
  it("bez notatki: zaproszenie, edycja, zapis — potem widać notatkę i „Edytuj”", async () => {
    getNote.mockResolvedValue({ ok: true, note: "" });
    saveNote.mockResolvedValue({ ok: true, note: "taniej od 10 opak." });
    render(<ZdProductNote {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: /Dodaj notatkę/ }));
    const area = screen.getByLabelText("Notatka do towaru");
    fireEvent.change(area, { target: { value: "taniej od 10 opak." } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    expect(await screen.findByText("taniej od 10 opak.")).toBeTruthy();
    expect(saveNote).toHaveBeenCalledWith({ twId: 10, note: "taniej od 10 opak.", symbol: "AB", name: "Gips" });
    expect(screen.getByRole("button", { name: "Edytuj" })).toBeTruthy();
  });

  it("błąd zapisu zostaje w edycji z komunikatem; Esc anuluje bez zapisu", async () => {
    getNote.mockResolvedValue({ ok: true, note: "od 20 opak. rabat 5%" });
    saveNote.mockResolvedValue({ ok: false, message: "Brak uprawnień." });
    render(<ZdProductNote {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edytuj" }));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    expect(await screen.findByText("Brak uprawnień.")).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText("Notatka do towaru"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByLabelText("Notatka do towaru")).toBeNull());
    expect(screen.getByText("od 20 opak. rabat 5%")).toBeTruthy();
  });

  it("bez uprawnień: tylko odczyt", async () => {
    getNote.mockResolvedValue({ ok: true, note: "" });
    render(<ZdProductNote {...props} canEdit={false} />);
    expect(await screen.findByText("Brak notatki.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
