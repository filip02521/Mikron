"use client";

import { IconCheck, IconMonitor, IconMoon, IconSun } from "@/components/icons/StrokeIcons";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { THEME_LABELS, THEME_ORDER, type ThemePreference } from "@/lib/auth/theme";
import { cn } from "@/lib/cn";
import { chooseTheme, useThemePreference } from "./use-theme-preference";

const THEME_ICON = { light: IconSun, dark: IconMoon, system: IconMonitor } as const;
const THEME_ARIA: Record<ThemePreference, string> = {
  light: "Jasny motyw",
  dark: "Ciemny motyw",
  system: "Motyw jak w systemie",
};

/**
 * Jeden stan motywu w każdym miejscu: `labelled` (Ustawienia), `sheet` (arkusz „Więcej”),
 * `icons` (stopka menu bocznego), `menu` (zwinięte menu — jeden przycisk z listą).
 * Bez sesji nic nie pokazuje.
 */
export function ThemeSwitch({
  variant,
  fallback,
  className,
}: {
  variant: "labelled" | "sheet" | "icons" | "menu";
  /** Wartość z serwera, zanim wspólny stan się wypełni (Ustawienia). */
  fallback?: ThemePreference;
  className?: string;
}) {
  const value = useThemePreference(fallback);
  if (!value) return null;

  if (variant === "menu") {
    const Current = THEME_ICON[value];
    return (
      <OverflowMenu
        label={`Motyw: ${THEME_LABELS[value]}`}
        align="start"
        iconOnly
        triggerLeading={<Current size={16} />}
        triggerClassName="h-9 w-9 shadow-sm"
        className={className}
      >
        {THEME_ORDER.map((option) => {
          const Icon = THEME_ICON[option];
          return (
            <OverflowMenuItem key={option} onClick={() => chooseTheme(option)}>
              <span className="flex items-center gap-2">
                <Icon size={16} />
                <span className="flex-1">{THEME_LABELS[option]}</span>
                {option === value ? <IconCheck size={14} className="text-indigo-700" /> : null}
              </span>
            </OverflowMenuItem>
          );
        })}
      </OverflowMenu>
    );
  }

  const iconsOnly = variant === "icons";
  const control = (
    <SegmentedControl
      value={value}
      onChange={chooseTheme}
      ariaLabel="Motyw"
      touchFriendly={!iconsOnly}
      className={cn(!iconsOnly && "w-full sm:w-auto", variant === "labelled" && className)}
      options={THEME_ORDER.map((option) => {
        const Icon = THEME_ICON[option];
        return {
          value: option,
          title: iconsOnly ? THEME_LABELS[option] : undefined,
          label: iconsOnly ? (
            <span className="flex items-center justify-center">
              <Icon size={16} />
              <span className="sr-only">{THEME_ARIA[option]}</span>
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5">
              {/* Na telefonie same etykiety: z ikonami trzy segmenty nie mieszczą się w 375 px. */}
              <Icon size={16} className="hidden sm:block" />
              {THEME_LABELS[option]}
            </span>
          ),
        };
      })}
    />
  );
  if (variant === "sheet") {
    return (
      <div className={cn("space-y-2 border-t border-slate-100 px-3 pt-3", className)}>
        <p className="text-xs font-medium text-slate-500">Motyw</p>
        {control}
      </div>
    );
  }
  if (!iconsOnly) return control;
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span className="text-xs font-medium text-slate-500">Motyw</span>
      {control}
    </div>
  );
}
