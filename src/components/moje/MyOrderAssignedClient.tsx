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
    <p className={cn(salesTypography.rowMeta, className)}>
      <span className={salesClientLabelClass}>Klient</span>{" "}
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className={cn(salesClientNameClass, "break-words")}
      />
    </p>
  );
}
