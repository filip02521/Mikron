"use client";

import { useId, useState, useTransition } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { actionIssueLoaner } from "@/app/actions/service-loaners";
import { ClientPicker, type PickedClient as Client } from "@/components/serwis/SubiektPickers";
import { addDays, LOANER_RETURN_PRESETS, toDateOnly } from "@/lib/orders/service-loaners";
import { formatLong, type LoanerUnitView } from "@/components/serwis/LoanersBoard";

export function LoanerIssueDialog({
  freeUnits,
  preselectId,
  today,
  onClose,
  onDone,
}: {
  freeUnits: LoanerUnitView[];
  preselectId: string | null;
  today: Date;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const formId = useId();
  const [unitId, setUnitId] = useState<string | null>(preselectId ?? freeUnits[0]?.id ?? null);
  const [client, setClient] = useState<Client | null>(null);
  const [days, setDays] = useState<number>(14);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unit = freeUnits.find((u) => u.id === unitId) ?? null;
  const back = addDays(today, days);

  return (
    <ModalShell
      open
      className="touch-ui"
      onClose={onClose}
      title="Wydaj zamiennik"
      size="lg"
      bodyClassName="space-y-5 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Wydaję…" : null}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {!unit || !client ? (
            <span className="mr-auto text-[0.8125rem] text-slate-500">Brakuje {!unit ? "egzemplarza" : "klienta"}.</span>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" form={formId} disabled={pending || !unit || !client}>
            {pending ? "Wydaję…" : unit ? `Wydaj ${unit.code}` : "Wydaj"}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!unit || !client) return;
          setError(null);
          start(async () => {
            const res = await actionIssueLoaner({
              unitId: unit.id,
              khId: client.khId,
              clientName: client.name,
              clientPhone: client.phone,
              plannedReturn: toDateOnly(back),
              note,
            });
            if (!res.ok) setError(res.message);
            else onDone(res.message);
          });
        }}
      >
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Egzemplarz na stanie</span>
          {freeUnits.length === 0 ? (
            <p className="text-sm text-slate-600">Wszystkie egzemplarze są wydane albo w przeglądzie.</p>
          ) : (
            <div role="radiogroup" aria-label="Egzemplarz" className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
              {freeUnits.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="radio"
                  aria-checked={u.id === unitId}
                  onClick={() => setUnitId(u.id)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-lg border bg-card p-2.5 text-left transition-colors duration-150",
                    u.id === unitId ? "border-indigo-600 ring-1 ring-inset ring-indigo-600" : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span className="font-mono text-xs font-semibold text-slate-900">{u.code}</span>
                  <span className="truncate text-xs text-slate-500">{u.twName}</span>
                  <span className="text-xs text-slate-500">stan {u.condition}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <ClientPicker value={client} onChange={setClient} />

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Planowany zwrot</span>
          <div role="radiogroup" aria-label="Planowany zwrot" className="flex flex-wrap gap-2">
            {LOANER_RETURN_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={days === n}
                onClick={() => setDays(n)}
                className={cn(
                  "h-8 rounded-full border px-3 text-[0.8125rem] transition-colors duration-150",
                  days === n ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-200 bg-card text-slate-600 hover:bg-slate-100"
                )}
              >
                {n} dni
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={`${formId}-note`} className="mb-1.5 block text-xs font-semibold text-slate-600">
            Uwagi (opcjonalnie)
          </label>
          <input
            id={`${formId}-note`}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Np. na czas naprawy ZS/26/11/014"
            className="h-11 w-full rounded-lg border border-slate-200 bg-card px-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm"
          />
        </div>

        <div className="rounded-lg bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
          {unit ? (
            <>
              <b className="font-mono">{unit.code}</b> ({unit.twName}) trafi do <b>{client?.name || "…"}</b>. Zwrot do{" "}
              <b>{formatLong(back.toISOString())}</b>. Licznik dni startuje dziś.
            </>
          ) : (
            "Wybierz egzemplarz."
          )}
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
    </ModalShell>
  );
}
