"use client";

import { useOptimistic, useSyncExternalStore, useTransition } from "react";
import { actionSetUniformBackground, actionSetFontScale, actionSetTheme } from "@/app/actions/user-preferences";
import { IconMonitor, IconMoon, IconSun } from "@/components/icons/StrokeIcons";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingToggleRow, settingRowsClass } from "@/components/settings/SettingToggleRow";
import {
  FONT_SCALE_LABELS,
  type FontScale,
} from "@/lib/auth/font-scale";
import { THEME_LABELS, THEME_ORDER, type ThemePreference } from "@/lib/auth/theme";
import { SYSTEM_DARK_QUERY, applyTheme, persistTheme } from "@/lib/ui/theme-client";

type AppearanceSettingsSectionProps = {
  uniformBackground: boolean;
  fontScale: FontScale;
  theme: ThemePreference;
};

const THEME_ICON = { light: IconSun, dark: IconMoon, system: IconMonitor } as const;

function subscribeSystemTheme(onChange: () => void) {
  const media = window.matchMedia(SYSTEM_DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Co system podaje teraz; null na serwerze (bez rozjazdu przy hydracji). */
function useSystemPrefersDark(): boolean | null {
  return useSyncExternalStore(
    subscribeSystemTheme,
    () => window.matchMedia(SYSTEM_DARK_QUERY).matches,
    () => null
  );
}

const FONT_SCALE_ORDER: FontScale[] = ["default", "large", "xlarge"];

export function AppearanceSettingsSection({
  uniformBackground,
  fontScale,
  theme,
}: AppearanceSettingsSectionProps) {
  const [optimisticTheme, setOptimisticTheme] = useOptimistic(theme);
  const systemDark = useSystemPrefersDark();
  const [optimisticBg, setOptimisticBg] = useOptimistic(uniformBackground);
  const [optimisticFont, setOptimisticFont] = useOptimistic(fontScale);
  const [, startTransition] = useTransition();

  function toggleBackground(value: boolean) {
    startTransition(async () => {
      setOptimisticBg(value);
      await actionSetUniformBackground(value);
    });
  }

  function changeTheme(value: ThemePreference) {
    startTransition(async () => {
      setOptimisticTheme(value);
      persistTheme(value);
      applyTheme(value);
      await actionSetTheme(value);
    });
  }

  function changeFontScale(value: FontScale) {
    startTransition(async () => {
      setOptimisticFont(value);
      const html = document.documentElement;
      if (value === "default") {
        html.removeAttribute("data-font-scale");
      } else {
        html.setAttribute("data-font-scale", value);
      }
      try {
        if (value === "default") {
          localStorage.removeItem("fontScale");
        } else {
          localStorage.setItem("fontScale", value);
        }
      } catch {
        // ignore
      }
      await actionSetFontScale(value);
    });
  }

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader inset title="Wygląd" description="Personalizacja interfejsu." />
      <div className={settingRowsClass}>
        <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-900">Motyw</span>
            <span className="text-xs leading-snug text-slate-500">
              {optimisticTheme === "system"
                ? `Zmienia się razem z ustawieniem komputera lub telefonu${systemDark === null ? "" : ` · teraz ${systemDark ? "ciemny" : "jasny"}`}`
                : "Jasne albo ciemne tło całej aplikacji"}
            </span>
          </span>
          <SegmentedControl
            value={optimisticTheme}
            onChange={changeTheme}
            ariaLabel="Motyw"
            touchFriendly
            className="w-full sm:w-auto"
            options={THEME_ORDER.map((value) => {
              const Icon = THEME_ICON[value];
              return {
                value,
                label: (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {/* Na telefonie same etykiety: z ikonami trzy segmenty nie mieszczą się w 375 px. */}
                    <Icon size={16} className="hidden sm:block" />
                    {THEME_LABELS[value]}
                  </span>
                ),
              };
            })}
          />
        </div>
        <SettingToggleRow
          label="Jednolite tło"
          description="Ukrywa okręgi w tle aplikacji - czyste, jednolite tło"
          checked={optimisticBg}
          onChange={toggleBackground}
        />
        <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-900">Rozmiar czcionki</span>
            <span className="text-xs leading-snug text-slate-500">
              Zwiększ czytelność tekstu w całym interfejsie
            </span>
          </span>
          <SegmentedControl
            value={optimisticFont}
            onChange={changeFontScale}
            ariaLabel="Rozmiar czcionki"
            touchFriendly
            className="self-start sm:self-auto"
            options={FONT_SCALE_ORDER.map((scale) => ({ value: scale, label: FONT_SCALE_LABELS[scale] }))}
          />
        </div>
      </div>
    </Card>
  );
}
