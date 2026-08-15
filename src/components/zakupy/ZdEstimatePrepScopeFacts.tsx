import { formatPlDate } from "@/lib/display-labels";
import { cn } from "@/lib/cn";
import {
  zdEstimateScopeFactChipAccentClass,
  zdEstimateScopeFactChipClass,
} from "@/lib/ui/ontime-theme";

/**
 * Belka faktów zakresu — wspólna dla stanu zwiniętego i rozwiniętego prep.
 */
export function ZdEstimatePrepScopeFacts({
  variant,
  scopeName,
  stockLabel,
  dniZapasu,
  supplierLabel,
  dataOd,
  dataDo,
  className,
}: {
  variant: "collapsed" | "inline";
  scopeName: string;
  stockLabel: string | null;
  dniZapasu: string;
  supplierLabel: string | null;
  dataOd: string;
  dataDo: string;
  className?: string;
}) {
  const zapasChip = stockLabel
    ? `${stockLabel} · ${dniZapasu} d`
    : `${dniZapasu} d zapasu`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        variant === "collapsed" &&
          "border-t border-slate-100 px-4 py-3 sm:px-6 lg:px-7",
        className
      )}
      role="status"
      aria-label="Parametry zakresu"
    >
      <span className={zdEstimateScopeFactChipAccentClass}>{scopeName}</span>
      <span className={cn(zdEstimateScopeFactChipClass, "tabular-nums")}>
        {zapasChip}
      </span>
      {supplierLabel ? (
        <span className={zdEstimateScopeFactChipClass}>{supplierLabel}</span>
      ) : null}
      <span className="text-[11px] text-slate-500">
        {formatPlDate(dataOd)} – {formatPlDate(dataDo)}
      </span>
    </div>
  );
}
