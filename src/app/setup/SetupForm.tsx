"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { actionBootstrapAdmin } from "@/app/actions/setup";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { translateAuthError } from "@/lib/auth-errors";

export function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(nextPassword: string) {
    setError("");

    if (!email.trim()) {
      setError("Podaj adres e-mail administratora.");
      return;
    }

    setLoading(true);

    const result = await actionBootstrapAdmin({ email, password: nextPassword });
    if ("error" in result) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: nextPassword,
    });
    setLoading(false);

    if (signError) {
      setError(
        `Konto utworzone, ale logowanie nie powiodło się: ${translateAuthError(signError.message)}. Zaloguj się ręcznie.`
      );
      router.push("/login");
      return;
    }

    router.push("/podsumowanie");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Alert tone="info">
        To jednorazowa konfiguracja. Po utworzeniu konta administratora ten ekran zniknie.
      </Alert>

      <Field label="E-mail administratora">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@firma.pl"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>

      <NewPasswordForm
        submitLabel="Utwórz konto administratora"
        loadingLabel="Tworzenie konta…"
        error={error}
        loading={loading}
        onSubmit={handlePasswordSubmit}
      />
    </div>
  );
}
