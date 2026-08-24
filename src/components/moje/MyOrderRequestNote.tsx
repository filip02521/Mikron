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
          "relative overflow-hidden rounded-xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/95 via-white to-sky-50/40 p-3 shadow-sm ring-1 ring-indigo-100/80 sm:p-3.5",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-sky-400"
          aria-hidden
        />
        <div className="flex flex-wrap items-start justify-between gap-2 pl-2 sm:gap-3">
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
              <span className="inline-flex items-center rounded-full bg-indigo-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800 ring-1 ring-inset ring-indigo-200/70">
                Nowe
              </span>
            </div>
            <p className={cn(salesTypography.rowMeta, "mt-1 text-indigo-900/75")}>
              {MOJE_COPY_DEPARTMENT} zaktualizował uwagi przy tej prośbie
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-900">
              <SearchHighlightText text={trimmed} searchQuery={searchQuery} />
            </p>
          </div>
          {onAcknowledge || tourPreview ? (
            <MyOrderAckButton
              variant="segmentOutline"
              className="shrink-0 border-indigo-200 text-indigo-900 hover:bg-indigo-50"
              disabled={acknowledgePending}
              preview={tourPreview && !onAcknowledge}
              title="Potwierdź, że przeczytałeś/aś uwagi"
              ariaLabel={`${MOJE_COPY_NOTES_ACK_BUTTON} — uwagi`}
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
