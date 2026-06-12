"use client";

import { useSyncExternalStore } from "react";

function readUndoShortcutLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)) {
    return "⌘Z";
  }
  return "Ctrl+Z";
}

/** Stała etykieta SSR — zawsze Ctrl+Z (bez odczytu navigator). */
export function undoShortcutLabel(): string {
  return "Ctrl+Z";
}

/** Etykieta skrótu cofania po hydracji — ⌘Z na macOS, Ctrl+Z w pozostałych. */
export function useUndoShortcutLabel(): string {
  return useSyncExternalStore(
    () => () => {},
    readUndoShortcutLabel,
    undoShortcutLabel
  );
}
