"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";

/**
 * Bezpieczny podgląd HTML maila.
 * Pusty `sandbox=""` (wszystkie restrykcje) w praktyce często daje pustą ramkę —
 * zostawiamy blokadę skryptów, ale pozwalamy na same-origin dla srcDoc.
 */
export function EmailHtmlPreview({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const srcDoc = useMemo(() => {
    const body = html?.trim() || "<p style=\"color:#64748b\">(brak treści HTML)</p>";
    // Opakowanie, gdy log ma tylko fragment body (smoke / stare wpisy).
    if (/<html[\s>]/i.test(body)) return body;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="margin:16px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0f172a;">${body}</body></html>`;
  }, [html]);

  return (
    <div className={cn("space-y-3", className)}>
      <iframe
        title="Podgląd treści e-maila"
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
        className="h-[min(70vh,36rem)] w-full rounded-md border border-slate-200 bg-white"
      />
      <details className="rounded-md border border-slate-200 bg-white">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Źródło HTML
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap break-all">
          {html || "(puste)"}
        </pre>
      </details>
    </div>
  );
}
