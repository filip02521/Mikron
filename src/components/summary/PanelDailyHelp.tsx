"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HowItWorksContent } from "@/components/summary/HowItWorks";
import { IconCalendarRange } from "@/components/icons/StrokeIcons";

import { panelToolbarTextButtonClass } from "@/lib/ui/ontime-theme";
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
      ? cn(panelToolbarTextButtonClass, "shadow-none hover:shadow-sm")
      : undefined;

  return (
    <div className={cn("flex items-center gap-1.5", density === "default" && "flex-wrap gap-2")}>
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
        label="Instrukcja obsługi panelu dziennego"
        title="Jak działa panel dzienny"
        shortLabel="Instrukcja"
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
