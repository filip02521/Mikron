"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { actionSubmitSalesBugReport } from "@/app/actions/sales-bug-report";
import { useSalesNavLocked } from "@/components/sales/SalesOnboardingContext";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";

/**
 * Drugorzędny przycisk zgłoszenia — widoczny, ale poza główną nawigacją.
 */
export function SalesBugReportTrigger({ className }: { className?: string }) {
  const pathname = usePathname();
  const navLocked = useSalesNavLocked();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (navLocked) return null;

  async function submit() {
    setPending(true);
    setError(null);
    const result = await actionSubmitSalesBugReport({
      message,
      pagePath: pathname,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
    setMessage("");
    window.setTimeout(() => {
      setOpen(false);
      setSent(false);
    }, 1400);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
          setSent(false);
        }}
        className={cn(
          "fixed z-20 select-none",
          "rounded-full border border-slate-300/90 bg-white/95 px-3 py-1.5",
          "text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm",
          "transition hover:border-slate-400 hover:bg-white hover:text-slate-800 hover:shadow",
          "bottom-[calc(3.85rem+env(safe-area-inset-bottom,0px))] right-3 md:bottom-4 md:right-5",
          className
        )}
        aria-label="Zgłoś problem z aplikacją"
        title="Zgłoś problem"
      >
        Zgłoś problem
      </button>

      <ModalShell
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Zgłoś problem"
        titleId="sales-bug-report-title"
        size="sm"
        disableBackdropClose={pending}
        bodyClassName="px-5 py-4 sm:px-6"
        footer={
          sent ? null : (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button
                className="min-h-11 w-full sm:w-auto"
                onClick={() => void submit()}
                disabled={pending || message.trim().length < 8}
              >
                {pending ? "Wysyłam…" : "Wyślij"}
              </Button>
            </div>
          )
        }
      >
        {sent ? (
          <p className="text-sm text-emerald-800">Dzięki — wiadomość poszła do administracji.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-500">
              Opisz krótko, co poszło nie tak. Do wiadomości dołączymy stronę, na której jesteś.
            </p>
            <Field label="Opis">
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Np. przycisk nie reaguje, zły status zamówienia…"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                disabled={pending}
              />
            </Field>
            <p className="text-[10px] text-slate-400">Strona: {pathname}</p>
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
          </div>
        )}
      </ModalShell>
    </>
  );
}
