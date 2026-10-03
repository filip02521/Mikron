import { cn } from "@/lib/cn";

/** Półokrągły wskaźnik zdrowia magazynu (0–100). */
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
  const radius = 52;
  const circumference = Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const tone =
    clamped >= 85 ? "text-emerald-500" : clamped >= 65 ? "text-amber-500" : "text-red-500";
  const label = clamped >= 85 ? "Dobrze" : clamped >= 65 ? "Do pilnowania" : "Ryzyko braków";

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      role="img"
      aria-label={`Zdrowie magazynu ${clamped}%: ${ok} z ${active} aktywnych SKU w normie`}
    >
      <svg viewBox="0 0 128 72" className="h-[84px] w-[150px]" aria-hidden>
        <path
          d="M 12 66 A 52 52 0 0 1 116 66"
          fill="none"
          stroke="currentColor"
          strokeWidth="11"
          strokeLinecap="round"
          className="text-slate-200"
        />
        <path
          d="M 12 66 A 52 52 0 0 1 116 66"
          fill="none"
          stroke="currentColor"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className={cn(tone, "transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none")}
        />
      </svg>
      <div className="-mt-9 text-center">
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
          {clamped}
          <span className="text-lg text-slate-400">%</span>
        </p>
        <p className={cn("text-xs font-semibold", tone)}>{label}</p>
      </div>
      <p className="mt-1.5 text-center text-[11px] leading-snug text-slate-500">
        {ok} z {active} aktywnych SKU w normie
      </p>
    </div>
  );
}
