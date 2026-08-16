import { formatPlDate } from "@/lib/display-labels";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

function ScopeFact({
  label,
  value,
  valueClassName,
  title,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <p className={panelTypography.caption}>{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold leading-snug tabular-nums tracking-tight text-slate-900",
          valueClassName
        )}
        title={title ?? value}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Zakres wyniku szacunku — okno sprzedaży i zapas są kluczowe dla qty,
 * więc dostają czytelną hierarchię (nie jedna szara linia z ISO).
 * Domyślnie bez ciężkiej ramki (karta listy już ją ma).
 */
export function ZdEstimateResultScopeBar({
  visibleCount,
  totalCount,
  searchActive = false,
  dataOd,
  dataDo,
  dniOkresu,
  dniZapasu,
  truncated = false,
  className,
}: {
  visibleCount: number;
  totalCount: number;
  /** Gdy szukanie zawęża segment — totalCount = pozycje w filtrze segmentu. */
  searchActive?: boolean;
  dataOd?: string | null;
  dataDo?: string | null;
  dniOkresu?: string | number | null;
  dniZapasu?: string | number | null;
  truncated?: boolean;
  className?: string;
}) {
  const hasWindow =
    (dataOd != null && String(dataOd).trim() !== "") ||
    (dataDo != null && String(dataDo).trim() !== "");
  const odLabel = formatPlDate(dataOd);
  const doLabel = formatPlDate(dataDo);
  const windowLabel = hasWindow ? `${odLabel} – ${doLabel}` : "—";
  const okresLabel =
    dniOkresu != null && String(dniOkresu).trim() !== ""
      ? `${dniOkresu} dni`
      : "—";
  const zapasLabel =
    dniZapasu != null && String(dniZapasu).trim() !== ""
      ? `${dniZapasu} dni`
      : "—";
  const visibleLabel = searchActive
    ? `${visibleCount} z ${totalCount} (filtr)`
    : `${visibleCount} z ${totalCount}`;
  const visibleHint = searchActive
    ? "Po wyszukiwaniu w bieżącym filtrze listy"
    : "Pozycje na liście wyniku";

  return (
    <div
      className={cn("min-w-0", className)}
      role="status"
      aria-label="Zakres szacunku"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
          <ScopeFact
            label="Widoczne"
            value={visibleLabel}
            title={visibleHint}
          />
          <ScopeFact
            label="Okno sprzedaży"
            value={windowLabel}
            valueClassName="sm:text-[0.9375rem]"
            title={
              hasWindow
                ? `Okres FS użyty do tempa sprzedaży: ${windowLabel}`
                : undefined
            }
          />
          <ScopeFact
            label="Dni w oknie"
            value={okresLabel}
            title="Długość okna sprzedaży (tempo dzienne)"
          />
          <ScopeFact
            label="Zapas"
            value={zapasLabel}
            title="Cel zapasu w dniach sprzedaży"
          />
        </div>
        {truncated ? (
          <p className="max-w-[14rem] text-[11px] font-medium leading-snug text-amber-800">
            Lista niepełna — limit stron Subiekta
          </p>
        ) : null}
      </div>
    </div>
  );
}
