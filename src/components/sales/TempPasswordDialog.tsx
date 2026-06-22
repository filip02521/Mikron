"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useBodyScrollLock } from "@/lib/ui/page-scroll-lock";

export function TempPasswordDialog({
  email,
  salesPersonName,
  tempPassword,
  onClose,
  variant = "create",
}: {
  email: string;
  salesPersonName: string;
  tempPassword: string;
  onClose: () => void;
  /** create = nowe konto, reset = zresetowane hasło */
  variant?: "create" | "reset";
}) {
  useBodyScrollLock(true);

  const isReset = variant === "reset";
  const [copied, setCopied] = useState(false);

  const copyAll = useCallback(async () => {
    const text = [
      `Logowanie do OnTime`,
      `E-mail: ${email}`,
      `Hasło jednorazowe: ${tempPassword}`,
      ``,
      `Po pierwszym logowaniu ustaw własne hasło.`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [email, tempPassword]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-password-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="temp-password-title" className="text-lg font-semibold text-slate-900">
          {isReset ? "Hasło zresetowane" : "Konto utworzone"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {isReset ? (
            <>
              Poprzednie hasło przestało działać. Przekaż nowe dane użytkownikowi{" "}
              <span className="font-medium text-slate-800">{salesPersonName}</span> — przy
              logowaniu ustawi własne hasło.
            </>
          ) : (
            <>
              Przekaż dane osobiście użytkownikowi{" "}
              <span className="font-medium text-slate-800">{salesPersonName}</span>. Przy
              pierwszym logowaniu system poprosi o ustawienie własnego hasła.
            </>
          )}
        </p>
        <dl className="mt-4 space-y-3 rounded-md border border-amber-100 bg-amber-50/80 p-4 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
              E-mail (login)
            </dt>
            <dd className="mt-1 font-mono text-slate-900">{email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
              Hasło jednorazowe
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold tracking-wide text-slate-900">
              {tempPassword}
            </dd>
          </div>
        </dl>
        <Alert tone="warning" className="mt-4 text-xs">
          Hasło nie zostanie ponownie wyświetlone. Skopiuj je teraz lub zapisz w bezpiecznym
          miejscu.
        </Alert>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void copyAll()}>
            {copied ? "Skopiowano" : "Kopiuj dane logowania"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Zamknij
          </Button>
        </div>
      </div>
    </div>
  );
}
