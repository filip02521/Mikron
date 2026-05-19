"use client";

import { HelpPopover, GuideIcon, LegendIcon } from "@/components/ui/HelpPopover";
import { ColorLegendContent } from "@/components/summary/ColorLegend";
import { HowItWorksContent } from "@/components/summary/HowItWorks";

/** Pomoc przy tytule strony — zwarte przyciski z opisem. */
export function PanelDailyHelp() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <HelpPopover
        label="Legenda kolorów w panelu"
        title="Legenda kolorów"
        shortLabel="Kolory"
        icon={<LegendIcon />}
        align="right"
      >
        <ColorLegendContent />
      </HelpPopover>
      <HelpPopover
        label="Instrukcja obsługi panelu dziennego"
        title="Jak działa panel dzienny"
        shortLabel="Instrukcja"
        icon={<GuideIcon />}
        align="right"
      >
        <HowItWorksContent />
      </HelpPopover>
    </div>
  );
}
