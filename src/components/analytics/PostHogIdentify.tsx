"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/** Łączy zdarzenia z kontem (id + rola, bez imienia i maila); po wylogowaniu zaczyna nową osobę. */
export function PostHogIdentify({ userId, role }: { userId: string | null; role: string | null }) {
  useEffect(() => {
    if (!posthog.__loaded) return;
    const current = posthog.get_distinct_id();
    // Wspólny komputer: inne konto bez wylogowania — nowa sesja i nagranie, nie dalsze cudzej osoby.
    if (posthog._isIdentified() && current !== userId) posthog.reset();
    if (!userId) return;
    if (current !== userId) posthog.identify(userId, { role });
    else posthog.setPersonProperties({ role });
  }, [userId, role]);
  return null;
}
