"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { translateAuthError } from "@/lib/auth-errors";
import { redirectPathAfterLogin } from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();

    await supabase.auth.signOut();

    const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signError) {
      setLoading(false);
      setError(translateAuthError(signError.message));
      return;
    }

    const userId = signData.user?.id;
    if (!userId) {
      setLoading(false);
      setError("Nie udało się odczytać sesji.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", userId)
      .maybeSingle();

    setLoading(false);

    if (profileError || !profile) {
      setError("Brak profilu użytkownika — skontaktuj się z administratorem.");
      await supabase.auth.signOut();
      return;
    }

    if (profile.must_change_password) {
      router.push("/ustaw-haslo?wymagane=1");
      router.refresh();
      return;
    }

    const dest = redirectPathAfterLogin(profile.role as UserRole, next);
    router.push(dest);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="E-mail">
        <Input
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Hasło">
        <Input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        type="submit"
        size="lg"
        className="w-full min-h-11 transition-opacity"
        disabled={loading}
      >
        {loading ? "Logowanie…" : "Zaloguj się"}
      </Button>
    </form>
  );
}
