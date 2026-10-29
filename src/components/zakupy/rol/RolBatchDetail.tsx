"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionRolApprove, actionRolReopen, actionRolSetInvoice, actionRolSetLine } from "@/app/actions/rol";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { FormNoticeMessage } from "@/components/ui/FormNoticeMessage";
import { cn } from "@/lib/cn";
import { polishPlural } from "@/lib/email/polish-plural";
import { ROL_CONFLICT_REASON } from "@/lib/rol/constants";
import type { RolBatchView, RolInvoiceView, RolLineView, RolProgram } from "@/lib/rol/data";
import { rolBatchEditable } from "@/lib/rol/review";
import { rolBatchBlockers, rolLineQty } from "@/lib/rol/view";
import { formError } from "@/lib/ui/notice-copy";

/** Telefon: przyciski w wierszach mają pole dotyku 44 px (DESIGN.md). */
const ROW_ACTION = "max-sm:min-h-11";

type Run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;

function shortDate(key: string | null): string {
  return key ? `${key.slice(8, 10)}.${key.slice(5, 7)}` : "—";
}

const contested = (inv: RolInvoiceView) =>
  inv.excluded && (inv.excludedReason === ROL_CONFLICT_REASON || inv.excludedReason.startsWith("Przypisana do ROL "));

