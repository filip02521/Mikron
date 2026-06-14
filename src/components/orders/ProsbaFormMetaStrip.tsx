"use client";

import { KeyboardShortcutsHint, type KeyboardShortcutItem } from "@/components/ui/KeyboardShortcutsHint";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Pasek pod nagłówkiem karty — skróty klawiszowe (link do Moje jest w toolbarze). */
export function ProsbaFormMetaStrip({
  keyboardHints,
}: {
  keyboardHints: readonly KeyboardShortcutItem[];
}) {
  return (
    <div
      className={cn(
        salesChromeInsetClass,
        "flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-slate-200/80 bg-slate-50/35 py-2.5"
      )}
    >
      <span className="text-xs font-medium text-slate-600">Skróty klawiszowe</span>
      <KeyboardShortcutsHint items={[...keyboardHints]} compact />
    </div>
  );
}
