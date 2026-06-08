"use client";

import { useState } from "react";
import { buildSupplierContactUi } from "@/lib/orders/supplier-contact";
import { OrderMethodBadge } from "@/components/targets/OrderMethodBadge";
import { cn } from "@/lib/cn";
import { panelContactLinkClass } from "@/lib/ui/ontime-theme";

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

  const copyContact = async () => {
    const text = ui.copyText;
    if (!text) return;
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 3000);
    }
  };

  if (display === "rowMeta") {
    if (!ui.contactLink && !ui.copyText && !notes.trim()) {
      return <span className="text-slate-400">Brak kontaktu</span>;
    }
    return (
      <>
        <span className="text-slate-600">{ui.methodLabel}</span>
        {ui.contactLink ? (
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
              {copied ? "Skopiowano" : copyFailed ? "Błąd kopiowania" : "Kopiuj kontakt"}
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
      <OrderMethodBadge notes={notes} />
      {ui.contactLink ? (
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
          {copied ? "Skopiowano" : copyFailed ? "Nie udało się skopiować" : "Kopiuj kontakt"}
        </button>
      )}
    </div>
  );
}
