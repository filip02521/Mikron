"use client";

import { useState } from "react";
import { buildSupplierContactUi } from "@/lib/orders/supplier-contact";
import { OrderMethodBadge } from "@/components/targets/OrderMethodBadge";
import { cn } from "@/lib/cn";

const linkClass =
  "max-w-[min(100%,18rem)] truncate text-xs font-medium text-sky-800 underline decoration-sky-200 underline-offset-2 hover:text-sky-950";

export function SupplierContactActions({
  notes,
  mails,
  className,
}: {
  notes: string;
  mails: string;
  /** @deprecated — kontakt zawsze w jednej linii */
  compact?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const ui = buildSupplierContactUi(notes, mails);

  const copyContact = async () => {
    const text = ui.copyText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

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
          className={linkClass}
          title={ui.copyText ?? ui.contactLink.label}
        >
          {ui.contactLink.label}
        </a>
      ) : (
        <button
          type="button"
          onClick={copyContact}
          className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          {copied ? "Skopiowano" : "Kopiuj kontakt"}
        </button>
      )}
    </div>
  );
}
