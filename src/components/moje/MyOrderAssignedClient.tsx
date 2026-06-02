import { cn } from "@/lib/cn";
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
    <p className={cn("text-[0.68rem] leading-snug text-slate-600", className)}>
      <span className="text-slate-400">Klient</span>{" "}
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className="font-medium text-slate-700"
      />
    </p>
  );
}
