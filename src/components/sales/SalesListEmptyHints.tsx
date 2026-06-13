import { MyOrderSectionEmptyState } from "@/components/moje/MyOrderSectionEmptyState";
import { brandLinkSubtleClass } from "@/lib/ui/ontime-theme";

/** Pusty stan sekcji listy — ten sam wzorzec co /moje. */
export function SalesSectionEmptyHint(props: React.ComponentProps<typeof MyOrderSectionEmptyState>) {
  return <MyOrderSectionEmptyState {...props} />;
}

/** Brak wyników filtra z akcją wyczyść. */
export function SalesListFilterEmptyHint({
  query,
  onClear,
  entityLabel = "wyników",
}: {
  query: string;
  onClear: () => void;
  entityLabel?: string;
}) {
  return (
    <p className="border-b border-slate-100 px-3 py-4 text-sm text-slate-600 sm:px-4">
      Brak {entityLabel} dla „<span className="font-medium text-slate-900">{query}</span>”.{" "}
      <button type="button" className={brandLinkSubtleClass} onClick={onClear}>
        Wyczyść filtr
      </button>
    </p>
  );
}
