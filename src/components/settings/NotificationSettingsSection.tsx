"use client";

import { useCallback } from "react";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { salesBoardAnswerSoundMutedStore, isSalesBoardAnswerSoundEnabled } from "@/lib/client/sales-board-answer-sound";
import { boardQuestionsSoundMutedStore, isBoardQuestionsSoundEnabled } from "@/lib/client/board-questions-sound";
import { unlockNotificationSound } from "@/lib/client/notification-sound";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconBell } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography, panelTypography } from "@/lib/ui/ontime-theme";
import type { UserRole } from "@/types/database";

type NotificationSettingsSectionProps = {
  role: UserRole;
};

export function NotificationSettingsSection({ role }: NotificationSettingsSectionProps) {
  const isSales = role === "sales" || role === "sales_manager";
  const isOperations = role === "admin" || role === "zakupy" || role === "zakupy_zeby" || role === "magazyn";

  const salesMuted = usePersistedFlag(salesBoardAnswerSoundMutedStore);
  const opsMuted = usePersistedFlag(boardQuestionsSoundMutedStore);
  const hydrated = useClientHydrated();

  const salesSound = hydrated ? isSalesBoardAnswerSoundEnabled(salesMuted) : false;
  const opsSound = hydrated ? isBoardQuestionsSoundEnabled(opsMuted) : false;

  const setSalesSound = useCallback((value: boolean) => {
    salesBoardAnswerSoundMutedStore.setValue(!value);
    if (value) void unlockNotificationSound();
  }, []);

  const setOpsSound = useCallback((value: boolean) => {
    boardQuestionsSoundMutedStore.setValue(!value);
    if (value) void unlockNotificationSound();
  }, []);

  const typography = isSales ? salesTypography : panelTypography;

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Powiadomienia dźwiękowe"
        description="Ustaw powiadomienia dźwiękowe dla swojego panelu."
        leading={
          <SectionHeadingIcon tileClassName="bg-amber-100 text-amber-800">
            <IconBell size={20} />
          </SectionHeadingIcon>
        }
      />
      <div className={cn(salesChromeInsetClass, "space-y-3 py-3")}>
        {isSales ? (
          <label
            className={cn(
              "inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 font-medium shadow-sm transition-colors",
              typography.chrome,
              salesSound
                ? "border-amber-200/90 bg-amber-50/45 text-amber-950"
                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-amber-100 hover:bg-amber-50/25"
            )}
          >
            <span className="whitespace-nowrap">Dźwięk przy powiadomieniach</span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={salesSound}
              aria-label="Powiadomienie dźwiękowe, gdy pojawi się nowa pilna sprawa w dzwonku"
              checked={salesSound}
              onChange={(e) => setSalesSound(e.target.checked)}
              className="size-5 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-300 sm:size-4"
            />
          </label>
        ) : null}

        {isOperations ? (
          <label
            className={cn(
              "inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 font-medium shadow-sm transition-colors",
              typography.chrome,
              opsSound
                ? "border-amber-200/90 bg-amber-50/45 text-amber-950"
                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-amber-100 hover:bg-amber-50/25"
            )}
          >
            <span className="whitespace-nowrap">Dźwięk przy pytaniu</span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={opsSound}
              aria-label="Powiadomienie dźwiękowe, gdy handlowiec doda pytanie na tablicy"
              checked={opsSound}
              onChange={(e) => setOpsSound(e.target.checked)}
              className="size-5 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-300 sm:size-4"
            />
          </label>
        ) : null}

        {!isSales && !isOperations ? (
          <p className="py-2 text-center text-sm text-slate-500">
            Brak dostępnych ustawień dźwięku dla Twojej roli.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
