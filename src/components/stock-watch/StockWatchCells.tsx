import { Badge } from "@/components/ui/Badge";
import { IconTruck } from "@/components/icons/StrokeIcons";
import { isStockWatchEmptyNoIncoming } from "@/lib/stock-watch/analysis";
import type { StockWatchRowView } from "@/lib/stock-watch/dashboard";
import {
  formatAssembly,
  formatCover,
  formatQtyPl,
  formatRunOutDate,
  formatVelocity,
  STOCK_WATCH_STATUS_META,
} from "@/components/stock-watch/stock-watch-format";

/** Komórki wierszy braków — wspólne dla tablicy dostawców i listy wszystkich braków. */

const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

export function formatShortDate(key: string): string {
  const [, m, d] = key.split("-");
  return m && d ? `${d}.${m}` : key;
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : dateTimeFormatter.format(d);
}

export function ProductCell({ row }: { row: Pick<StockWatchRowView, "twSymbol" | "twNazwa" | "grtNazwa"> }) {
  return (
    <div className="min-w-0 max-w-[16rem]">
      <p className="truncate font-mono text-[13px] font-semibold text-slate-900" title={row.twSymbol ?? undefined}>
        {row.twSymbol ?? "-"}
      </p>
      <p className="truncate text-xs text-slate-500" title={row.twNazwa}>
        {row.twNazwa}
      </p>
    </div>
  );
}

export function CoverChip({
  row,
}: {
  row: Pick<StockWatchRowView, "daysOfCover" | "status" | "runOutDate" | "deliveryRisk"> &
    Partial<Pick<StockWatchRowView, "assemblyKind" | "assemblyQty" | "assemblyNote">>;
}) {
  const meta = STOCK_WATCH_STATUS_META[row.status];
  const runOut = formatRunOutDate(row.runOutDate);
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant={meta.badge} className="whitespace-nowrap tabular-nums">
        {formatCover(row.daysOfCover, row.status)}
      </Badge>
      {runOut && row.status !== "out_of_stock" ? (
        <span className="text-xs text-slate-500">koniec ok. {runOut}</span>
      ) : null}
      {row.deliveryRisk ? <DeliveryRiskTag risk={row.deliveryRisk} /> : null}
      {/* Tylko gdy kompletacja jest do zrobienia — inaczej to szum przy towarze ze stanem. */}
      {row.status === "to_assemble" ? <AssemblyTag row={row} /> : null}
    </div>
  );
}

/** Kompletacja w Subiekcie zamiast zakupu (skład z Kreatora ZD). */
export function AssemblyTag({
  row,
}: {
  row: Partial<Pick<StockWatchRowView, "assemblyKind" | "assemblyQty" | "assemblyNote">>;
}) {
  const label = formatAssembly({ assemblyKind: row.assemblyKind ?? null, assemblyQty: row.assemblyQty ?? null });
  if (!label) return null;
  return (
    <span
      className="whitespace-nowrap rounded-md bg-indigo-50 px-1.5 text-xs font-medium text-indigo-800"
      title={
        row.assemblyKind === "assemble"
          ? `Z części na stanie (skład w Kreatorze ZD). ${row.assemblyNote ?? ""}`.trim()
          : `Z kompletów na stanie (skład w Kreatorze ZD). ${row.assemblyNote ?? ""}`.trim()
      }
    >
      {label}
    </span>
  );
}

export function DeliveryRiskTag({ risk }: { risk: NonNullable<StockWatchRowView["deliveryRisk"]> }) {
  return risk === "before_delivery" ? (
    <span
      className="whitespace-nowrap rounded-md bg-red-50 px-1.5 text-xs font-medium text-red-800"
      title="Przy obecnym tempie sprzedaży (z towarem w drodze) skończy się, zanim przyjedzie zamówienie złożone dziś."
    >
      przed dostawą
    </span>
  ) : (
    <span
      className="whitespace-nowrap rounded-md bg-amber-50 px-1.5 text-xs font-medium text-amber-900"
      title="Skończy się przed dostawą z kolejnego planowego zamówienia - warto zamówić wcześniej."
    >
      przed kolejną dostawą
    </span>
  );
}

/** Flaga przeciw podwójnemu zamówieniu: towar już jedzie na otwartym ZD — albo nic nie jedzie. */
export function IncomingTag({ row }: { row: Pick<StockWatchRowView, "status" | "openZdQty"> }) {
  if (isStockWatchEmptyNoIncoming(row)) {
    return <Badge variant="danger" className="whitespace-nowrap font-semibold">nic w drodze</Badge>;
  }
  if (row.openZdQty <= 0) return null;
  return (
    <Badge
      variant="info"
      className="inline-flex items-center gap-1 whitespace-nowrap"
    >
      <IconTruck size={12} strokeWidth={2} aria-hidden />
      w drodze {formatQtyPl(row.openZdQty)} szt
    </Badge>
  );
}

export function VelocityCell({
  row,
}: {
  row: Pick<StockWatchRowView, "velocityDaily" | "salesPeriodQty" | "salesPeriodDays">;
}) {
  return (
    <div className="whitespace-nowrap text-right tabular-nums">
      <span className="font-semibold text-slate-900">{formatVelocity(row.velocityDaily)}</span>
      <span className="text-xs text-slate-500">/d</span>
      <p className="text-[11px] text-slate-500" title="Sprzedaż w oknie Kreatora (dni zapasu dostawcy)">
        {formatQtyPl(row.salesPeriodQty)} szt / {row.salesPeriodDays} d
      </p>
    </div>
  );
}

/** „Do ZD” z silnika — ilość na dokumencie, jak w Kreatorze. */
export function OrderQty({
  row,
}: {
  row: Pick<StockWatchRowView, "inOrder" | "orderZdUnits" | "orderUnitLabel" | "orderPieces"> &
    Partial<Pick<StockWatchRowView, "bomRole">>;
}) {
  if (row.bomRole === "assembled_parent") {
    return (
      <span className="whitespace-nowrap text-xs text-slate-500" title="Zestaw „Składamy” - na ZD idą jego składniki">
        składniki
      </span>
    );
  }
  if (!row.inOrder || row.orderZdUnits <= 0) {
    return (
      <span className="whitespace-nowrap text-xs text-slate-500" title="Poza listą „Do ZD” - pokryte stanem / otwartymi ZD albo reguła">
        poza ZD
      </span>
    );
  }
  const label = row.orderUnitLabel ?? "szt.";
  return (
    <span className="font-semibold text-slate-900" title={`${formatQtyPl(row.orderPieces)} szt po dostawie`}>
      {formatQtyPl(row.orderZdUnits)} {label}
    </span>
  );
}

