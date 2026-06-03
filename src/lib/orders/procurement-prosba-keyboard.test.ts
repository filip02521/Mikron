import { describe, expect, it, vi } from "vitest";
import {
  handleProcurementProsbaKeyboardEvent,
  isProcurementFormFieldTarget,
} from "./procurement-prosba-keyboard";

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

describe("procurement-prosba-keyboard", () => {
  it("wykrywa pola formularza", () => {
    expect(isProcurementFormFieldTarget({ tagName: "INPUT" } as HTMLElement)).toBe(
      true
    );
    expect(isProcurementFormFieldTarget({ tagName: "BUTTON" } as HTMLElement)).toBe(
      false
    );
  });

  it("Ctrl+Enter wysyła prośbę", () => {
    const onSubmit = vi.fn();
    const e = keyEvent("Enter", { ctrlKey: true });
    const handled = handleProcurementProsbaKeyboardEvent(e, {
      pending: false,
      onSubmit,
    });
    expect(handled).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalled();
  });

  it("nie wysyła gdy pending", () => {
    const onSubmit = vi.fn();
    handleProcurementProsbaKeyboardEvent(keyEvent("Enter", { ctrlKey: true }), {
      pending: true,
      onSubmit,
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("1 i 2 zmieniają rodzaj prośby poza polem", () => {
    const onSetRequestKind = vi.fn();
    handleProcurementProsbaKeyboardEvent(keyEvent("1"), {
      pending: false,
      onSubmit: vi.fn(),
      onSetRequestKind,
    });
    expect(onSetRequestKind).toHaveBeenCalledWith("zamowienie");

    onSetRequestKind.mockClear();
    handleProcurementProsbaKeyboardEvent(keyEvent("2"), {
      pending: false,
      onSubmit: vi.fn(),
      onSetRequestKind,
    });
    expect(onSetRequestKind).toHaveBeenCalledWith("informacja");
  });

  it("ignoruje 1/2 w polu tekstowym", () => {
    const onSetRequestKind = vi.fn();
    const handled = handleProcurementProsbaKeyboardEvent(
      keyEvent("1", { target: { tagName: "INPUT" } as HTMLElement }),
      {
        pending: false,
        onSubmit: vi.fn(),
        onSetRequestKind,
      }
    );
    expect(handled).toBe(false);
    expect(onSetRequestKind).not.toHaveBeenCalled();
  });

  it("+ dodaje produkt poza polem", () => {
    const onAddProductLine = vi.fn();
    handleProcurementProsbaKeyboardEvent(keyEvent("+"), {
      pending: false,
      onSubmit: vi.fn(),
      onAddProductLine,
    });
    expect(onAddProductLine).toHaveBeenCalled();
  });

  it("Escape w polu bluruje element", () => {
    const blur = vi.fn();
    const input = { tagName: "INPUT", blur } as unknown as HTMLElement;
    const handled = handleProcurementProsbaKeyboardEvent(
      keyEvent("Escape", { target: input }),
      { pending: false, onSubmit: vi.fn() }
    );
    expect(handled).toBe(true);
    expect(blur).toHaveBeenCalled();
  });
});
