"use client";

import { SalesKeyboardShortcutsStrip } from "@/components/sales/SalesKeyboardShortcutsStrip";
import type { KeyboardShortcutItem } from "@/components/ui/KeyboardShortcutsHint";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Pasek pod nagłówkiem karty — skróty klawiszowe w rozwijanym panelu. */
export function ProsbaFormMetaStrip({
  keyboardHints,
  className,
}: {
  keyboardHints: readonly KeyboardShortcutItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        salesChromeInsetClass,
        "hidden border-t border-slate-200/80 bg-slate-50/35 py-2 sm:flex",
        className
      )}
    >
      <SalesKeyboardShortcutsStrip items={keyboardHints} embedded />
    </div>
  );
}
