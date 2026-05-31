/** Etykieta skrótu cofania — ⌘Z na macOS, Ctrl+Z w pozostałych. */
export function undoShortcutLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)) {
    return "⌘Z";
  }
  return "Ctrl+Z";
}
