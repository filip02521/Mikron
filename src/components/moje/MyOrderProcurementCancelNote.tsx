import { cn } from "@/lib/cn";
import { salesTypography, procurementCancelNoteLabelClass } from "@/lib/ui/ontime-theme";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";

/** Wiadomość od zakupów przy anulowaniu — widoczna u handlowca w Moje zamówienia. */
export function MyOrderProcurementCancelNote({
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
      <span className={procurementCancelNoteLabelClass}>Od dostaw</span>{" "}
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className="whitespace-pre-wrap font-medium text-slate-800"
      />
    </p>
  );
}
