import { cn } from "@/lib/cn";
import type { TeethProductLine } from "@/lib/teeth/teeth-catalog";
import { teethProductLineBadgeClass } from "@/lib/teeth/teeth-panel-product-line-ui";

export function TeethProductLineBadge({
  label,
  productLine,
  className,
}: {
  label: string;
  productLine?: TeethProductLine | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-[11px] font-semibold leading-snug",
        teethProductLineBadgeClass(productLine ?? null),
        className,
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
