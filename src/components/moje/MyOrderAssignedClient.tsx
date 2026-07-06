import { cn } from "@/lib/cn";
import { salesClientLabelClass, salesClientNameClass, salesTypography } from "@/lib/ui/ontime-theme";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";

/** Krótka etykieta klienta — tylko gdy już przypisany. */
export function MyOrderAssignedClient({
  name,
  className,
  searchQuery,
}: {
  name: string;
  className?: string;
  searchQuery?: string | null;
}) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return (
    <p className={cn(salesTypography.rowMeta, "flex items-center gap-1", className)}>
      <span className={cn(salesClientLabelClass, "gap-0.5")}>
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 13a5.5 5.5 0 0 1 11 0 .5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5Z" />
        </svg>
        Klient
      </span>
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className={cn(salesClientNameClass, "break-words")}
      />
    </p>
  );
}
