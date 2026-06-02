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
    <p className={cn("text-xs leading-snug text-slate-600", className)}>
      <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        Klient
      </span>{" "}
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className="font-medium text-slate-800"
      />
    </p>
  );
}
