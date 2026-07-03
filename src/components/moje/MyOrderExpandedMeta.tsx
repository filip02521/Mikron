import { cn } from "@/lib/cn";
import { salesClientNameClass, salesTypography } from "@/lib/ui/ontime-theme";
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
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt
              className={cn(
                "font-medium text-slate-400",
                salesTypography.rowMeta
              )}
            >
              {f.label}
            </dt>
            <SearchHighlightText
              text={f.value}
              searchQuery={searchQuery}
              as="dd"
              className={cn(
                "mt-0.5 min-w-0 font-medium leading-snug text-slate-700",
                salesTypography.rowBody,
                f.label === "Klient" && salesClientNameClass,
                f.emphasize && f.label !== "Klient" && "font-semibold text-amber-900"
              )}
            />
          </div>
        ))}
      </dl>
    </div>
  );
}
