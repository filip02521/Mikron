"use client";

import { IconKeyboard } from "@/components/icons/StrokeIcons";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { HelpPopover } from "@/components/ui/HelpPopover";
import {
  dailyPanelKeyboardHints,
  DAILY_PANEL_PROSBY_KEYBOARD_HINTS,
} from "@/lib/orders/daily-panel-keyboard";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";

export function DailyPanelShortcutsPopover({ view }: { view: DailyPanelView }) {
  const items =
    view === "dzis"
      ? [...dailyPanelKeyboardHints(), ...DAILY_PANEL_PROSBY_KEYBOARD_HINTS]
      : dailyPanelKeyboardHints();

  return (
    <HelpPopover
      label="Skróty klawiszowe panelu dziennego"
      title="Skróty klawiszowe"
      shortLabel="Skróty"
      icon={<IconKeyboard size={14} strokeWidth={1.75} />}
      align="right"
      buttonClassName="!py-1 !px-2 !text-[11px]"
    >
      <KeyboardShortcutsHint items={items} className="flex-col !items-start !gap-2" />
    </HelpPopover>
  );
}
