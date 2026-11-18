/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ZdSharedScopeAddSupplier } from "./ZdSharedScopeAddSupplier";

const CANDIDATES = [
  { id: "s-tarcze", name: "Motyl tarcze" },
  { id: "s-inny", name: "Inny dostawca" },
];

function open() {
  fireEvent.click(screen.getByRole("button", { name: /Dodaj dostawcę/ }));
  return screen.getByLabelText("Dostawca do dodania") as HTMLSelectElement;
}

describe("ZdSharedScopeAddSupplier", () => {
  afterEach(() => cleanup());

  it("bez kandydatów nie pokazuje przycisku", () => {
    const { container } = render(
      <ZdSharedScopeAddSupplier mode="grupa" candidates={[]} disabled={false} onAdd={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("dodaje wybranego dostawcę i zwija formularz po potwierdzeniu", async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<ZdSharedScopeAddSupplier mode="grupa" candidates={CANDIDATES} disabled={false} onAdd={onAdd} />);

    const select = open();
    const submit = screen.getByRole("button", { name: "Dodaj do grupy" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(select, { target: { value: "s-tarcze" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(screen.queryByLabelText("Dostawca do dodania")).toBeNull());
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("s-tarcze");
    expect(screen.getByRole("button", { name: /Dodaj dostawcę/ })).toBeTruthy();
  });

  it("odmowa w potwierdzeniu zostawia formularz z wyborem", async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    render(<ZdSharedScopeAddSupplier mode="cecha" candidates={CANDIDATES} disabled={false} onAdd={onAdd} />);

    const select = open();
    fireEvent.change(select, { target: { value: "s-inny" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj do cechy" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("s-inny"));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Dodaj do cechy" }) as HTMLButtonElement).disabled).toBe(false)
    );
    expect((screen.getByLabelText("Dostawca do dodania") as HTMLSelectElement).value).toBe("s-inny");
  });

  it("Anuluj zwija formularz bez wywołania i czyści wybór", () => {
    const onAdd = vi.fn();
    render(<ZdSharedScopeAddSupplier mode="grupa" candidates={CANDIDATES} disabled={false} onAdd={onAdd} />);

    fireEvent.change(open(), { target: { value: "s-tarcze" } });
    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(open().value).toBe("");
  });

  it("dostawca, który zniknął z listy kandydatów, nie zostaje wybrany", () => {
    const onAdd = vi.fn();
    const { rerender } = render(
      <ZdSharedScopeAddSupplier mode="grupa" candidates={CANDIDATES} disabled={false} onAdd={onAdd} />
    );
    fireEvent.change(open(), { target: { value: "s-tarcze" } });
    rerender(
      <ZdSharedScopeAddSupplier mode="grupa" candidates={[CANDIDATES[1]]} disabled={false} onAdd={onAdd} />
    );
    expect((screen.getByRole("button", { name: "Dodaj do grupy" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("zablokowany w trakcie zapisu", () => {
    render(<ZdSharedScopeAddSupplier mode="grupa" candidates={CANDIDATES} disabled onAdd={vi.fn()} />);
    expect((screen.getByRole("button", { name: /Dodaj dostawcę/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
