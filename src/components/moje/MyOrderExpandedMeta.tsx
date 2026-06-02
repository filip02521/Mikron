import { cn } from "@/lib/cn";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { mojeShipmentExpandedMetaShellClass } from "@/lib/ui/moje-shipment-row-styles";

export function MyOrderExpandedMeta({
  fields,
  searchQuery,
  className,
}: {
  fields: { label: string; value: string; emphasize?: boolean }[];
  searchQuery?: string | null;
  className?: string;
}) {
  if (!fields.length) return null;

  return (
    <div className={cn(mojeShipmentExpandedMetaShellClass, className)}>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">
              {f.label}
            </dt>
            <SearchHighlightText
              text={f.value}
              searchQuery={searchQuery}
              as="dd"
              className={cn(
                "mt-0.5 text-sm font-medium leading-snug text-slate-800",
                f.emphasize && "text-amber-900"
              )}
            />
          </div>
        ))}
      </dl>
    </div>
  );
}
