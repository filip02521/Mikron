import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

export function ZdEtaPendingMeta({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-w-0 flex-col items-end gap-0.5 text-right", className)}
      title="Sprawdzamy termin realizacji w dokumentach ZD u dostawcy w Subiekcie."
    >
      <span
        className={cn(
          salesTypography.rowMeta,
          "font-semibold uppercase tracking-wide text-indigo-600/80"
        )}
      >
        Termin z ZD
      </span>
      <Badge
        variant="info"
        className="max-w-full whitespace-normal rounded-md px-2 py-0.5 text-[10px] font-semibold leading-snug"
      >
        Sprawdzamy termin…
      </Badge>
    </div>
  );
}
