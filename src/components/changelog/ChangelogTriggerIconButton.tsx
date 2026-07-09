"use client";

import { useChangelog } from "@/components/changelog/ChangelogProvider";
import { IconSparkles } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export function ChangelogTriggerIconButton() {
  const { openModal, hasUnseen } = useChangelog();
  return (
    <button
      type="button"
      onClick={openModal}
      aria-label="Co nowego w systemie"
      className={cn(
        "relative min-h-10 shrink-0 cursor-pointer rounded-md border px-3 shadow-sm transition",
        hasUnseen
          ? "border-indigo-200/90 bg-indigo-50/60 text-indigo-700"
          : "border-slate-200/90 bg-white text-slate-500 hover:bg-slate-50",
      )}
    >
      <IconSparkles size={16} />
      {hasUnseen ? (
        <span
          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
