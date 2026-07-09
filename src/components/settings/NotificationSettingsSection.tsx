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
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";
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
      <div className={cn(salesChromeInsetClass, "space-y-2.5 py-3.5")}>
        {isSales ? (
          <label
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all",
              salesSound
                ? "border-amber-200/80 bg-amber-50/40"
                : "border-slate-200/70 bg-white hover:border-slate-300/80 hover:bg-slate-50/40"
            )}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-800">Dźwięk przy powiadomieniach</span>
              <span className="text-[11px] leading-snug text-slate-400">Odtwarza dźwięk, gdy pojawi się nowa pilna sprawa w dzwonku</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={salesSound}
              aria-label="Powiadomienie dźwiękowe, gdy pojawi się nowa pilna sprawa w dzwonku"
              checked={salesSound}
              onChange={(e) => setSalesSound(e.target.checked)}
              className="toggle-switch toggle-amber"
            />
          </label>
        ) : null}

        {isOperations ? (
          <label
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all",
              opsSound
                ? "border-amber-200/80 bg-amber-50/40"
                : "border-slate-200/70 bg-white hover:border-slate-300/80 hover:bg-slate-50/40"
            )}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-800">Dźwięk przy pytaniu</span>
              <span className="text-[11px] leading-snug text-slate-400">Odtwarza dźwięk, gdy handlowiec doda pytanie na tablicy</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={opsSound}
              aria-label="Powiadomienie dźwiękowe, gdy handlowiec doda pytanie na tablicy"
              checked={opsSound}
              onChange={(e) => setOpsSound(e.target.checked)}
              className="toggle-switch toggle-amber"
            />
          </label>
        ) : null}

        {!isSales && !isOperations ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Brak dostępnych ustawień dźwięku dla Twojej roli.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
