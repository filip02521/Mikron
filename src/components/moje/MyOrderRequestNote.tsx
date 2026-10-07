"use client";

import { cn } from "@/lib/cn";
import { salesTypography, salesRequestNoteLabelClass } from "@/lib/ui/ontime-theme";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { MOJE_COPY_DEPARTMENT, MOJE_COPY_NOTES_ACK_BUTTON } from "@/lib/orders/my-order-moje-copy";

/** Notatka do zakupów — widoczna w Moje zamówienia; wyróżnienie gdy zakupy właśnie ją zmieniły. */
export function MyOrderRequestNote({
  note,
  className,
  searchQuery,
  unread = false,
  onAcknowledge,
  acknowledgePending = false,
  tourPreview = false,
}: {
  note: string;
  className?: string;
  searchQuery?: string | null;
  unread?: boolean;
  onAcknowledge?: () => void;
  acknowledgePending?: boolean;
  tourPreview?: boolean;
}) {
  const trimmed = note.trim();
  if (!trimmed) return null;

  if (unread) {
    return (
      <div
        className={cn(
          "rounded-lg border border-indigo-200/90 bg-indigo-50/80 p-3 sm:p-3.5",
          className
        )}
        role="status"
        aria-live="polite"
      >
        {/* Telefon: przycisk pod treścią na całą szerokość — obok ściskał tekst i etykietę. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  salesRequestNoteLabelClass,
                  "gap-1 bg-indigo-100/90 text-indigo-900 ring-indigo-200/80"
                )}
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
                  <path d="M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6a1 1 0 0 0 .7-.3l3-3a1 1 0 0 0 .3-.7V3a1 1 0 0 0-1-1H3Zm1 2h7v5H8a1 1 0 0 0-1 1v2H4V4Z" />
                </svg>
                Uwagi od działu zakupów
              </span>
              <span className="inline-flex items-center rounded-md bg-indigo-600/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200/70">
                Nowe
              </span>
            </div>
            <p className={cn(salesTypography.rowMeta, "mt-1 text-indigo-900")}>
              {MOJE_COPY_DEPARTMENT} zaktualizował uwagi przy tej prośbie
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-900">
              <SearchHighlightText text={trimmed} searchQuery={searchQuery} />
            </p>
          </div>
          {onAcknowledge || tourPreview ? (
            <MyOrderAckButton
              className="w-full justify-center text-indigo-800 sm:w-auto sm:shrink-0"
              disabled={acknowledgePending}
              preview={tourPreview && !onAcknowledge}
              title="Potwierdź, że przeczytałeś/aś uwagi"
              ariaLabel={`${MOJE_COPY_NOTES_ACK_BUTTON} - uwagi`}
              onClick={() => onAcknowledge?.()}
            >
              {MOJE_COPY_NOTES_ACK_BUTTON}
            </MyOrderAckButton>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <p className={cn(salesTypography.rowMeta, "flex items-center gap-1", className)}>
      <span className={cn(salesRequestNoteLabelClass, "gap-0.5")}>
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
          <path d="M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6a1 1 0 0 0 .7-.3l3-3a1 1 0 0 0 .3-.7V3a1 1 0 0 0-1-1H3Zm1 2h7v5H8a1 1 0 0 0-1 1v2H4V4Z" />
        </svg>
        Uwagi
      </span>
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className="whitespace-pre-wrap font-medium text-slate-800"
      />
    </p>
  );
}
