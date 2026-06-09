import { describe, expect, it, vi } from "vitest";
import {
  handleSalesProsbaKeyboardEvent,
  isProsbaFormFieldTarget,
} from "./sales-prosba-keyboard";

function keyEvent(
  key: string,
  opts?: Partial<KeyboardEvent> & { target?: EventTarget | null }
): KeyboardEvent {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    target: opts?.target ?? ({ tagName: "BODY" } as HTMLElement),
    ...opts,
  } as KeyboardEvent;
}

describe("sales-prosba-keyboard", () => {
  it("wykrywa pola formularza", () => {
    expect(isProsbaFormFieldTarget({ tagName: "INPUT" } as HTMLElement)).toBe(true);
    expect(isProsbaFormFieldTarget({ tagName: "DIV" } as HTMLElement)).toBe(false);
  });

  it("Ctrl+Enter wysyła prośbę", () => {
    const onSubmit = vi.fn();
    const e = keyEvent("Enter", { ctrlKey: true });
    const handled = handleSalesProsbaKeyboardEvent(e, {
      pending: false,
      onSubmit,
      onSetRequestKind: vi.fn(),
      onAddProductLine: vi.fn(),
    });
    expect(handled).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalled();
  });

  it("Ctrl+Enter nie wysyła gdy formularz niekompletny", () => {
    const onSubmit = vi.fn();
    handleSalesProsbaKeyboardEvent(keyEvent("Enter", { ctrlKey: true }), {
      pending: false,
      canSubmit: false,
      onSubmit,
      onSetRequestKind: vi.fn(),
      onAddProductLine: vi.fn(),
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("1 i 2 zmieniają rodzaj prośby poza polem", () => {
    const onSetRequestKind = vi.fn();
    handleSalesProsbaKeyboardEvent(keyEvent("1"), {
      pending: false,
      onSubmit: vi.fn(),
      onSetRequestKind,
      onAddProductLine: vi.fn(),
    });
    expect(onSetRequestKind).toHaveBeenCalledWith("zamowienie");

    onSetRequestKind.mockClear();
    handleSalesProsbaKeyboardEvent(keyEvent("2"), {
      pending: false,
      onSubmit: vi.fn(),
      onSetRequestKind,
      onAddProductLine: vi.fn(),
    });
    expect(onSetRequestKind).toHaveBeenCalledWith("informacja");
  });

  it("ignoruje 1/2 w polu tekstowym", () => {
    const onSetRequestKind = vi.fn();
    const handled = handleSalesProsbaKeyboardEvent(
      keyEvent("1", { target: { tagName: "INPUT" } as HTMLElement }),
      {
        pending: false,
        onSubmit: vi.fn(),
        onSetRequestKind,
        onAddProductLine: vi.fn(),
      }
    );
    expect(handled).toBe(false);
    expect(onSetRequestKind).not.toHaveBeenCalled();
  });

  it("+ dodaje produkt poza polem", () => {
    const onAddProductLine = vi.fn();
    handleSalesProsbaKeyboardEvent(keyEvent("+"), {
      pending: false,
      onSubmit: vi.fn(),
      onSetRequestKind: vi.fn(),
      onAddProductLine,
    });
    expect(onAddProductLine).toHaveBeenCalled();
  });
});
