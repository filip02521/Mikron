import { cn } from "@/lib/cn";
import { salesTypography, salesRequestNoteLabelClass } from "@/lib/ui/ontime-theme";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";

/** Notatka do zakupów — widoczna w Moje zamówienia i panelu dziennym. */
export function MyOrderRequestNote({
  note,
  className,
  searchQuery,
}: {
  note: string;
  className?: string;
  searchQuery?: string | null;
}) {
  const trimmed = note.trim();
  if (!trimmed) return null;
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
