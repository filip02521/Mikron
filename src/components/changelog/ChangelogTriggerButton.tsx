"use client";

import { useChangelog } from "@/components/changelog/ChangelogProvider";
import { IconSparkles } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export function ChangelogTriggerButton() {
  const { openModal, hasUnseen } = useChangelog();
  return (
    <button
      type="button"
      onClick={openModal}
      className={cn(
        "mb-2 flex w-full min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
        hasUnseen
          ? "border-indigo-200/90 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-50"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700",
      )}
    >
      <IconSparkles size={15} />
      <span>Co nowego</span>
      {hasUnseen ? (
        <span
          className="ml-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
