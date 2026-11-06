import { cn } from "@/lib/cn";

/** Kolor kropki zdarzenia — znaczenie, nie dekoracja (DESIGN.md: kolory stanów). */
export type EventTimelineTone = "neutral" | "brand" | "brandSoft" | "ok" | "warn" | "danger" | "muted";

export type EventTimelineItem = {
  id: string | number;
  /** ISO — trafia do `<time dateTime>`. */
  at: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  tone?: EventTimelineTone;
};

const DOT: Record<EventTimelineTone, string> = {
  neutral: "border-slate-300",
  brand: "border-indigo-600",
  brandSoft: "border-indigo-300",
  ok: "border-emerald-500",
  warn: "border-amber-500",
  danger: "border-red-500",
  muted: "border-slate-400",
};

function formatAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Historia zdarzeń rekordu (egzemplarz, zlecenie): pionowa szyna, kropka w kolorze zdarzenia,
 * data nad tytułem. Kolejność ustala wywołujący (zwykle najnowsze na górze).
 */
export function EventTimeline({
  items,
  label,
  formatDate = formatAt,
  className,
}: {
  items: EventTimelineItem[];
  /** Nazwa listy dla czytników ekranu, np. „Historia egzemplarza”. */
  label: string;
  formatDate?: (iso: string) => string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ol
      aria-label={label}
      className={cn(
        "relative space-y-4 pl-5 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-px before:bg-slate-200",
        className
      )}
    >
      {items.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn("absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 bg-raised", DOT[e.tone ?? "neutral"])}
            aria-hidden
          />
          <time dateTime={e.at} className="block text-xs tabular-nums text-slate-500">
            {formatDate(e.at)}
          </time>
          <div className="font-semibold text-slate-900">{e.title}</div>
          {e.meta ? <div className="text-[0.8125rem] text-slate-500">{e.meta}</div> : null}
        </li>
      ))}
    </ol>
  );
}
