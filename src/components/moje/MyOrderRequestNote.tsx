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
    <p className={cn(salesTypography.rowMeta, className)}>
      <span className={salesRequestNoteLabelClass}>
        Uwagi
      </span>{" "}
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className="whitespace-pre-wrap font-medium text-slate-800"
      />
    </p>
  );
}
