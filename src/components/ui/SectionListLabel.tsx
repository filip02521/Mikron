import { cn } from "@/lib/cn";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";

/** Nagłówek podsekcji w jednej karcie (Moje zamówienia, Harmonogram, …). */
export function SectionListLabel({
  id,
  title,
  hint,
  count,
  accent,
  icon,
  tileClassName,
}: {
  id?: string;
  title: string;
  hint?: string;
  count?: number;
  accent?: "emerald" | "indigo";
  icon: React.ReactNode;
  tileClassName: string;
}) {
  return (
    <div
      className={
        accent === "emerald"
          ? "flex items-start justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3 py-2.5 sm:px-4"
          : accent === "indigo"
            ? "flex items-start justify-between gap-2 border-b border-indigo-100/90 bg-gradient-to-r from-indigo-50/70 to-sky-50/40 px-3 py-2.5 sm:px-4"
            : "flex items-start justify-between gap-2 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/25 via-white to-white px-3 py-2.5 sm:px-4"
      }
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <SectionHeadingIcon tileClassName={tileClassName}>{icon}</SectionHeadingIcon>
        <div className="min-w-0">
          <h3
            id={id}
            className={cn(
              accent === "emerald"
                ? "text-xs font-semibold uppercase tracking-wide text-emerald-900"
                : accent === "indigo"
                  ? "text-xs font-semibold uppercase tracking-wide text-indigo-900"
                  : "text-xs font-semibold uppercase tracking-wide text-indigo-900/90",
              id && "scroll-mt-24"
            )}
          >
            {title}
          </h3>
          {hint ? (
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed",
                accent === "emerald"
                  ? "text-emerald-800/90"
                  : accent === "indigo"
                    ? "text-indigo-800/90"
                    : "text-indigo-800/75"
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            accent === "emerald"
              ? "bg-emerald-100 text-emerald-900"
              : accent === "indigo"
                ? "bg-indigo-100 text-indigo-900"
                : "bg-indigo-100/90 text-indigo-900"
          )}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}
