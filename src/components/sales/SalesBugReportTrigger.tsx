"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import { actionSubmitSalesBugReport } from "@/app/actions/sales-bug-report";
import { useSalesNavLocked } from "@/components/sales/SalesOnboardingContext";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { IconMessageSquare } from "@/components/icons/StrokeIcons";

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
  if (pathname === "/tablica") return null;

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
      setError(userFacingErrorTextFromMessage(result.error, "Nie udało się wysłać zgłoszenia."));
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
      {/* Na końcu strony, w przepływie — pływający przycisk zasłaniał „⋮” i chevrony w listach. */}
      <div className={cn("mt-6 flex justify-center pb-2", className)}>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError(null);
            setSent(false);
          }}
          className="inline-flex min-h-10 select-none items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-800 active:bg-slate-100"
          aria-label="Zgłoś problem z aplikacją"
        >
          <IconMessageSquare size={14} aria-hidden />
          Zgłoś problem
        </button>
      </div>

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
          <p className="text-sm text-emerald-800">Dzięki - wiadomość poszła do administracji.</p>
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
            <p className="text-[11px] text-slate-500">Strona: {pathname}</p>
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
          </div>
        )}
      </ModalShell>
    </>
  );
}
