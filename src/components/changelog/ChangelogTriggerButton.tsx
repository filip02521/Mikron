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
          ? "border-neutral-200 bg-white text-indigo-700 shadow-sm hover:bg-neutral-50 hover:shadow"
          : "border-slate-200 bg-white text-slate-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-indigo-600",
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
