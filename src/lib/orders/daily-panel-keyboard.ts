import type { KeyboardShortcutItem } from "@/components/ui/KeyboardShortcutsHint";
import { undoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";

export function dailyPanelKeyboardHints(): KeyboardShortcutItem[] {
  return [
    { keys: ["/"], label: "szukaj dostawcę" },
    { keys: ["Z"], label: "zamówione (szuflada)" },
    { keys: [undoShortcutLabel()], label: "cofnij" },
  ];
}

export const DAILY_PANEL_PROSBY_KEYBOARD_HINTS: readonly KeyboardShortcutItem[] = [
  { keys: ["↑", "↓"], label: "grupy prośby" },
  { keys: ["Shift", "G"], label: "główne" },
  { keys: ["Shift", "U"], label: "uzupełniające" },
];
