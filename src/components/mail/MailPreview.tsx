"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconAlertCircle, IconDownload, IconEye, IconX } from "@/components/icons/StrokeIcons";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { parseEmailList } from "@/lib/customs/customs-email";
import { plainTextEmailHtml } from "@/lib/email/plain-text-html";

export type MailPreviewAttachment = {
  name: string;
  /** Bajty; null = jeszcze nieznany (plik się przygotowuje). */
  size: number | null;
  /** Adres tego samego pliku, który wyjdzie w mailu. */
  href: string | null;
  /** PDF i obrazy otwierają się w karcie, reszta się pobiera. */
  opensInline?: boolean;
  /** Plik dołożony ręcznie — można go zdjąć przed wysyłką. */
  onRemove?: () => void;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * „Tak zobaczy to odbiorca”: nadawca, odbiorcy, temat, załączniki i treść wyrenderowana tą samą funkcją
 * co wysyłka (`plainTextEmailHtml`), w odizolowanej ramce bez skryptów. Podgląd = wysyłka.
 */
export function MailPreview({
  from,
  to,
  cc,
  subject,
  text,
  attachments,
  attachmentsLoading,
  attachmentsError,
  attachmentsFooter,
  className,
}: {
  from: string | null;
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachments: MailPreviewAttachment[];
  /** Opis trwającego przygotowania, np. „Pobieram wydruk ZD z Subiekta…”. */
  attachmentsLoading?: string | null;
  attachmentsError?: string | null;
  /** Pod listą, np. „Dodaj pliki”. */
  attachmentsFooter?: ReactNode;
  className?: string;
}) {
  const toList = useMemo(() => parseEmailList(to), [to]);
  const ccList = useMemo(() => parseEmailList(cc ?? ""), [cc]);
  const html = useMemo(() => plainTextEmailHtml(text), [text]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState(160);

  // Ramka bez skryptów (sandbox), ale z tym samym originem — rodzic mierzy wysokość treści.
  const fit = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) setFrameHeight(Math.max(120, doc.body.scrollHeight));
  }, []);
  // Węższe okno (telefon, obrót) zawija tekst — wysokość liczona od nowa, żeby nic nie ucięło.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(frame);
    return () => observer.disconnect();
  }, [fit]);

  const totalBytes = attachments.reduce((n, a) => n + (a.size ?? 0), 0);

  return (
    <section
      aria-label="Podgląd wiadomości"
      className={cn("overflow-hidden rounded-[var(--radius-panel)] border border-slate-200 bg-slate-50", className)}
    >
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <IconEye size={16} className="shrink-0 text-slate-500" aria-hidden />
        <h3 className="text-sm font-semibold text-slate-900">Tak zobaczy to odbiorca</h3>
      </header>

      <dl className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b border-slate-200 bg-white px-4 py-3 text-sm">
        <dt className="text-slate-500">Od</dt>
        <dd className={cn("min-w-0 break-words", from ? "text-slate-900" : "font-medium text-red-700")}>
          {from ?? "Gmail niepołączony"}
        </dd>
        <dt className="text-slate-500">Do</dt>
        <dd className="min-w-0 break-words">
          <AddressList emails={toList.emails} invalid={toList.invalid} empty="Brak odbiorcy" />
        </dd>
        {ccList.emails.length || ccList.invalid.length ? (
          <>
            <dt className="text-slate-500">DW</dt>
            <dd className="min-w-0 break-words">
              <AddressList emails={ccList.emails} invalid={ccList.invalid} />
            </dd>
          </>
        ) : null}
        <dt className="text-slate-500">Temat</dt>
        <dd className={cn("min-w-0 break-words font-medium", subject.trim() ? "text-slate-900" : "text-red-700")}>
          {subject.trim() || "Brak tematu"}
        </dd>
      </dl>

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="mb-2 text-xs font-medium text-slate-500">
          {attachments.length
            ? `Załączniki (${attachments.length})${totalBytes ? ` · ${formatFileSize(totalBytes)}` : ""}`
            : "Załączniki"}
        </p>
        {attachmentsError ? (
          <p className="flex items-start gap-1.5 text-sm text-red-700" role="alert">
            <IconAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {attachmentsError}
          </p>
        ) : attachmentsLoading ? (
          <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
            <Spinner size="sm" />
            {attachmentsLoading}
          </p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-slate-500">Bez załączników</p>
        ) : null}
        {attachments.length ? (
          <ul className={cn("space-y-1.5", (attachmentsError || attachmentsLoading) && "mt-2")}>
            {attachments.map((a, i) => (
              <li key={`${i}-${a.name}`} className="flex min-w-0 items-center gap-3 rounded-[var(--radius-control)] bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200">
                <span className="min-w-0 flex-1 break-all text-sm text-slate-900">{a.name}</span>
                {a.size != null ? (
                  <span className="shrink-0 tabular-nums text-xs text-slate-500">{formatFileSize(a.size)}</span>
                ) : null}
                {a.href ? (
                  <a
                    href={a.href}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded px-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45"
                  >
                    {a.opensInline ? <IconEye size={14} aria-hidden /> : <IconDownload size={14} aria-hidden />}
                    {a.opensInline ? "Otwórz" : "Pobierz"}
                  </a>
                ) : null}
                {a.onRemove ? (
                  <button
                    type="button"
                    onClick={a.onRemove}
                    aria-label={`Usuń ${a.name}`}
                    className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45"
                  >
                    <IconX size={14} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {attachmentsFooter}
      </div>

      <div className="p-3 sm:p-4">
        {text.trim() ? (
          <div className="rounded-[var(--radius-surface)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(21,25,32,.06)] ring-1 ring-slate-200">
            <iframe
              ref={frameRef}
              title="Treść wiadomości"
              sandbox="allow-same-origin"
              srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden;word-wrap:break-word}</style></head><body>${html}</body></html>`}
              onLoad={fit}
              style={{ height: frameHeight }}
              className="block w-full border-0"
            />
          </div>
        ) : (
          <p className="text-sm font-medium text-red-700">Treść jest pusta.</p>
        )}
      </div>
    </section>
  );
}

function AddressList({ emails, invalid, empty }: { emails: string[]; invalid: string[]; empty?: string }) {
  if (!emails.length && !invalid.length) {
    return <span className="font-medium text-red-700">{empty ?? "-"}</span>;
  }
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {emails.map((e) => (
        <span key={e} className="text-slate-900">
          {e}
        </span>
      ))}
      {invalid.map((e) => (
        <span key={`x-${e}`} className="font-medium text-red-700" title="Niepoprawny adres">
          {e} (błędny)
        </span>
      ))}
    </span>
  );
}
