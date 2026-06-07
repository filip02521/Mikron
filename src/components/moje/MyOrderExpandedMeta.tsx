import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
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
      <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:gap-x-4">
        {fields.map((f, index) => (
          <div
            key={f.label}
            className={cn(
              "inline-flex min-w-0 max-w-full items-baseline gap-1",
              index > 0 &&
                "before:mr-3 before:text-slate-300 before:content-['·'] sm:before:mr-4"
            )}
          >
            <dt className={cn("shrink-0 font-semibold uppercase tracking-wide text-slate-400", salesTypography.rowMeta)}>
              {f.label}
            </dt>
            <SearchHighlightText
              text={f.value}
              searchQuery={searchQuery}
              as="dd"
              className={cn(
                "min-w-0 font-medium leading-snug text-slate-700",
                salesTypography.rowBody,
                f.emphasize && "font-semibold text-amber-900"
              )}
            />
          </div>
        ))}
      </dl>
    </div>
  );
}
