"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/Alert";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";
import { fieldControlClass } from "@/components/ui/Field";
import { AuthFormStatus } from "@/components/auth/AuthFormStatus";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { actionFinalizeSalesPersonInvite } from "@/app/actions/users";
import { actionClearMustChangePassword } from "@/app/actions/sales-manager";
import {
  establishPasswordLinkSession,
  locationHadPasswordLinkTokens,
  scrubPasswordLinkFromLocation,
} from "@/lib/auth/establish-password-link-session";
import {
  translatePasswordLinkError,
  translatePasswordUpdateError,
} from "@/lib/auth/password-link-errors";

type Phase = "checking" | "ready" | "error" | "no_session";

export function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcedChange = searchParams.get("wymagane") === "1";
  const linkError = searchParams.get("blad");

  const [phase, setPhase] = useState<Phase>(() => (linkError ? "error" : "checking"));
  const [sessionError, setSessionError] = useState(() => linkError ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (linkError) {
      const clean = scrubPasswordLinkFromLocation(
        window.location.pathname,
        window.location.search,
        window.location.hash
      );
      if (clean !== `${window.location.pathname}${window.location.search}`) {
        router.replace(clean);
      }
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (!cancelled) setPhase("ready");
      }
    });

    async function init() {
      const result = await establishPasswordLinkSession(supabase, window.location);
      if (cancelled) return;

      if (result.ok) {
        const hadTokens = locationHadPasswordLinkTokens(
          window.location.search,
          window.location.hash
        );
        const clean = scrubPasswordLinkFromLocation(
          window.location.pathname,
          window.location.search,
          window.location.hash
        );
        if (hadTokens || window.location.hash) {
          router.replace(clean);
        }
        setPhase("ready");
        return;
      }

      if (result.error === "missing_session") {
        setPhase("no_session");
        return;
      }

      setSessionError(translatePasswordLinkError(result.error));
      setPhase("error");
    }

    void init();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [linkError, router]);

  async function handlePasswordSubmit(password: string) {
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(translatePasswordUpdateError(updateError.message));
      return;
    }

    const finalize = await actionFinalizeSalesPersonInvite();
    if ("error" in finalize) {
      setLoading(false);
      setError(finalize.error);
      return;
    }

    const cleared = await actionClearMustChangePassword();
    if ("error" in cleared) {
      setLoading(false);
      setError(cleared.error);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (phase === "checking") {
    return <AuthFormStatus label="Weryfikacja linku…" />;
  }

  if (phase === "error") {
    return (
      <div className="space-y-4">
        <Alert tone="error">
          {sessionError || "Nie udało się zweryfikować linku."}
        </Alert>
        <p className="text-sm leading-relaxed text-slate-600">
          Poproś administratora o nowy link w panelu{" "}
          <span className="font-medium text-slate-800">Admin → Handlowcy</span> lub{" "}
          <span className="font-medium text-slate-800">Użytkownicy</span>.
        </p>
        <Link
          href="/login"
          className={cn(
            fieldControlClass("default"),
            "inline-flex w-full min-h-11 items-center justify-center font-medium text-slate-700"
          )}
        >
          Przejdź do logowania
        </Link>
      </div>
    );
  }

  if (phase === "no_session") {
    if (forcedChange) {
      return (
        <div className="space-y-4">
          <Alert tone="info">
            Aby ustawić własne hasło, zaloguj się najpierw hasłem jednorazowym przekazanym
            przez kierownika.
          </Alert>
          <Link
            href="/login?next=%2Fustaw-haslo%3Fwymagane%3D1"
            className={cn(
              buttonPrimaryClass,
              "inline-flex w-full min-h-11 items-center justify-center rounded-md px-5 py-2.5 text-base font-medium"
            )}
          >
            Przejdź do logowania
          </Link>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Alert tone="info">
          Otwórz pełny link zaproszenia lub resetu hasła od administratora — skopiuj cały
          adres URL z wiadomości.
        </Alert>
        <p className="text-sm leading-relaxed text-slate-600">
          Link jest jednorazowy i wygasa po ok. 24 godzinach. Gdy wygasł, administrator może
          wygenerować nowy w panelu Handlowcy lub Użytkownicy.
        </p>
        <Link
          href="/login"
          className={cn(
            fieldControlClass("default"),
            "inline-flex w-full min-h-11 items-center justify-center font-medium text-slate-700"
          )}
        >
          Mam już konto — zaloguj się
        </Link>
      </div>
    );
  }

  return (
    <>
      <noscript>
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Do ustawienia hasła wymagany jest JavaScript w przeglądarce.
        </p>
      </noscript>

      <NewPasswordForm
        intro={
          forcedChange ? (
            <Alert tone="info">
              Ostatni krok bezpieczeństwa — ustaw hasło, którego będziesz używać na co dzień
              zamiast hasła tymczasowego.
            </Alert>
          ) : (
            <Alert tone="info">
              Wybierz bezpieczne hasło do logowania w OnTime. Po zapisaniu przejdziesz od razu do
              aplikacji.
            </Alert>
          )
        }
        submitLabel="Zapisz hasło i przejdź do aplikacji"
        error={error}
        loading={loading}
        onSubmit={handlePasswordSubmit}
      />
    </>
  );
}
