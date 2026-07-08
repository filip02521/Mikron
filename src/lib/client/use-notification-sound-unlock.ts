"use client";

import { useEffect } from "react";
import { unlockNotificationSound } from "@/lib/client/notification-sound";

/** Odblokuj audio przy pierwszym geście — toasty/undo na każdej stronie (zęby, magazyn, admin). */
export function useNotificationSoundUnlockOnGesture(): void {
  useEffect(() => {
    const unlock = () => {
      void unlockNotificationSound().then((ok) => {
        if (!ok) return;
        document.removeEventListener("pointerdown", unlock);
        document.removeEventListener("keydown", unlock);
      });
    };

    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);

    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);
}
