"use client";

import { createClient } from "@/lib/supabase/client";
import {
  markIntentionalLogout,
  redirectToLoginForLostSession,
} from "@/lib/auth/session-login-redirect";

/** Wylogowanie z UI — bez komunikatu „sesja wygasła”, z twardym przejściem na /login. */
export async function signOutToLogin(): Promise<void> {
  markIntentionalLogout();
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // i tak wracamy na login
  }
  redirectToLoginForLostSession({ intentional: true });
}
