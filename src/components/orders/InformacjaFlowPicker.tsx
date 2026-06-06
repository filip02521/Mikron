"use client";

import type { ReactElement } from "react";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";
import {
  INFORMACJA_FLOW_CARD_STYLES,
  informacjaFlowPickerOptions,
  type InformacjaFlowUiDef,
} from "@/lib/orders/informacja-flow-ui";
import { cn } from "@/lib/cn";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import {
  IconAlertCircle,
  IconAvailability,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import type { StrokeIconProps } from "@/components/icons/StrokeIcons";

const PICKER_FLOW_ICONS: Record<
  InformacjaFlowUiDef["path"],
  (props: StrokeIconProps) => ReactElement
> = {
  stock_out: IconAlertCircle,
  direct: IconAvailability,
  via_panel: IconTruck,
};

/** Wybór ścieżki prośby informacyjnej — ten sam wzorzec co RequestKindToggle. */
export function InformacjaFlowPicker({
  path,
  onChange,
  disabled = false,
  /** Tylko panel dzienny → Nowa prośba (zakupy). */
  includeViaPanel = false,
}: {
  path: InformacjaFlowPath;
  onChange: (path: InformacjaFlowPath) => void;
  disabled?: boolean;
  includeViaPanel?: boolean;
  /** @deprecated Ignorowane — wybór przez przyciski, bez ukrytych radio. */
  name?: string;
}) {
  const options = informacjaFlowPickerOptions({ includeViaPanel });

  return (
    <div
      className="grid gap-2"
      role="radiogroup"
      aria-label="Ścieżka informacji"
    >
      {options.map((flow) => {
        const isActive = path === flow.path;
        const styles = INFORMACJA_FLOW_CARD_STYLES[flow.tone];
        const Icon = PICKER_FLOW_ICONS[flow.path];

        return (
          <button
            key={flow.path}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(flow.path)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-shadow",
              "sm:min-h-[4.25rem] sm:items-start sm:gap-3 sm:px-3.5 sm:py-3",
              "disabled:cursor-not-allowed disabled:opacity-60",
              isActive ? styles.active : styles.idle
            )}
          >
            <SectionHeadingIcon
              tileClassName={isActive ? styles.iconActive : styles.iconIdle}
              className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
            >
              <Icon size={18} />
            </SectionHeadingIcon>
            <span className="min-w-0 sm:pt-0.5">
              <span className="block text-sm font-semibold leading-snug text-slate-900">
                {flow.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-600 line-clamp-1 sm:text-xs sm:leading-relaxed sm:line-clamp-none">
                {flow.short}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
