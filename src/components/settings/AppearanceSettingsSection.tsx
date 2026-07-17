"use client";

import { useCallback } from "react";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { uniformBackgroundStore } from "@/lib/client/uniform-background-store";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconGlobe } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

export function AppearanceSettingsSection() {
  const uniformBg = usePersistedFlag(uniformBackgroundStore);
  const hydrated = useClientHydrated();
  const value = hydrated ? uniformBg : false;

  const setUniformBg = useCallback((v: boolean) => {
    uniformBackgroundStore.setValue(v);
  }, []);

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
            value
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
            aria-checked={value}
            aria-label="Jednolite tło — ukrywa okręgi w tle aplikacji"
            checked={value}
            onChange={(e) => setUniformBg(e.target.checked)}
            className="toggle-switch toggle-sky"
          />
        </label>
      </div>
    </Card>
  );
}
