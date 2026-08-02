"use client";

import { useEffect } from "react";
import { unlockNotificationSound } from "@/lib/client/notification-sound";

/**
 * Odblokuj audio przy pierwszym geście — toasty/undo w panelu.
 * Na ekranach auth (`enabled=false`) nie podpinaj listenerów — unikamy
 * przypadkowego unlock (i dawniej słyszalnego primingu) na /login.
 */
export function useNotificationSoundUnlockOnGesture(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

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
  }, [enabled]);
}
