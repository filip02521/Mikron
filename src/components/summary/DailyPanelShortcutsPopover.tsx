"use client";

import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { HelpPopover } from "@/components/ui/HelpPopover";
import {
  dailyPanelKeyboardHints,
  DAILY_PANEL_PROSBY_KEYBOARD_HINTS,
} from "@/lib/orders/daily-panel-keyboard";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";

function KeyboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="3.5" width="12" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M3.5 6h1M5.75 6h1M8 6h1M10.25 6h1M4.25 8h5.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
      icon={<KeyboardIcon />}
      align="right"
      buttonClassName="!py-1 !px-2 !text-[11px]"
    >
      <KeyboardShortcutsHint items={items} className="flex-col !items-start !gap-2" />
    </HelpPopover>
  );
}
