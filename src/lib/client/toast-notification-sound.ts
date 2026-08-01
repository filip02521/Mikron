import { createPersistedFlagStore } from "@/lib/client/persisted-flag-store";

export const TOAST_NOTIFICATION_SOUND_MUTED_KEY = "toast-notification-sound-muted";

export const toastNotificationSoundMutedStore = createPersistedFlagStore(
  TOAST_NOTIFICATION_SOUND_MUTED_KEY
);

export function isToastNotificationSoundEnabled(muted: boolean): boolean {
  return !muted;
}
