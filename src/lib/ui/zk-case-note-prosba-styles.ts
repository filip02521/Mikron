import { cn } from "@/lib/cn";
import type { ZkCaseNoteProsbaStatusCopy } from "@/lib/sales/zk-watch-case-note-prosba";

const CHIP_BASE =
  "inline-flex shrink-0 items-center rounded-md font-medium leading-none ring-1 ring-inset";

/** Chip statusu notatki — wiersz listy ZK. */
export const zkCaseNoteProsbaRowChipClass = cn(
  CHIP_BASE,
  "px-1.5 py-0.5 text-[10px] normal-case tracking-normal"
);

/** Chip statusu notatki — modal / sekcja edycji. */
export const zkCaseNoteProsbaModalChipClass = cn(
  CHIP_BASE,
  "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
);

const TONE_CHIP: Record<ZkCaseNoteProsbaStatusCopy["tone"], string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200/80",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-200/80",
  amber: "bg-amber-50 text-amber-900 ring-amber-200/80",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
};

const TONE_CALLOUT: Record<ZkCaseNoteProsbaStatusCopy["tone"], string> = {
  slate: "border-slate-200/90 bg-slate-50/60",
  indigo: "border-indigo-200/80 bg-indigo-50/40",
  amber: "border-amber-200/80 bg-amber-50/45",
  emerald: "border-emerald-200/80 bg-emerald-50/40",
};

export function zkCaseNoteProsbaChipClassForTone(
  tone: ZkCaseNoteProsbaStatusCopy["tone"],
  variant: "row" | "modal" = "row"
): string {
  return cn(
    variant === "row" ? zkCaseNoteProsbaRowChipClass : zkCaseNoteProsbaModalChipClass,
    TONE_CHIP[tone]
  );
}

export function zkCaseNoteProsbaCalloutClassForTone(
  tone: ZkCaseNoteProsbaStatusCopy["tone"]
): string {
  return cn("rounded-lg border px-3 py-2.5", TONE_CALLOUT[tone]);
}
