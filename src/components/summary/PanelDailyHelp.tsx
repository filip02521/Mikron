"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HowItWorksContent } from "@/components/summary/HowItWorks";
import { IconCalendarRange } from "@/components/icons/StrokeIcons";

import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";

/** Pomoc przy tytule strony — zwarte przyciski z opisem. */
export function PanelDailyHelp({
  density = "default",
}: {
  density?: "default" | "toolbar";
}) {
  const toolbarButton =
    density === "toolbar"
      ? "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-card px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:h-10 sm:min-w-10"
      : undefined;

  return (
    <div className={cn("flex items-center gap-2", density === "default" && "flex-wrap")}>
      <Link
        href="/lokalizacje/POLSKA"
        className={cn(
          toolbarButton ?? "text-sm font-medium text-indigo-800 underline-offset-2 hover:underline",
          density === "toolbar" && "hidden md:inline-flex"
        )}
        title="Harmonogram i legenda kolorów terminów (PL / ZA / Import)"
      >
        {density === "toolbar" ? (
          <>
            <IconCalendarRange size={15} />
            Terminy
          </>
        ) : (
          <span className="inline-flex items-center gap-1">
            Terminy zamówień
            <LinkChevron size={14} tone="brand" />
          </span>
        )}
      </Link>
      <HelpPopover
        label="Pomoc - panel dzienny"
        title="Panel dzienny"
        shortLabel="Pomoc"
        icon={<GuideIcon />}
        align="right"
        buttonClassName={cn(
          toolbarButton,
          density === "toolbar" &&
            "[&>span:last-child]:hidden md:[&>span:last-child]:inline"
        )}
      >
        <HowItWorksContent />
      </HelpPopover>
    </div>
  );
}
