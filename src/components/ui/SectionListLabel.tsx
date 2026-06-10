import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { panelTypography, salesTypography } from "@/lib/ui/ontime-theme";

export type SectionListAccent =
  | "emerald"
  | "indigo"
  | "sky"
  | "violet"
  | "slate"
  | "neutral";

const ACCENT_SHELL: Record<SectionListAccent, string> = {
  emerald:
    "flex items-start justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-3 py-2 sm:px-4",
  indigo:
    "flex items-start justify-between gap-2 border-b border-indigo-100/90 bg-gradient-to-r from-indigo-50/70 to-sky-50/40 px-3 py-2 sm:px-4",
  sky: "flex items-start justify-between gap-2 border-b border-sky-100 bg-sky-50/50 px-3 py-2 sm:px-4",
  violet:
    "flex items-start justify-between gap-2 border-b border-violet-100 bg-violet-50/55 px-3 py-2 sm:px-4",
  slate:
    "flex items-start justify-between gap-2 border-b border-slate-200/90 bg-slate-50/70 px-3 py-2 sm:px-4",
  neutral:
    "flex items-start justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-4",
};

const ACCENT_TITLE: Record<SectionListAccent, string> = {
  emerald: salesTypography.sectionLabelAccent,
  indigo: "text-indigo-900",
  sky: "text-sky-900",
  violet: "text-violet-900",
  slate: "text-slate-800",
  neutral: "",
};

const ACCENT_HINT: Record<SectionListAccent, string> = {
  emerald: "text-emerald-800/90",
  indigo: "text-indigo-800/90",
  sky: "text-sky-800/90",
  violet: "text-violet-800/90",
  slate: "text-slate-600",
  neutral: "",
};

const ACCENT_COUNT: Record<SectionListAccent, string> = {
  emerald: "bg-emerald-100 text-emerald-900",
  indigo: "bg-indigo-100 text-indigo-900",
  sky: "bg-sky-100 text-sky-900",
  violet: "bg-violet-100 text-violet-900",
  slate: "bg-slate-200/80 text-slate-700",
  neutral: "bg-slate-100 text-slate-600",
};

/** Nagłówek podsekcji w jednej karcie (Moje zamówienia, Harmonogram, …). */
export function SectionListLabel({
  id,
  title,
  hint,
  count,
  badges,
  accent = "neutral",
  domain = "sales",
  icon,
  tileClassName,
}: {
  id?: string;
  title: string;
  hint?: string;
  count?: number;
  badges?: ReactNode;
  accent?: SectionListAccent;
  /** sales — panel handlowca; panel — zakupy / magazyn / operacje. */
  domain?: "sales" | "panel";
  icon: React.ReactNode;
  tileClassName: string;
}) {
  const titleToken = domain === "panel" ? panelTypography.sectionLabel : salesTypography.sectionLabel;
  const hintToken = domain === "panel" ? panelTypography.sectionDesc : salesTypography.sectionHint;

  const titleClass =
    accent === "emerald" && domain === "panel"
      ? cn(panelTypography.sectionLabel, "text-emerald-900")
      : cn(titleToken, ACCENT_TITLE[accent]);

  const hintClass = cn("mt-0.5", hintToken, ACCENT_HINT[accent]);

  return (
    <div className={ACCENT_SHELL[accent]}>
      <div className="flex min-w-0 items-start gap-2.5">
        <SectionHeadingIcon tileClassName={tileClassName}>{icon}</SectionHeadingIcon>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={id} className={cn(titleClass, id && "scroll-mt-24")}>
              {title}
            </h3>
            {badges}
          </div>
          {hint ? <p className={hintClass}>{hint}</p> : null}
        </div>
      </div>
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            ACCENT_COUNT[accent]
          )}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}
