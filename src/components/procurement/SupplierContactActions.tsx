"use client";

import { useState } from "react";
import { buildSupplierContactUi } from "@/lib/orders/supplier-contact";
import { copyTextToClipboard } from "@/lib/ui/copy-text-to-clipboard";
import { OrderMethodBadge } from "@/components/targets/OrderMethodBadge";
import { cn } from "@/lib/cn";
import { panelContactLinkClass } from "@/lib/ui/ontime-theme";
import { IconCopy } from "@/components/icons/StrokeIcons";

function normalizeEmailForCopy(raw: string): string {
  return raw.replace(/^mailto:/i, "").trim();
}

export function SupplierContactActions({
  notes,
  mails,
  extraInfo,
  className,
  display = "block",
}: {
  notes: string;
  mails: string;
  extraInfo?: string;
  className?: string;
  /** W linii meta wiersza panelu (kompaktowo, bez dużego badge). */
  display?: "block" | "rowMeta";
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const ui = buildSupplierContactUi(notes, mails, extraInfo);
  const rawEmail =
    ui.email ??
    (ui.contactLink?.kind === "mailto" ? ui.contactLink.label : null);
  const emailToCopy = rawEmail ? normalizeEmailForCopy(rawEmail) : "";

  const copyText = async (text: string) => {
    if (!text) return;
    setCopyFailed(false);
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return;
    }
    setCopyFailed(true);
    window.setTimeout(() => setCopyFailed(false), 3000);
  };

  const copyContact = () => void copyText(ui.copyText ?? "");
  const copyEmail = () => {
    if (emailToCopy) void copyText(emailToCopy);
  };

  const mailCopyTitle = emailToCopy
    ? copied
      ? "Skopiowano"
      : copyFailed
        ? "Nie udało się skopiować"
        : `Kliknij, aby skopiować: ${emailToCopy}`
    : undefined;

  const copyFeedbackLabel = copied
    ? "Skopiowano"
    : copyFailed
      ? "Błąd kopiowania"
      : null;

  if (display === "rowMeta") {
    if (!ui.contactLink && !ui.copyText && !notes.trim()) {
      return <span className="text-slate-400">Brak kontaktu</span>;
    }
    return (
      <>
        <span className="text-slate-600">{ui.methodLabel}</span>
        {ui.contactLink?.kind === "mailto" && emailToCopy ? (
          <>
            {" · "}
            <button
              type="button"
              onClick={copyEmail}
              className="font-medium text-indigo-700/85 transition-colors hover:text-indigo-950"
              title={mailCopyTitle}
            >
              {copyFeedbackLabel ?? emailToCopy}
            </button>
          </>
        ) : ui.contactLink ? (
          <>
            {" · "}
            <a
              href={ui.contactLink.href}
              target={ui.contactLink.kind === "url" ? "_blank" : undefined}
              rel={ui.contactLink.kind === "url" ? "noopener noreferrer" : undefined}
              className={cn(panelContactLinkClass, "inline max-w-[min(100%,14rem)] align-baseline")}
              title={ui.copyText ?? ui.contactLink.label}
            >
              {ui.contactLink.label}
            </a>
          </>
        ) : ui.copyText ? (
          <>
            {" · "}
            <button
              type="button"
              onClick={copyContact}
              className="font-medium text-indigo-700/85 transition-colors hover:text-indigo-950"
              title={ui.copyText}
            >
              {copyFeedbackLabel ?? "Kopiuj kontakt"}
            </button>
          </>
        ) : null}
      </>
    );
  }

  if (!ui.contactLink && !ui.copyText) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <OrderMethodBadge notes={notes} />
        <span className="text-xs text-slate-400">Brak kontaktu w karcie</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {/* Plakietka mówi tylko, jak zamawiamy — kopiowanie ma własny, widoczny przycisk (wcześniej klikalna plakietka wyglądała jak etykieta). */}
      <OrderMethodBadge notes={notes} />
      {ui.contactLink?.kind === "mailto" && emailToCopy ? (
        <>
          <span className="select-all break-all text-sm text-slate-800">{emailToCopy}</span>
          <button
            type="button"
            onClick={copyEmail}
            aria-label={`Kopiuj adres ${emailToCopy}`}
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-card px-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              copied && "text-emerald-700",
              copyFailed && "text-red-700"
            )}
          >
            <IconCopy size={13} aria-hidden />
            {copyFeedbackLabel ?? "Kopiuj"}
          </button>
        </>
      ) : ui.contactLink ? (
        <a
          href={ui.contactLink.href}
          target={ui.contactLink.kind === "url" ? "_blank" : undefined}
          rel={ui.contactLink.kind === "url" ? "noopener noreferrer" : undefined}
          className={panelContactLinkClass}
          title={ui.copyText ?? ui.contactLink.label}
        >
          {ui.contactLink.label}
        </a>
      ) : (
        <button
          type="button"
          onClick={copyContact}
          className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-800"
          title={ui.copyText ?? undefined}
        >
          {copyFeedbackLabel ?? "Kopiuj kontakt"}
        </button>
      )}
    </div>
  );
}
