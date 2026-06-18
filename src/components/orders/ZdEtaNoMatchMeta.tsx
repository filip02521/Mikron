import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

export function ZdEtaNoMatchMeta({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-w-0 flex-col items-end gap-0.5 text-right", className)}
      title="Sprawdziliśmy dokumenty ZD u dostawcy w Subiekcie — brak terminu realizacji dla tej pozycji."
    >
      <span
        className={cn(
          salesTypography.rowMeta,
          "font-semibold uppercase tracking-wide text-slate-500"
        )}
      >
        Termin z ZD
      </span>
      <Badge
        variant="default"
        className="max-w-full whitespace-normal rounded-md px-2 py-0.5 text-[10px] font-semibold leading-snug text-slate-600"
      >
        Brak terminu w Subiekcie
      </Badge>
    </div>
  );
}
