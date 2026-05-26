"use client";

import { HelpPopover, GuideIcon, LegendIcon } from "@/components/ui/HelpPopover";
import { ColorLegendContent } from "@/components/summary/ColorLegend";
import { HowItWorksContent } from "@/components/summary/HowItWorks";

import { panelToolbarTextButtonClass } from "@/lib/ui/ontime-theme";
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
      <HelpPopover
        label="Legenda kolorów w panelu"
        title="Legenda kolorów"
        shortLabel="Kolory"
        icon={<LegendIcon />}
        align="right"
        buttonClassName={toolbarButton}
      >
        <ColorLegendContent />
      </HelpPopover>
      <HelpPopover
        label="Instrukcja obsługi panelu dziennego"
        title="Jak działa panel dzienny"
        shortLabel="Instrukcja"
        icon={<GuideIcon />}
        align="right"
        buttonClassName={toolbarButton}
      >
        <HowItWorksContent />
      </HelpPopover>
    </div>
  );
}