/** Rozwinięcie wiersza klienta: blok klienta, FS z pozycjami, zatwierdzenie listy. */
export function RolBatchDetail({ program, batch, monthEn }: { program: RolProgram; batch: RolBatchView; monthEn: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editable = rolBatchEditable(batch.status);
  const blockers = rolBatchBlockers(batch);

  const run: Run = (fn) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

  return (
    <div className="space-y-3 py-1">
      {/* Blok klienta tak, jak zobaczy go Ivoclar — tożsamość przed pozycjami. */}
      <div className="text-sm text-slate-700">
        <p className="font-medium text-slate-900">
          ROL {program.label} {monthEn} -{program.discountPct}%
        </p>
        <p className="text-slate-600">
          {[...program.addressLines, program.nip ? `NIP: ${program.nip}` : ""].filter(Boolean).join(" · ") || "Brak adresu w ustawieniach"}
        </p>
      </div>

      {batch.invoices.length === 0 ? (
        <p className="text-sm text-slate-600">Klient nie kupił produktów Ivoclar w tym miesiącu — nic do zgłoszenia.</p>
      ) : (
        batch.invoices.map((inv) => (
          <RolInvoiceBlock
            key={inv.fsDokId}
            batchId={batch.id}
            invoice={inv}
            lines={batch.lines.filter((l) => l.fsDokId === inv.fsDokId)}
            editable={editable}
            pending={pending}
            run={run}
          />
        ))
      )}

      {error ? <FormNoticeMessage message={formError("Nie zapisano zmiany", error)} /> : null}

      {editable ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-end">
          {blockers.length ? (
            <p className="flex items-start gap-1.5 text-sm text-amber-800 sm:mr-auto">
              <IconAlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
              Przed zatwierdzeniem: {blockers.join(" · ")}
            </p>
          ) : (
            <p className="text-sm text-slate-600 sm:mr-auto">Sprawdź klienta i pozycje, potem zatwierdź listę do wysyłki.</p>
          )}
          <Button variant="outline" disabled={pending} onClick={() => run(() => actionRolApprove(batch.id))}>
            {pending ? "Zapisuję…" : "Zatwierdź listę"}
          </Button>
        </div>
      ) : batch.status === "przejrzane" ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-sm text-slate-600 sm:mr-auto">Lista zatwierdzona — gotowa do wysłania.</p>
          <Button variant="ghost" disabled={pending} onClick={() => run(() => actionRolReopen(batch.id))}>
            Edytuj listę
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RolInvoiceBlock({
  batchId,
  invoice: inv,
  lines,
  editable,
  pending,
  run,
}: {
  batchId: string;
  invoice: RolInvoiceView;
  lines: RolLineView[];
  editable: boolean;
  pending: boolean;
  run: Run;
}) {
  const isContested = contested(inv);
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className={cn("text-sm font-medium text-slate-800", inv.excluded && "text-slate-500")}>
          {inv.fsNr} · {shortDate(inv.fsDate)} · {polishPlural(lines.length, "poz.", "poz.", "poz.")} Ivoclar
          {inv.kfsDokIds.length ? (
            <span className="font-normal text-slate-600">
              {" "}
              · {polishPlural(inv.kfsDokIds.length, "korekta odjęta", "korekty odjęte", "korekt odjętych")}
            </span>
          ) : null}
        </p>
        {editable ? (
          <div className="ml-auto flex gap-1">
            {!inv.excluded ? (
              <Button variant="ghost" size="sm" className={ROW_ACTION} disabled={pending} onClick={() => run(() => actionRolSetInvoice({ batchId, fsDokId: inv.fsDokId, mode: "exclude" }))}>
                Wyłącz FS
              </Button>
            ) : isContested ? (
              <Button variant="ghost" size="sm" className={ROW_ACTION} disabled={pending} onClick={() => run(() => actionRolSetInvoice({ batchId, fsDokId: inv.fsDokId, mode: "assign" }))}>
                Przypisz do tego klienta
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className={ROW_ACTION} disabled={pending} onClick={() => run(() => actionRolSetInvoice({ batchId, fsDokId: inv.fsDokId, mode: "include" }))}>
                Włącz FS
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {inv.excluded ? <p className="mt-0.5 text-xs text-amber-800">Nie idzie do zgłoszenia: {inv.excludedReason || "wyłączona"}</p> : null}
      <ul className={cn("mt-1.5 divide-y divide-slate-100", inv.excluded && "opacity-60")}>
        {lines.map((l) => (
          <RolLineRow key={l.id} batchId={batchId} line={l} editable={editable && !inv.excluded} pending={pending} run={run} />
        ))}
      </ul>
      {inv.otherLinesCount > 0 ? (
        <p className="mt-1 text-xs text-slate-500">
          {polishPlural(inv.otherLinesCount, "pozycja innego producenta pominięta", "pozycje innych producentów pominięte", "pozycji innych producentów pominiętych")}
        </p>
      ) : null}
    </div>
  );
}

function RolLineRow({
  batchId,
  line: l,
  editable,
  pending,
  run,
}: {
  batchId: string;
  line: RolLineView;
  editable: boolean;
  pending: boolean;
  run: Run;
}) {
  const [editingQty, setEditingQty] = useState(false);
  const [qtyDraft, setQtyDraft] = useState("");
  const [catalogDraft, setCatalogDraft] = useState("");
  // Enter, a potem blur przy zamknięciu pola, albo Escape i blur — zapis ma pójść najwyżej raz.
  const qtyDone = useRef(false);
  const qty = rolLineQty(l);
  const fsQty = Math.max(0, l.qtyFs - l.qtyKfs);

  const saveQty = () => {
    if (qtyDone.current) return;
    qtyDone.current = true;
    setEditingQty(false);
    run(() => actionRolSetLine({ batchId, lineId: l.id, qty: qtyDraft }));
  };

  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm text-slate-600", l.excluded && "text-slate-500")}>
      <span className="w-16 shrink-0 tabular-nums">{l.ivoclarCatalogNo ?? l.symbol ?? "—"}</span>
      <span className={cn("min-w-0 flex-1 max-sm:basis-[calc(100%-4.75rem)]", l.excluded && "line-through")}>{l.name}</span>
      {editable && !l.excluded && !l.ivoclarCatalogNo ? (
        <span className="flex basis-full items-center gap-1.5 pl-[4.75rem] text-xs text-amber-800 sm:basis-auto sm:pl-0">
          <IconAlertCircle size={14} aria-hidden />
          <input
            value={catalogDraft}
            onChange={(e) => setCatalogDraft(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="nr kat."
            aria-label={`Numer katalogowy Ivoclar dla: ${l.name}`}
            className="h-8 w-24 rounded-md border border-amber-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
          <Button variant="ghost" size="sm" className={ROW_ACTION} disabled={pending} onClick={() => run(() => actionRolSetLine({ batchId, lineId: l.id, catalogNo: catalogDraft }))}>
            Zapisz
          </Button>
        </span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
        {editingQty ? (
          <input
            autoFocus
            value={qtyDraft}
            onChange={(e) => setQtyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveQty();
              if (e.key === "Escape") {
                e.stopPropagation();
                qtyDone.current = true;
                setEditingQty(false);
              }
            }}
            onBlur={saveQty}
            inputMode="decimal"
            aria-label={`Ilość dla: ${l.name} (puste = z FS)`}
            className="h-8 w-16 rounded-md border border-slate-300 bg-white px-2 text-right text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
        ) : (
          <>
            {l.qtyKfs > 0 || l.qtyOverride !== null ? <s className="text-slate-500">{l.qtyOverride !== null ? fsQty : l.qtyFs}</s> : null}
            {editable && !l.excluded ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setQtyDraft(l.qtyOverride !== null ? String(l.qtyOverride) : "");
                  qtyDone.current = false;
                  setEditingQty(true);
                }}
                aria-label={`Zmień ilość: ${l.name}, teraz ${qty} szt.`}
                className={cn(
                  "rounded px-1 underline max-sm:min-h-11 decoration-slate-300 underline-offset-2 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:outline-none",
                  l.qtyOverride !== null ? "font-semibold text-slate-900" : "text-slate-900"
                )}
              >
                {qty} szt.
              </button>
            ) : (
              <span className={cn("text-slate-900", l.qtyOverride !== null && "font-semibold")}>{qty} szt.</span>
            )}
          </>
        )}
        {editable ? (
          <Button
            variant="ghost"
            size="sm"
            className={ROW_ACTION}
            disabled={pending}
            onClick={() => run(() => actionRolSetLine({ batchId, lineId: l.id, excluded: !l.excluded }))}
          >
            {l.excluded ? "Włącz" : "Wyłącz"}
          </Button>
        ) : null}
      </span>
    </li>
  );
}
