"use client";

import { cn } from "@/lib/cn";

export function MyOrderSubmissionGroupCallout({
  hint,
  className,
}: {
  hint: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-sky-200/90 bg-sky-50/80 px-2.5 py-2 text-xs leading-snug text-sky-950",
        className
      )}
      role="note"
    >
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 size-3.5 shrink-0 text-sky-600"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
      </svg>
      <p>{hint}</p>
    </div>
  );
}
