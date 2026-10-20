"use client";

import { IconHelpCircle } from "@/components/icons/StrokeIcons";
import { HoverCard } from "@/components/ui/HoverCard";
import { cn } from "@/lib/cn";

export type HelpHintTone =
  | "warning"
  | "sky"
  | "indigo"
  | "emerald"
  | "violet"
  | "slate";

const toneButtonClass: Record<HelpHintTone, string> = {
  warning: "text-amber-700 hover:bg-amber-100/80 focus-visible:ring-amber-300",
  sky: "text-sky-700 hover:bg-sky-100/80 focus-visible:ring-sky-300",
  indigo: "text-indigo-700 hover:bg-indigo-100/80 focus-visible:ring-indigo-300",
  emerald: "text-emerald-700 hover:bg-emerald-100/80 focus-visible:ring-emerald-300",
  violet: "text-violet-700 hover:bg-violet-100/80 focus-visible:ring-violet-300",
  slate: "text-slate-600 hover:bg-slate-200/80 focus-visible:ring-slate-300",
};

const tonePanelClass: Record<HelpHintTone, string> = {
  warning: "border-amber-200/90 bg-amber-50 text-amber-950",
  sky: "border-sky-200/90 bg-sky-50 text-sky-950",
  indigo: "border-indigo-200/90 bg-indigo-50 text-indigo-950",
  emerald: "border-emerald-200/90 bg-emerald-50 text-emerald-950",
  violet: "border-violet-200/90 bg-violet-50 text-violet-950",
  slate: "border-slate-200/90 bg-slate-50 text-slate-800",
};

/** Ikona ? z dymkiem — hover, fokus z klawiatury lub klik (portal, bez ucinania overflow). */
export function HelpHintBubble({
  message,
  tone = "slate",
  className,
  size = "sm",
  ariaLabel = "Wyjaśnienie",
}: {
  message: string;
  tone?: HelpHintTone;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const iconSize = size === "md" ? 15 : 14;
  const buttonSize = size === "md" ? "size-6" : "size-5";
  return (
    <HoverCard
      ariaLabel={ariaLabel}
      content={message}
      dataAttr="data-help-hint"
      panelClassName={tonePanelClass[tone]}
      triggerClassName={cn(
        "hit-target inline-flex shrink-0 items-center justify-center rounded-full transition-colors",
        buttonSize,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        toneButtonClass[tone],
        className
      )}
    >
      <IconHelpCircle size={iconSize} className="shrink-0" aria-hidden />
    </HoverCard>
  );
}
