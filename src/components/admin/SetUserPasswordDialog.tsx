"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { isPasswordValid } from "@/lib/auth/password-policy";

export function SetUserPasswordDialog({
  open,
  email,
  pending,
  password,
  onPasswordChange,
  onClose,
  onSave,
}: {
  open: boolean;
  email: string;
  pending?: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Ustaw hasło"
      description={email}
      titleId="set-user-password-title"
      size="sm"
      tier="raised"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Zapisywanie hasła…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onClose}
            disabled={pending}
          >
            Anuluj
          </Button>
          <Button
            className="min-h-11 w-full sm:w-auto"
            disabled={pending || !isPasswordValid(password)}
            onClick={onSave}
          >
            Zapisz hasło
          </Button>
        </div>
      }
    >
      <Field label="Nowe hasło" hint="Min. 8 znaków, litera i cyfra.">
        <Input
          type="password"
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
        />
      </Field>
    </ModalShell>
  );
}
