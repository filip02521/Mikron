import type { IndividualRequestKind } from "@/types/database";
import type { KeyboardShortcutItem } from "@/components/ui/KeyboardShortcutsHint";

export const PROCUREMENT_PROSBA_KEYBOARD_HINTS: readonly KeyboardShortcutItem[] = [
  { keys: ["1"], label: "zamówienie" },
  { keys: ["2"], label: "dostępność" },
  { keys: ["+"], label: "kolejny produkt" },
  { keys: ["↑", "↓"], label: "wybór z listy" },
  { keys: ["Ctrl", "Enter"], label: "zapisz prośbę" },
];

export function isProcurementFormFieldTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export type ProcurementProsbaKeyboardHandlers = {
  pending: boolean;
  onSubmit: () => void;
  onSetRequestKind?: (kind: IndividualRequestKind) => void;
  onAddProductLine?: () => void;
};

export function handleProcurementProsbaKeyboardEvent(
  e: KeyboardEvent,
  handlers: ProcurementProsbaKeyboardHandlers
): boolean {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    if (!handlers.pending) handlers.onSubmit();
    return true;
  }

  if (isProcurementFormFieldTarget(e.target)) {
    if (e.key === "Escape") {
      (e.target as HTMLElement).blur();
      return true;
    }
    return false;
  }

  if (e.metaKey || e.ctrlKey || e.altKey) return false;

  if (e.key === "1" && handlers.onSetRequestKind) {
    e.preventDefault();
    handlers.onSetRequestKind("zamowienie");
    return true;
  }

  if (e.key === "2" && handlers.onSetRequestKind) {
    e.preventDefault();
    handlers.onSetRequestKind("informacja");
    return true;
  }

  if ((e.key === "+" || (e.key === "=" && e.shiftKey)) && handlers.onAddProductLine) {
    e.preventDefault();
    handlers.onAddProductLine();
    return true;
  }

  return false;
}
