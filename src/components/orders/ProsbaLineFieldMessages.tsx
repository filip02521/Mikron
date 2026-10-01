"use client";

import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Spinner } from "@/components/ui/Spinner";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { cn } from "@/lib/cn";

export type ProsbaLineMessageItem =
  | { kind: "feedback"; feedback: SubiektFeedback; fieldLabel?: string }
  | { kind: "resolving" };

export function ProsbaLineFieldMessages({
  items,
  className,
}: {
  items: ProsbaLineMessageItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <div className={cn("space-y-2", className)} aria-live="polite">
      {items.map((item, i) => {
        if (item.kind === "resolving") {
          return (
            <div
              key={`resolving-${i}`}
              className="flex items-start gap-2.5 rounded-md border border-indigo-200/90 bg-indigo-50/70 px-3 py-2.5"
            >
              <Spinner size="sm" className="mt-0.5 shrink-0" />
              <div className="min-w-0 text-xs leading-relaxed text-indigo-900">
                <p className="font-semibold text-indigo-950">Sprawdzam dostawcę</p>
                <p className="mt-0.5 text-indigo-800/90">Szukam dopasowania w bazie powiązań produkt–dostawca…</p>
              </div>
            </div>
          );
        }
        return (
          <div
            key={`fb-${i}`}
            className="rounded-md border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm"
          >
            {item.fieldLabel ? (
              <p className="mb-1.5 text-[11px] font-medium text-slate-500">{item.fieldLabel}</p>
            ) : null}
            <SubiektFeedbackAlert feedback={item.feedback} compact />
          </div>
        );
      })}
    </div>
  );
}
