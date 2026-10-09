"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionMailBoardMove } from "@/app/actions/supplier-mail";
import { IconPaperclip } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CUSTOMS_KIND_LABELS, type CustomsMailKind } from "@/lib/mail-board/triage";
import type { CustomsMailThread } from "@/lib/supplier-mail/data";

/** Kolejność grup: najpierw to, co blokuje towar albo czeka na naszą odpowiedź. */
const KIND_ORDER: CustomsMailKind[] = ["request", "dues", "pickup", "documents", "quote"];
const KIND_TONE: Record<CustomsMailKind, "warning" | "danger" | "info" | "default"> = {
  request: "warning",
  dues: "danger",
  pickup: "info",
  documents: "default",
  quote: "default",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });
}

/**
 * Korespondencja agencji celnych i spedytorów (poza DHL Express, który ma swój panel) — z Poczty, bez
 * zaśmiecania tablicy spraw. Należności na już są też na tablicy w „Do zapłaty” (przekazanie do płatności).
 */
export function CustomsMailPanel({ threads }: { threads: CustomsMailThread[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  if (!threads.length) return null;
  const open = threads.filter((t) => t.state === "open");
  const done = threads.filter((t) => t.state !== "open");
  const list = [...open].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.lastAt.localeCompare(a.lastAt));

  const close = (t: CustomsMailThread) => {
    setBusyKey(t.key);
    setError(null);
    startTransition(async () => {
      const res = await actionMailBoardMove({ key: t.key, column: "done" }).catch(() => null);
      setBusyKey(null);
      if (!res?.ok) setError(res?.message ?? "Nie udało się zamknąć sprawy.");
      else router.refresh();
    });
  };

  const row = (t: CustomsMailThread) => (
    <li key={t.key} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {t.company} <span className="font-normal text-slate-500">· {when(t.lastAt)}</span>
          </p>
          <p className="truncate text-sm text-slate-700">{t.subject || "(bez tematu)"}</p>
          <p className="truncate text-xs text-slate-500">{t.snippet}</p>
        </div>
        <Badge variant={t.state === "open" ? KIND_TONE[t.kind] : "default"} className="self-start">
          {t.state === "open" ? CUSTOMS_KIND_LABELS[t.kind] : t.state === "replied" ? "odpowiedziano - czeka na agencję" : "zakończone"}
        </Badge>
      </div>
      {t.attachments.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {t.attachments.map((a) => (
            <li key={`${a.messageId}-${a.attachmentId}`}>
              <a
                href={`/api/operations/supplier-mail/attachment?id=${encodeURIComponent(a.messageId)}&a=${encodeURIComponent(a.attachmentId)}`}
                target="_blank"
                rel="noopener"
                title={a.filename}
                className="inline-flex max-w-[16rem] items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <IconPaperclip size={12} aria-hidden className="shrink-0 text-slate-400" />
                <span className="truncate">{a.filename}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/zakupy/asystent?sprawa=${encodeURIComponent(t.key)}`}
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          {t.kind === "dues" ? "Otwórz i przekaż do zapłaty" : t.kind === "pickup" ? "Otwórz i przekaż magazynowi" : "Otwórz rozmowę i odpowiedz"}
        </Link>
        {t.state !== "done" ? (
          <Button type="button" size="sm" variant="secondary" disabled={pending && busyKey === t.key} onClick={() => close(t)}>
            Zakończone
          </Button>
        ) : null}
      </div>
    </li>
  );

  return (
    <Card>
      <CardHeader
        title="Z maili agencji i spedytorów"
        description="Odpowiedzi agencji celnych, należności, wyceny i awizacje z Poczty (bez DHL Express). Faktury spedytora i SAD wpisz do Subiekta; do zapłaty od razu idą tylko należności przed wydaniem towaru."
      />
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {list.length ? (
        <ul className="mt-3 divide-y divide-slate-100">{list.map(row)}</ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Nic nie czeka - wszystkie sprawy agencji są zakończone.</p>
      )}
      {done.length ? (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="rounded px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            {showDone ? "Ukryj" : `Odpowiedziane i zakończone (${done.length})`}
          </button>
          {showDone ? <ul className="mt-2 divide-y divide-slate-100">{done.map(row)}</ul> : null}
        </div>
      ) : null}
    </Card>
  );
}
