import type { KeyboardShortcutItem } from "@/components/ui/KeyboardShortcutsHint";

export function dailyPanelKeyboardHints(undoShortcut = "Ctrl+Z"): KeyboardShortcutItem[] {
  return [
    { keys: ["/"], label: "szukaj dostawcę" },
    { keys: ["Z"], label: "zamówione (szuflada)" },
    { keys: [undoShortcut], label: "cofnij" },
  ];
}

export const DAILY_PANEL_PROSBY_KEYBOARD_HINTS: readonly KeyboardShortcutItem[] = [
  { keys: ["↑", "↓"], label: "grupy prośby" },
  { keys: ["Shift", "G"], label: "główne" },
  { keys: ["Shift", "U"], label: "uzupełniające" },
];
