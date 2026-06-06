import { Fragment } from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconGripVertical,
  IconMoreVertical,
  IconPin,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

/** Separator między krokami flow (neutralny). */
export function FlowChevron({
  className,
  size = 14,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <IconChevronRight
      size={size}
      strokeWidth={2.25}
      className={cn("inline shrink-0 text-slate-300", className)}
      aria-hidden
    />
  );
}

type LinkChevronTone = "brand" | "sky" | "muted" | "inherit";

const linkChevronToneClass: Record<LinkChevronTone, string> = {
  brand: "text-indigo-600",
  sky: "text-sky-600",
  muted: "text-slate-500",
  inherit: "text-current",
};

/** Chevron przy linkach i akcjach nawigacyjnych. */
export function LinkChevron({
  className,
  size = 15,
  tone = "brand",
}: {
  className?: string;
  size?: number;
  tone?: LinkChevronTone;
}) {
  return (
    <IconChevronRight
      size={size}
      strokeWidth={2.25}
      className={cn("inline shrink-0", linkChevronToneClass[tone], className)}
      aria-hidden
    />
  );
}

/** Chevron wstecz (linki „Wróć”, breadcrumb). */
export function BackChevron({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <IconChevronLeft
      size={size}
      strokeWidth={2.25}
      className={cn("inline shrink-0", className)}
      aria-hidden
    />
  );
}

/** Mały check sukcesu (dostawa, gotowe, na stanie). */
export function InlineCheck({
  className,
  size = 14,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <IconCircleCheck
      size={size}
      strokeWidth={2.5}
      className={cn("inline shrink-0 text-emerald-700", className)}
      aria-hidden
    />
  );
}

/** Kroki flow z chevronami zamiast strzałki tekstowej. */
export function FlowSteps({
  steps,
  className,
  chevronClassName,
}: {
  steps: string[];
  className?: string;
  chevronClassName?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1 gap-y-0.5", className)}>
      {steps.map((step, index) => (
        <Fragment key={`${step}-${index}`}>
          {index > 0 ? <FlowChevron className={chevronClassName} /> : null}
          <span>{step}</span>
        </Fragment>
      ))}
    </span>
  );
}

/** Uchwyt drag & drop (notatnik). */
export function DragHandleGlyph({ className }: { className?: string }) {
  return (
    <IconGripVertical
      size={14}
      strokeWidth={2.5}
      className={cn("inline shrink-0 text-slate-400", className)}
      aria-hidden
    />
  );
}

/** Ikona przypiętej notatki — wyraźna pinezka w kółku. */
export function PinGlyph({
  className,
  size = 14,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-100 p-1 text-indigo-700 shadow-sm ring-1 ring-indigo-200/80",
        className
      )}
      aria-hidden
    >
      <IconPin size={size} strokeWidth={2.5} />
    </span>
  );
}

/** Ikona menu „Więcej” w tekście pomocy. */
export function HelpMenuGlyph({ className }: { className?: string }) {
  return (
    <IconMoreVertical
      size={14}
      strokeWidth={2.25}
      className={cn("inline shrink-0 text-slate-600", className)}
      aria-hidden
    />
  );
}

/** Kropka koloru sekcji panelu Dziś (zgodna z nagłówkami kolejki). */
export function PanelQueueStatDot({
  tone,
  className,
}: {
  tone: "overdue" | "prosby" | "stockOut" | "today" | "cancel" | "default";
  className?: string;
}) {
  const toneClass: Record<typeof tone, string> = {
    overdue: "bg-amber-500",
    prosby: "bg-indigo-500",
    stockOut: "bg-amber-600",
    today: "bg-sky-500",
    cancel: "bg-amber-500",
    default: "bg-slate-400",
  };
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", toneClass[tone], className)}
      aria-hidden
    />
  );
}

/** Strzałka w dół (np. „Wyślij” przy formularzu). */
export function SubmitHintChevron({
  className,
  size = 12,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <IconChevronDown
      size={size}
      strokeWidth={2.5}
      className={cn("inline shrink-0 text-emerald-700", className)}
      aria-hidden
    />
  );
}
