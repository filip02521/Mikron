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
    <p className={cn(salesTypography.rowMeta, "inline-flex items-center gap-1", className)}>
      <span className={cn(procurementCancelNoteLabelClass, "gap-0.5")}>
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
          <path d="M1 3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1h2a1 1 0 0 1 .8.4l1.5 2A1 1 0 0 1 15 7v3a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H6a2 2 0 0 1-4 0H2a1 1 0 0 1-1-1V3Zm9 1v2h3l-1-2h-2Z" />
        </svg>
        Od dostaw
      </span>
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className="whitespace-pre-wrap font-medium text-slate-800"
      />
    </p>
  );
}
