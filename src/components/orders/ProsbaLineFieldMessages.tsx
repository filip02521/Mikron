"use client";

import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Spinner } from "@/components/ui/Spinner";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { cn } from "@/lib/cn";

export type ProsbaLineMessageItem =
  | { kind: "feedback"; feedback: SubiektFeedback; fieldLabel?: string }
  | { kind: "resolving" }
  | { kind: "hint"; text: string };

export function ProsbaLineFieldMessages({
  lineLabel,
  items,
  className,
}: {
  lineLabel: string;
  items: ProsbaLineMessageItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5",
        className
      )}
      aria-live="polite"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {lineLabel}
      </p>

      {items.map((item, i) => {
        if (item.kind === "resolving") {
          return (
            <p
              key={`resolving-${i}`}
              className="flex items-center gap-2 rounded-md border border-indigo-100 bg-white px-2.5 py-2 text-xs text-indigo-800"
            >
              <Spinner size="sm" />
              Sprawdzam dostawcę w naszej bazie…
            </p>
          );
        }
        if (item.kind === "hint") {
          return (
            <p key={`hint-${i}`} className="text-xs leading-relaxed text-slate-500">
              {item.text}
            </p>
          );
        }
        return (
          <div key={`fb-${i}`} className="space-y-1">
            {item.fieldLabel ? (
              <p className="text-[11px] font-medium text-slate-500">{item.fieldLabel}</p>
            ) : null}
            <SubiektFeedbackAlert feedback={item.feedback} compact />
          </div>
        );
      })}
    </div>
  );
}
