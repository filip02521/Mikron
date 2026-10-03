import { cn } from "@/lib/cn";

/** Udział aktywnych SKU w normie (0-100): sama liczba, kolor tylko gdy jest ryzyko. */
export function StockHealthGauge({
  score,
  active,
  ok,
  className,
}: {
  score: number;
  active: number;
  ok: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const label = clamped >= 85 ? "Dobrze" : clamped >= 65 ? "Do pilnowania" : "Ryzyko braków";
  const labelTone =
    clamped >= 85 ? "text-slate-600" : clamped >= 65 ? "text-amber-700" : "text-red-700";

  return (
    <div
      className={cn("flex flex-col", className)}
      role="img"
      aria-label={`Zdrowie magazynu ${clamped}%: ${ok} z ${active} aktywnych SKU w normie`}
    >
      <p className="text-[11px] font-semibold text-slate-500">W normie</p>
      <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
        {clamped}
        <span className="text-lg text-slate-400">%</span>
      </p>
      <p className={cn("text-xs font-semibold", labelTone)}>{label}</p>
      <p className="mt-1 text-[11px] leading-snug tabular-nums text-slate-500">
        {ok} z {active} aktywnych SKU
      </p>
    </div>
  );
}
