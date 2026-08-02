"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isAuthLayoutPath } from "@/lib/auth/auth-layout-paths";
import { playToastNotificationSound } from "@/lib/client/notification-sound";

/**
 * Dźwięk przy pokazaniu toastu / undo.
 * Nie gra na ekranach auth. `pathname` tylko bramkuje — nie jest w deps efektu dźwięku,
 * żeby zmiana trasy przy wiszącym toascie nie odpalała dźwięku drugi raz.
 */
export function useToastNotificationSound(title?: string, description?: string): void {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const hasContent = Boolean(title?.trim() || description?.trim());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!hasContent) return;
    const path = pathnameRef.current;
    if (path && isAuthLayoutPath(path)) return;
    void playToastNotificationSound();
  }, [title, description, hasContent]);
}
