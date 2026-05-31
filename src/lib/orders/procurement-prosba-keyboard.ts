import type { KeyboardShortcutItem } from "@/components/ui/KeyboardShortcutsHint";

export const PROCUREMENT_PROSBA_KEYBOARD_HINTS: readonly KeyboardShortcutItem[] = [
  { keys: ["Ctrl", "Enter"], label: "zapisz prośby" },
];

export function isProcurementFormFieldTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function handleProcurementProsbaKeyboardEvent(
  e: KeyboardEvent,
  handlers: { pending: boolean; onSubmit: () => void }
): boolean {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    if (!handlers.pending) handlers.onSubmit();
    return true;
  }
  if (isProcurementFormFieldTarget(e.target) && e.key === "Escape") {
    (e.target as HTMLElement).blur();
    return true;
  }
  return false;
}
