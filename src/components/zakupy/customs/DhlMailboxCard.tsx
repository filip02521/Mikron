"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionDisconnectSharedMailbox } from "@/app/actions/customs-dhl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";

const CONNECT_HREF = "/api/google/connect?shared=1&returnTo=/zakupy/odprawy";

/** Skrzynka wspólna (office@), do której DHL wysyła prośby o odprawę — tylko odczyt maili DHL. */
export function DhlMailboxCard({ mailboxes }: { mailboxes: { email: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disconnect = (email: string) =>
    start(async () => {
      setError(null);
      const res = await actionDisconnectSharedMailbox(email);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-slate-900">Maile DHL ze skrzynki wspólnej</p>
        <p className="text-sm text-slate-600">
          {mailboxes.length
            ? `Czytane: ${mailboxes.map((m) => m.email).join(", ")} - tylko maile Agencji Celnej DHL, nic stąd nie wysyłamy.`
            : "Prośby DHL przychodzą na office@. Podłącz ją (logowanie w Google na tę skrzynkę), żeby odprawa zakładała się od razu."}
        </p>
        {error ? (
          <p className="text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {mailboxes.map((m) => (
          <Button key={m.email} variant="ghost" size="sm" disabled={pending} onClick={() => disconnect(m.email)}>
            Odłącz {m.email}
          </Button>
        ))}
        {!mailboxes.length ? (
          <a
            href={CONNECT_HREF}
            className={cn(buttonPrimaryClass, "inline-flex min-h-10 items-center rounded-md px-4 text-sm font-medium")}
          >
            Podłącz skrzynkę
          </a>
        ) : null}
      </div>
    </Card>
  );
}
