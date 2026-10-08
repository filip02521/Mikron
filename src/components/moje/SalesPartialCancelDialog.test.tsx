/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SalesPartialCancelDialog } from "./SalesPartialCancelDialog";

function setup() {
  const onConfirm = vi.fn();
  render(
    <SalesPartialCancelDialog
      open
      product="Końcówka 12"
      phase="in_transit"
      maxQty={25}
      defaultQty={1}
      onConfirm={onConfirm}
      onCancel={() => {}}
    />
  );
  const input = screen.getByLabelText("Ilość do wycofania") as HTMLInputElement;
  const confirm = () =>
    screen.getAllByRole("button").find((b) => !b.getAttribute("aria-label") && b.textContent !== "Zostaw bez zmian")!;
  return { input, confirm, onConfirm };
}

describe("SalesPartialCancelDialog — wpisywana ilość", () => {
  afterEach(() => cleanup());

  it("ilość spoza zakresu: komunikat pod polem i wyłączony przycisk; po wyjściu z pola przycina do maksimum", () => {
    const { input, confirm } = setup();
    fireEvent.change(input, { target: { value: "30" } });
    expect(screen.getByText("Wpisz od 1 do 25")).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.blur(input);
    expect(input.value).toBe("25");
    expect((confirm() as HTMLButtonElement).disabled).toBe(false);
  });

  it("„012” to 12 — przycisk aktywny i zatwierdza 12", () => {
    const { input, confirm, onConfirm } = setup();
    fireEvent.change(input, { target: { value: "012" } });
    expect((confirm() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith(12);
  });

  it("puste pole blokuje zatwierdzenie, a wyjście z pola przywraca ostatnią ilość", () => {
    const { input, confirm } = setup();
    fireEvent.change(input, { target: { value: "" } });
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.blur(input);
    expect(input.value).toBe("1");
  });
});
