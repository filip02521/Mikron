import { MyOrderSectionEmptyState } from "@/components/moje/MyOrderSectionEmptyState";
import { IconSearch } from "@/components/icons/StrokeIcons";
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
    <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-4 sm:px-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <IconSearch size={16} />
      </span>
      <p className="text-sm leading-relaxed text-slate-500">
        Brak {entityLabel} dla „<span className="font-medium text-slate-900">{query}</span>”.{" "}
        <button type="button" className={brandLinkSubtleClass} onClick={onClear}>
          Wyczyść filtr
        </button>
      </p>
    </div>
  );
}
