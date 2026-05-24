"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { actionFinalizeSalesPersonInvite } from "@/app/actions/users";
import { actionClearMustChangePassword } from "@/app/actions/sales-manager";

export function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcedChange = searchParams.get("wymagane") === "1";
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("Hasła nie są identyczne.");
      return;
    }
    if (password.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const finalize = await actionFinalizeSalesPersonInvite();
    if ("error" in finalize) {
      setError(finalize.error);
      return;
    }

    await actionClearMustChangePassword();

    router.push("/");
    router.refresh();
  }

  if (!ready) {
    return (
      <Alert tone="info">
        {forcedChange
          ? "Zaloguj się hasłem jednorazowym przekazanym przez kierownika, aby ustawić własne hasło."
          : "Otwórz link zaproszenia lub resetu hasła od administratora. Jeśli link wygasł, poproś o nowy w panelu Admin → Handlowcy (przycisk „Link zaproszenia”)."}
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Nowe hasło">
        <Input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Powtórz hasło">
        <Input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
        />
      </Field>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button type="submit" size="lg" className="w-full min-h-11" disabled={loading}>
        {loading ? "Zapisywanie…" : "Zapisz hasło i przejdź do aplikacji"}
      </Button>
    </form>
  );
}
