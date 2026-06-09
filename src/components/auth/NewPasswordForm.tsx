"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRequirementsList } from "@/components/auth/PasswordRequirementsList";
import {
  confirmPasswordError,
  evaluatePasswordRequirements,
  isPasswordValid,
  passwordsMatch,
  validateNewPasswordPair,
} from "@/lib/auth/password-policy";

export function NewPasswordForm({
  intro,
  submitLabel,
  loadingLabel = "Zapisywanie…",
  error,
  loading,
  onSubmit,
}: {
  intro?: React.ReactNode;
  submitLabel: string;
  loadingLabel?: string;
  error?: string;
  loading: boolean;
  onSubmit: (password: string) => void | Promise<void>;
}) {
  const requirementsId = useId();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);

  const requirements = useMemo(
    () => evaluatePasswordRequirements(password),
    [password]
  );
  const confirmError = confirmTouched
    ? confirmPasswordError(password, passwordConfirm)
    : null;
  const confirmState =
    passwordConfirm.length > 0 && passwordsMatch(password, passwordConfirm)
      ? "success"
      : confirmError
        ? "error"
        : "default";

  const canSubmit =
    !loading &&
    isPasswordValid(password) &&
    passwordsMatch(password, passwordConfirm);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setConfirmTouched(true);

    const validationError = validateNewPasswordPair(password, passwordConfirm);
    if (validationError) return;

    await onSubmit(password);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {intro}

      <div className="space-y-4">
        <Field
          label="Nowe hasło"
          hint="Użyj kombinacji liter i cyfr — unikaj haseł powszechnych lub łatwych do odgadnięcia."
        >
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            autoFocus
            describedBy={requirementsId}
          />
        </Field>

        <PasswordRequirementsList requirements={requirements} id={requirementsId} />

        <Field
          label="Powtórz hasło"
          error={confirmError ?? undefined}
          state={confirmState}
        >
          <PasswordInput
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
            state={confirmState}
            onBlur={() => setConfirmTouched(true)}
          />
        </Field>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Button
        type="submit"
        size="lg"
        className="w-full min-h-11 transition-opacity"
        disabled={!canSubmit}
      >
        {loading ? loadingLabel : submitLabel}
      </Button>
    </form>
  );
}
