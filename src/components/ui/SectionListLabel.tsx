import { cn } from "@/lib/cn";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { panelTypography, salesTypography } from "@/lib/ui/ontime-theme";

/** Nagłówek podsekcji w jednej karcie (Moje zamówienia, Harmonogram, …). */
export function SectionListLabel({
  id,
  title,
  hint,
  count,
  accent = "neutral",
  domain = "sales",
  icon,
  tileClassName,
}: {
  id?: string;
  title: string;
  hint?: string;
  count?: number;
  accent?: "emerald" | "indigo" | "neutral";
  /** sales — panel handlowca; panel — zakupy / magazyn / operacje. */
  domain?: "sales" | "panel";
  icon: React.ReactNode;
  tileClassName: string;
}) {
  const shellClass =
    accent === "emerald"
      ? "flex items-start justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3 py-2 sm:px-4"
      : accent === "indigo"
        ? "flex items-start justify-between gap-2 border-b border-indigo-100/90 bg-gradient-to-r from-indigo-50/70 to-sky-50/40 px-3 py-2 sm:px-4"
        : "flex items-start justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-4";

  const titleToken = domain === "panel" ? panelTypography.sectionLabel : salesTypography.sectionLabel;
  const hintToken = domain === "panel" ? panelTypography.sectionDesc : salesTypography.sectionHint;

  const titleClass =
    accent === "emerald"
      ? domain === "panel"
        ? cn(panelTypography.sectionLabel, "text-emerald-900")
        : salesTypography.sectionLabelAccent
      : accent === "indigo"
        ? cn(titleToken, "text-indigo-900")
        : titleToken;

  const hintClass =
    accent === "emerald"
      ? cn("mt-0.5 text-emerald-800/90", hintToken)
      : accent === "indigo"
        ? cn("mt-0.5 text-indigo-800/90", hintToken)
        : cn("mt-0.5", hintToken);

  const countClass =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-900"
      : accent === "indigo"
        ? "bg-indigo-100 text-indigo-900"
        : "bg-slate-100 text-slate-600";

  return (
    <div className={shellClass}>
      <div className="flex min-w-0 items-start gap-2.5">
        <SectionHeadingIcon tileClassName={tileClassName}>{icon}</SectionHeadingIcon>
        <div className="min-w-0">
          <h3 id={id} className={cn(titleClass, id && "scroll-mt-24")}>
            {title}
          </h3>
          {hint ? <p className={hintClass}>{hint}</p> : null}
        </div>
      </div>
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            countClass
          )}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}
