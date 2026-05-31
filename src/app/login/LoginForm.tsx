"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { runLoginFlow } from "@/lib/auth/login-flow";
import { loginSessionLostMessage } from "@/lib/auth/login-messages";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const reason = searchParams.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reason === "session") {
      setError(loginSessionLostMessage());
    }
  }, [reason]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await runLoginFlow(email, password, next);

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    window.location.assign(result.redirectTo);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <noscript>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Do logowania wymagany jest JavaScript w przeglądarce.
        </p>
      </noscript>
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
      {error ? <Alert tone="error">{error}</Alert> : null}
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
