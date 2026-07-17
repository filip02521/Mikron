"use client";

import { useOptimistic, useTransition } from "react";
import { actionSetUniformBackground, actionSetFontScale } from "@/app/actions/user-preferences";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconGlobe } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";
import {
  FONT_SCALE_LABELS,
  type FontScale,
} from "@/lib/auth/profile";

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
      <CardHeader
        inset
        density="compact"
        title="Wygląd"
        description="Personalizacja interfejsu."
        leading={
          <SectionHeadingIcon tileClassName="bg-sky-100 text-sky-800">
            <IconGlobe size={20} />
          </SectionHeadingIcon>
        }
      />
      <div className={cn(salesChromeInsetClass, "space-y-2.5 py-3.5")}>
        <label
          className={cn(
            "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all",
            optimisticBg
              ? "border-sky-200/80 bg-sky-50/40"
              : "border-slate-200/70 bg-white hover:border-slate-300/80 hover:bg-slate-50/40"
          )}
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-800">Jednolite tło</span>
            <span className="text-[11px] leading-snug text-slate-400">
              Ukrywa okręgi w tle aplikacji — czyste, jednolite tło
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-checked={optimisticBg}
            aria-label="Jednolite tło — ukrywa okręgi w tle aplikacji"
            checked={optimisticBg}
            onChange={(e) => toggleBackground(e.target.checked)}
            className="toggle-switch toggle-sky"
          />
        </label>

        <div className="rounded-lg border border-slate-200/70 bg-white px-3.5 py-2.5">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-800">Rozmiar czcionki</span>
            <span className="text-[11px] leading-snug text-slate-400">
              Zwiększ czytelność tekstu w całym interfejsie
            </span>
          </span>
          <div
            role="radiogroup"
            aria-label="Rozmiar czcionki"
            className="mt-2.5 grid grid-cols-3 gap-1.5"
          >
            {FONT_SCALE_ORDER.map((scale) => {
              const selected = optimisticFont === scale;
              return (
                <button
                  key={scale}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => changeFontScale(scale)}
                  className={cn(
                    "min-h-9 rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-all",
                    selected
                      ? "border-sky-300 bg-sky-50 text-sky-900 shadow-sm"
                      : "border-slate-200/70 bg-white text-slate-600 hover:border-slate-300/80 hover:bg-slate-50/40"
                  )}
                >
                  {FONT_SCALE_LABELS[scale]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
