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
  triggerClassName?: string;
};

function MenuOption({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count: number;
}) {
  const suffix = count > 0 ? ` (${count})` : "";
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium text-slate-900">
        {title}
        {suffix}
      </span>
      <span className="text-[11px] font-normal leading-snug text-slate-500">
        {description}
      </span>
    </span>
  );
}

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
  triggerClassName,
}: ZdEstimateDepartmentSettingsMenuProps) {
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
          size={14}
          strokeWidth={2}
          className="shrink-0 opacity-90"
        />
      }
      triggerTrailing={
        <IconChevronDown
          size={13}
          strokeWidth={2.25}
          className="shrink-0 opacity-70"
        />
      }
      align="end"
      disabled={disabled}
      triggerClassName={triggerClassName ?? panelToolbarTextButtonClass}
      menuClassName="min-w-[18rem] max-w-[22rem]"
    >
      <OverflowMenuLabel>{ZD_ESTIMATE_UI.menuRulesGroupLabel}</OverflowMenuLabel>
      <OverflowMenuItem disabled={disabled} onClick={onOpenExclusions}>
        <MenuOption
          title={ZD_ESTIMATE_UI.menuExclusionsTitle}
          description={ZD_ESTIMATE_UI.menuExclusionsDescription}
          count={exclusionsCount}
        />
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenOnRequest}>
        <MenuOption
          title={ZD_ESTIMATE_UI.menuOnRequestTitle}
          description={ZD_ESTIMATE_UI.menuOnRequestDescription}
          count={onRequestsCount}
        />
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenPackaging}>
        <MenuOption
          title={ZD_ESTIMATE_UI.menuPackagingTitle}
          description={ZD_ESTIMATE_UI.menuPackagingDescription}
          count={packagingCount}
        />
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenPairs}>
        <MenuOption
          title={ZD_ESTIMATE_UI.menuPairsTitle}
          description={ZD_ESTIMATE_UI.menuPairsDescription}
          count={pairsCount}
        />
      </OverflowMenuItem>
      <OverflowMenuItem disabled={disabled} onClick={onOpenBoms}>
        <MenuOption
          title={ZD_BOM_UI.panelTitle}
          description={ZD_ESTIMATE_UI.menuBomsDescription}
          count={bomsCount}
        />
      </OverflowMenuItem>
    </OverflowMenu>
  );
}
