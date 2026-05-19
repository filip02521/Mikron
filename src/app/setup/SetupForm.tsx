"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { actionBootstrapAdmin } from "@/app/actions/setup";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { translateAuthError } from "@/lib/auth-errors";

export function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("Hasła nie są identyczne.");
      return;
    }

    setLoading(true);
    const result = await actionBootstrapAdmin({ email, password });
    if ("error" in result) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
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
    <form onSubmit={onSubmit} className="space-y-5">
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
        />
      </Field>

      <Field label="Hasło (min. 8 znaków)">
        <Input
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <Field label="Powtórz hasło">
        <Input
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
        />
      </Field>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Button type="submit" size="lg" className="w-full min-h-11" disabled={loading}>
        {loading ? "Tworzenie konta…" : "Utwórz konto administratora"}
      </Button>
    </form>
  );
}
