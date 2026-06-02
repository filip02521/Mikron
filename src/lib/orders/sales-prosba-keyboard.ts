import type { IndividualRequestKind } from "@/types/database";
import type { KeyboardShortcutItem } from "@/components/ui/KeyboardShortcutsHint";

export const SALES_PROSBA_KEYBOARD_HINTS: readonly KeyboardShortcutItem[] = [
  { keys: ["1"], label: "zamówienie" },
  { keys: ["2"], label: "dostępność" },
  { keys: ["+"], label: "kolejny produkt" },
  { keys: ["↑", "↓"], label: "wybór z Subiekta" },
  { keys: ["Enter"], label: "towar z listy" },
  { keys: ["Ctrl", "Enter"], label: "wyślij" },
];

export function isProsbaFormFieldTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export type SalesProsbaKeyboardHandlers = {
  pending: boolean;
  onSubmit: () => void;
  onSetRequestKind: (kind: IndividualRequestKind) => void;
  onAddProductLine: () => void;
};

/** Zwraca true, gdy zdarzenie zostało obsłużone. */
export function handleSalesProsbaKeyboardEvent(
  e: KeyboardEvent,
  handlers: SalesProsbaKeyboardHandlers
): boolean {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    if (!handlers.pending) handlers.onSubmit();
    return true;
  }

  if (isProsbaFormFieldTarget(e.target)) {
    if (e.key === "Escape") {
      (e.target as HTMLElement).blur();
      return true;
    }
    return false;
  }

  if (e.metaKey || e.ctrlKey || e.altKey) return false;

  if (e.key === "1") {
    e.preventDefault();
    handlers.onSetRequestKind("zamowienie");
    return true;
  }

  if (e.key === "2") {
    e.preventDefault();
    handlers.onSetRequestKind("informacja");
    return true;
  }

  if (e.key === "+" || (e.key === "=" && e.shiftKey)) {
    e.preventDefault();
    handlers.onAddProductLine();
    return true;
  }

  return false;
}
