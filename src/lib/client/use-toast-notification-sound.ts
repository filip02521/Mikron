"use client";

import { useEffect } from "react";
import { playToastNotificationSound } from "@/lib/client/notification-sound";

/** Dźwięk przy pokazaniu toastu / undo — wspólna logika dla Toast i UndoToast. */
export function useToastNotificationSound(title?: string, description?: string): void {
  useEffect(() => {
    void playToastNotificationSound();
  }, [title, description]);
}
