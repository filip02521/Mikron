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
        "mb-2 flex w-full min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-all",
        hasUnseen
          ? "border-indigo-300/80 bg-gradient-to-r from-indigo-50 to-sky-50 text-indigo-700 shadow-sm hover:from-indigo-50 hover:to-sky-100 hover:shadow"
          : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-gradient-to-r hover:from-white hover:to-indigo-50/40 hover:text-indigo-600",
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
