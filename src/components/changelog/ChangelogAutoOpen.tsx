"use client";

import { useEffect } from "react";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { useChangelog } from "@/components/changelog/ChangelogProvider";

export function ChangelogAutoOpen() {
  const { hasUnseen, openModal } = useChangelog();
  const hydrated = useClientHydrated();

  useEffect(() => {
    if (!hydrated || !hasUnseen) return;
    const timer = window.setTimeout(() => openModal(), 800);
    return () => window.clearTimeout(timer);
  }, [hydrated, hasUnseen, openModal]);

  return null;
}
