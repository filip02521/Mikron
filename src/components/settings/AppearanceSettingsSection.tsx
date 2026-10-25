"use client";

import { useOptimistic, useTransition } from "react";
import { actionSetUniformBackground, actionSetFontScale } from "@/app/actions/user-preferences";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingToggleRow, settingRowsClass } from "@/components/settings/SettingToggleRow";
import {
  FONT_SCALE_LABELS,
  type FontScale,
} from "@/lib/auth/font-scale";

type AppearanceSettingsSectionProps = {
  uniformBackground: boolean;
  fontScale: FontScale;
};

const FONT_SCALE_ORDER: FontScale[] = ["default", "large", "xlarge"];

export function AppearanceSettingsSection({
  uniformBackground,
  fontScale,
}: AppearanceSettingsSectionProps) {
  const [optimisticBg, setOptimisticBg] = useOptimistic(uniformBackground);
  const [optimisticFont, setOptimisticFont] = useOptimistic(fontScale);
  const [, startTransition] = useTransition();

  function toggleBackground(value: boolean) {
    startTransition(async () => {
      setOptimisticBg(value);
      await actionSetUniformBackground(value);
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
        <SettingToggleRow
          label="Jednolite tło"
          description="Ukrywa okręgi w tle aplikacji - czyste, jednolite tło"
          ariaLabel="Jednolite tło - ukrywa okręgi w tle aplikacji"
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
