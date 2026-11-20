"use client";

import { IconChevronDown, IconKeyboard } from "@/components/icons/StrokeIcons";
import {
  KeyboardShortcutsHint,
  type KeyboardShortcutItem,
} from "@/components/ui/KeyboardShortcutsHint";
import { PROSBA_OPTIONAL_SECTION_COPY } from "@/lib/orders/prosba-optional-section-copy";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Przycisk po prawej w wierszach pomocy pod formularzem („Ukryj”, „Pokaż”) — ta sama ramka w obu. */
export const prosbaHelpRowActionClass =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-card px-2.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50";

/**
 * Skróty klawiszowe pod formularzem prośby — jeden wiersz w tym samym układzie co notka „To formularz prośby o towar”
 * (ikona w kółku, zdanie, przycisk po prawej). Wcześniej karta w dwóch opakowaniach z podwójnym wcięciem
 * i zwężona do treści wyglądała jak osobny, przypadkowy blok.
 */
export function ProsbaFormMetaStrip({
  keyboardHints,
  className,
}: {
  keyboardHints: readonly KeyboardShortcutItem[];
  className?: string;
}) {
  const copy = PROSBA_OPTIONAL_SECTION_COPY.keyboard;
  return (
    // Bez telefonu: tam nie ma klawiatury.
    <details className={cn("group hidden border-b border-slate-100 sm:block", className)}>
      <summary
        className={cn(
          salesChromeInsetClass,
          "flex cursor-pointer list-none items-center gap-3 py-2.5 transition-colors hover:bg-slate-50/70 [&::-webkit-details-marker]:hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
            <IconKeyboard size={15} strokeWidth={2} />
          </span>
          <span className="min-w-0 text-xs leading-snug text-slate-600">
            {/* Mała litera tylko na początku — „Subiekta” zostaje nazwą własną. */}
            <strong className="font-semibold text-slate-800">{copy.title}</strong> -{" "}
            {copy.description.charAt(0).toLowerCase() + copy.description.slice(1)}.
          </span>
        </span>
        <span className={prosbaHelpRowActionClass} aria-hidden>
          <span className="group-open:hidden">Pokaż</span>
          <span className="hidden group-open:inline">Zwiń</span>
          <IconChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      {/* Lista pod zdaniem, w tym samym wcięciu co tekst (ikona 28px + odstęp). */}
      <div className={cn(salesChromeInsetClass, "pb-3")}>
        <div className="pl-[2.375rem]">
          <KeyboardShortcutsHint items={[...keyboardHints]} compact />
        </div>
      </div>
    </details>
  );
}
