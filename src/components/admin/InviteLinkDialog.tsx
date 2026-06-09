"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import type { SalesInviteLinkResult } from "@/lib/users/sales-invite";

export function InviteLinkDialog({
  invite,
  onClose,
}: {
  invite: SalesInviteLinkResult;
  onClose: () => void;
}) {
  const hint =
    invite.mode === "invite"
      ? "Wyślij ten link handlowcowi (e-mail, Teams, SMS). Po otwarciu ustawi hasło i od razu będzie powiązany ze swoją kartą."
      : "Konto z tym adresem już istnieje — link służy do ustawienia hasła i potwierdzenia powiązania z kartą handlowca.";

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Link zaproszenia"
      titleId="invite-title"
      size="md"
      tier="raised"
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite.link);
              } catch {
                /* ignore */
              }
            }}
          >
            Kopiuj link
          </Button>
          <Button onClick={onClose}>Gotowe</Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-800">{invite.salesPersonName}</span>
        {" · "}
        {invite.email}
      </p>
      <p className="mt-3 text-sm text-slate-500">{hint}</p>
      <p className="mt-2 text-sm text-slate-500">
        Link jest jednorazowy i wygasa po ok. 24 godzinach. Skopiuj cały adres URL —
        po otwarciu użytkownik trafi na stronę ustawiania hasła.
      </p>
      <div className="mt-4">
        <Input
          readOnly
          value={invite.link}
          className="font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
      </div>
    </ModalShell>
  );
}
