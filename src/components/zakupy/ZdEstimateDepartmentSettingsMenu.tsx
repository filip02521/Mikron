"use client";

import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
} from "@/components/ui/OverflowMenu";
import {
  IconChevronDown,
  IconSettings,
} from "@/components/icons/StrokeIcons";
import { panelToolbarTextButtonClass } from "@/lib/ui/ontime-theme";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";

export type ZdEstimateDepartmentSettingsMenuProps = {
  exclusionsCount: number;
  onRequestsCount: number;
  packagingCount: number;
  pairsCount: number;
  bomsCount: number;
  onOpenExclusions: () => void;
  onOpenOnRequest: () => void;
  onOpenPackaging: () => void;
  onOpenPairs: () => void;
  onOpenBoms: () => void;
  disabled?: boolean;
  /** Krótki trigger na wąskich nagłówkach. */
  compact?: boolean;
};

/**
 * Reguły listy Do ZD (katalog) — bez zakresów dostawców i historii ZD
 * (te są w {@link ZdEstimateSuppliersMenu}).
 */
export function ZdEstimateDepartmentSettingsMenu({
  exclusionsCount,
  onRequestsCount,
  packagingCount,
  pairsCount,
  bomsCount,
  onOpenExclusions,
  onOpenOnRequest,
  onOpenPackaging,
  onOpenPairs,
  onOpenBoms,
  disabled,
  compact = false,
}: ZdEstimateDepartmentSettingsMenuProps) {
  const suffix = (n: number) => (n > 0 ? ` (${n})` : "");
  return (
    <OverflowMenu
      label={ZD_ESTIMATE_UI.departmentSettingsMenuAriaLabel}
      triggerLabel={
        compact
          ? ZD_ESTIMATE_UI.departmentSettingsMenuTriggerCompact
          : ZD_ESTIMATE_UI.departmentSettingsMenuTrigger
      }
      triggerLeading={
        <IconSettings
          size={15}
          strokeWidth={2}
          className="shrink-0 opacity-90"
        />
      }
      triggerTrailing={
        <IconChevronDown
          size={14}
          strokeWidth={2.25}
          className="shrink-0 opacity-70"
        />
      }
      align="end"
      disabled={disabled}
      triggerClassName={panelToolbarTextButtonClass}
      menuClassName="min-w-[14rem]"
    >
      <OverflowMenuLabel>Jak liczyć Do ZD</OverflowMenuLabel>
      <OverflowMenuItem disabled={disabled} onClick={onOpenExclusions}>
        Wykluczenia{suffix(exclusionsCount)}
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenOnRequest}>
        Tylko na prośbę{suffix(onRequestsCount)}
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenPackaging}>
        Opakowania{suffix(packagingCount)}
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenPairs}>
        Pary{suffix(pairsCount)}
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenBoms}>
        {ZD_BOM_UI.panelTitle}
        {suffix(bomsCount)}
      </OverflowMenuItem>
    </OverflowMenu>
  );
}
