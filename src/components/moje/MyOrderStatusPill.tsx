import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { myOrderFriendlyStatusLabel } from "@/lib/orders/my-order-friendly-status";
import { cn } from "@/lib/cn";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";

const variantStyles: Record<
  NonNullable<MyOrderRow["badgeVariant"]>,
  string
> = {
  default: "bg-white/95 text-slate-600 ring-slate-200/90",
  success: "bg-white/95 text-emerald-800 ring-emerald-200/90",
  warning: "bg-white/95 text-amber-900 ring-amber-200/90",
  info: "bg-white/95 text-indigo-800 ring-indigo-200/90",
  purple: "bg-white/95 text-violet-800 ring-violet-200/90",
  danger: "bg-white/95 text-red-800 ring-red-200/90",
};

export function MyOrderStatusPill({
  label,
  variant = "default",
  className,
  searchQuery,
}: {
  label: string;
  variant?: MyOrderRow["badgeVariant"];
  className?: string;
  searchQuery?: string | null;
}) {
  const friendly = myOrderFriendlyStatusLabel(label);

  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-semibold leading-snug ring-1",
        "whitespace-normal text-right sm:max-w-[14rem]",
        variantStyles[variant],
        className
      )}
      title={friendly !== label ? `${friendly} (${label})` : label}
      aria-label={friendly}
    >
      <SearchHighlightText text={friendly} searchQuery={searchQuery} />
    </span>
  );
}
