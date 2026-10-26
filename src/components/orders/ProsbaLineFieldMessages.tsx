"use client";

import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { BrandLoader } from "@/components/ui/BrandLoader";
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
            <p
              key={`resolving-${i}`}
              className="inline-flex items-center gap-2 text-xs text-slate-600"
              role="status"
            >
              <BrandLoader size="sm" tile={false} />
              Dopasowuję dostawcę…
            </p>
          );
        }
        return (
          <div
            key={`fb-${i}`}
            className="rounded-md border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm"
          >
            {item.fieldLabel ? (
              <p className="mb-1.5 text-[0.6875rem] font-medium text-slate-500">{item.fieldLabel}</p>
            ) : null}
            <SubiektFeedbackAlert feedback={item.feedback} compact />
          </div>
        );
      })}
    </div>
  );
}
