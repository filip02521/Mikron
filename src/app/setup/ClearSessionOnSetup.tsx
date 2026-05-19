"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Usuwa stare ciasteczka sesji, żeby nie wyglądało na „zalogowanie” bez konta */
export function ClearSessionOnSetup() {
  useEffect(() => {
    void createClient().auth.signOut();
  }, []);
  return null;
}
