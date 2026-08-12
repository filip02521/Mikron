"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { redirectToLoginForLostSession } from "@/lib/auth/session-login-redirect";

/**
 * Gdy sesja Supabase znika w tle (wygaśnięcie / failed refresh),
 * od razu pełne przejście na /login — bez „martwego” UI do odświeżenia.
 */
export function AuthSessionGuard() {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const ensureSessionOrRedirect = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") return;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !data.user) {
          redirectToLoginForLostSession();
        }
      } catch {
        if (!cancelled) redirectToLoginForLostSession();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      // Nie reaguj na INITIAL_SESSION — unikamy race przy hydracji cookies.
      if (event === "SIGNED_OUT") {
        redirectToLoginForLostSession();
      }
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void ensureSessionOrRedirect();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Po powrocie do karty / dłuższej bezczynności — sprawdź sesję (bez czekania na klik).
    const intervalId = window.setInterval(() => {
      void ensureSessionOrRedirect();
    }, 60_000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
