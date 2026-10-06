"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { actionDisconnectGmail, actionSaveEmailSignature } from "@/app/actions/gmail";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconMail } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass, controlFocusClass, salesChromeInsetClass } from "@/lib/ui/ontime-theme";

const SIGNATURE_PLACEHOLDER = "Pozdrawiam / Best regards\nImię Nazwisko\nDział dostaw\ntel. 61 847 58 58\nMikran sp. z o.o.";

/** Połączenie z firmowym Gmailem — wysyłka zamówień ZD z własnej skrzynki. */
export function GmailSettingsSection({
  connectedEmail,
  signature: savedSignature,
}: {
  connectedEmail: string | null;
  signature: string;
}) {
  const router = useRouter();
  const signatureId = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState(savedSignature);
  const [signatureSaved, setSignatureSaved] = useState(savedSignature);
  const [savingSignature, startSaveSignature] = useTransition();
  const [signatureInfo, setSignatureInfo] = useState<string | null>(null);

  const saveSignature = () =>
    startSaveSignature(async () => {
      setSignatureInfo(null);
      try {
        const res = await actionSaveEmailSignature(signature);
        if (!res.ok) {
          setSignatureInfo(res.message);
          return;
        }
        setSignatureSaved(signature.trim());
        setSignatureInfo("Zapisano podpis.");
      } catch {
        setSignatureInfo("Nie udało się zapisać podpisu. Spróbuj ponownie.");
      }
    });

  const disconnect = () =>
    start(async () => {
      setError(null);
      try {
        await actionDisconnectGmail();
        router.refresh();
      } catch {
        setError("Nie udało się odłączyć Gmaila. Spróbuj ponownie.");
      }
    });

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Gmail"
        description="Wysyłanie zamówień do dostawców z Twojej skrzynki. OnTime może tylko wysyłać — nie czyta poczty."
        leading={
          <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
            <IconMail size={20} />
          </SectionHeadingIcon>
        }
      />
      <div className={cn(salesChromeInsetClass, "flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between")}>
        {connectedEmail ? (
          <>
            <p className="text-sm text-slate-700">
              Połączono: <span className="font-medium text-slate-900">{connectedEmail}</span>. Wysłane maile
              zobaczysz w „Wysłanych” w Gmailu.
            </p>
            <Button type="button" variant="ghost" className="min-h-10 shrink-0" disabled={pending} onClick={disconnect}>
              {pending ? "Odłączam…" : "Odłącz"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              Połącz swoje konto, żeby po utworzeniu ZD wysyłać zamówienie jednym kliknięciem.
            </p>
            <a
              href="/api/google/connect?returnTo=/ustawienia"
              className={cn(
                buttonPrimaryClass,
                "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
              )}
            >
              <IconMail size={16} aria-hidden />
              Połącz z Gmailem
            </a>
          </>
        )}
      </div>
      {error ? (
        <p className={cn(salesChromeInsetClass, "pb-3 text-sm text-rose-800")} role="alert">
          {error}
        </p>
      ) : null}
      {connectedEmail ? (
        <div className={cn(salesChromeInsetClass, "space-y-2 border-t border-slate-100 py-3.5")}>
          <label htmlFor={signatureId} className="text-sm font-medium text-slate-800">
            Podpis w mailach z OnTime
          </label>
          <p className="text-[11px] leading-snug text-slate-400">
            Gmail nie dokleja tu podpisu ze skrzynki — ten tekst trafi na koniec treści zamówienia (możesz go zmienić
            przed wysyłką).
          </p>
          <textarea
            id={signatureId}
            value={signature}
            onChange={(e) => {
              setSignature(e.target.value);
              setSignatureInfo(null);
            }}
            rows={5}
            maxLength={1000}
            placeholder={SIGNATURE_PLACEHOLDER}
            className={cn(controlFocusClass, "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm")}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="min-h-10"
              disabled={savingSignature || signature.trim() === signatureSaved.trim()}
              onClick={saveSignature}
            >
              {savingSignature ? "Zapisuję…" : "Zapisz podpis"}
            </Button>
            {signatureInfo ? (
              <p className="text-sm text-slate-600" role="status">
                {signatureInfo}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
