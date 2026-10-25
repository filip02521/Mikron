"use client";

import { useCallback } from "react";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { salesBoardAnswerSoundMutedStore, isSalesBoardAnswerSoundEnabled } from "@/lib/client/sales-board-answer-sound";
import { boardQuestionsSoundMutedStore, isBoardQuestionsSoundEnabled } from "@/lib/client/board-questions-sound";
import {
  toastNotificationSoundMutedStore,
  isToastNotificationSoundEnabled,
} from "@/lib/client/toast-notification-sound";
import { unlockNotificationSound } from "@/lib/client/notification-sound";
import { Card, CardHeader } from "@/components/ui/Card";
import { SettingToggleRow, settingRowsClass } from "@/components/settings/SettingToggleRow";
import type { UserRole } from "@/types/database";

type NotificationSettingsSectionProps = {
  role: UserRole;
};

export function NotificationSettingsSection({ role }: NotificationSettingsSectionProps) {
  const isSales = role === "sales" || role === "sales_manager";
  const isOperations = role === "admin" || role === "zakupy" || role === "zakupy_zeby" || role === "magazyn";

  const salesMuted = usePersistedFlag(salesBoardAnswerSoundMutedStore);
  const opsMuted = usePersistedFlag(boardQuestionsSoundMutedStore);
  const toastMuted = usePersistedFlag(toastNotificationSoundMutedStore);
  const hydrated = useClientHydrated();

  const salesSound = hydrated ? isSalesBoardAnswerSoundEnabled(salesMuted) : false;
  const opsSound = hydrated ? isBoardQuestionsSoundEnabled(opsMuted) : false;
  const toastSound = hydrated ? isToastNotificationSoundEnabled(toastMuted) : false;

  const setSalesSound = useCallback((value: boolean) => {
    salesBoardAnswerSoundMutedStore.setValue(!value);
    if (value) void unlockNotificationSound();
  }, []);

  const setOpsSound = useCallback((value: boolean) => {
    boardQuestionsSoundMutedStore.setValue(!value);
    if (value) void unlockNotificationSound();
  }, []);

  const setToastSound = useCallback((value: boolean) => {
    toastNotificationSoundMutedStore.setValue(!value);
    if (value) void unlockNotificationSound();
  }, []);

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        title="Powiadomienia dźwiękowe"
        description="Ustaw powiadomienia dźwiękowe dla swojego panelu."
      />
      <div className={settingRowsClass}>
        {isSales ? (
          <SettingToggleRow
            label="Dźwięk przy odpowiedzi na Tablicy"
            description="Odtwarza dźwięk, gdy dział zakupów odpowie na Twoje pytanie"
            ariaLabel="Powiadomienie dźwiękowe przy odpowiedzi na pytanie na Tablicy"
            checked={salesSound}
            onChange={setSalesSound}
          />
        ) : null}
        {isOperations ? (
          <SettingToggleRow
            label="Dźwięk przy pytaniu"
            description="Odtwarza dźwięk, gdy handlowiec doda pytanie na tablicy"
            ariaLabel="Powiadomienie dźwiękowe, gdy handlowiec doda pytanie na tablicy"
            checked={opsSound}
            onChange={setOpsSound}
          />
        ) : null}
        <SettingToggleRow
          label="Dźwięk toastów"
          description="Odtwarza dźwięk przy komunikatach potwierdzenia i cofania"
          ariaLabel="Powiadomienie dźwiękowe przy toastach"
          checked={toastSound}
          onChange={setToastSound}
        />
      </div>
    </Card>
  );
}
