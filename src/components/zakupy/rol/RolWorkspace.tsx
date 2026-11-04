"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionScanRolMonth } from "@/app/actions/rol";
import { IconChevronRight, IconSettings } from "@/components/icons/StrokeIcons";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { polishPlural } from "@/lib/email/polish-plural";
import type { RolBatchView, RolProgram } from "@/lib/rol/data";
import { rolEditSummary } from "@/lib/rol/review";
import { rolBatchSummary, rolMonthPl, rolPeriodLabel, ROL_STATUS_BADGE } from "@/lib/rol/view";
import { RolBatchDetail } from "./RolBatchDetail";
import { RolSettingsDialog } from "./RolSettingsDialog";


type RolRow = { key: string; program: RolProgram; batch: RolBatchView | null };

function scanTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function RolWorkspace({
  period,
  periods,
  programs,
  batches,
  loadError,
}: {
  period: string;
  periods: string[];
  programs: RolProgram[];
  batches: RolBatchView[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, startScan] = useTransition();

  // Wiersz = zgłoszenie: klient z raportami tygodniowymi ma ich kilka w miesiącu; klient bez zgłoszenia — jeden wiersz.
  const rows = programs.flatMap((program): RolRow[] => {
    // Raport miesięczny (reszta FS) wysyła się na końcu — pod tygodniowymi.
    const isMonth = (b: RolBatchView) => rolMonthPl(b.period, b.periodEnd) === rolMonthPl(b.period);
    const own = batches.filter((b) => b.programId === program.id).sort((a, b) => Number(isMonth(a)) - Number(isMonth(b)));
    return own.length ? own.map((batch) => ({ key: batch.id, program, batch })) : [{ key: program.id, program, batch: null }];
  });
  const rowLabel = ({ program, batch }: RolRow) => {
    if (!batch) return `ROL ${program.label}`;
    const range = rolMonthPl(batch.period, batch.periodEnd);
    if (range !== rolMonthPl(batch.period)) return `ROL ${program.label} · ${range}`;
    // Miesięczny przy klientach z krótszymi raportami zbiera tylko to, czego w nich nie było.
    return batches.some((b) => b.programId === program.id && b.id !== batch.id) ? `ROL ${program.label} · reszta miesiąca` : `ROL ${program.label}`;
  };
  const toReview = batches.filter((b) => b.status === "wykryte");
  const ready = batches.filter((b) => b.status === "przejrzane");
  const nextToReview = rows.find((r) => r.batch?.status === "wykryte") ?? null;
  const nextToSend = nextToReview ? null : (rows.find((r) => r.batch?.status === "przejrzane") ?? null);
  const [mailFor, setMailFor] = useState<string | null>(null);
  const lastScan = batches.reduce<RolBatchView | null>((a, b) => (!a || b.scannedAt > a.scannedAt ? b : a), null);

  const scan = () =>
    startScan(async () => {
      setScanError(null);
      const res = await actionScanRolMonth(period);
      if (!res.ok) setScanError(res.error);
      else router.refresh();
    });

  return (
    <div className="min-h-0 lg:overflow-y-auto">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {toReview.length
              ? `${polishPlural(toReview.length, "zgłoszenie czeka", "zgłoszenia czekają", "zgłoszeń czeka")} na przegląd`
              : ready.length
                ? `${polishPlural(ready.length, "zgłoszenie gotowe", "zgłoszenia gotowe", "zgłoszeń gotowych")} do wysłania`
                : `Zgłoszenia ROL · ${rolPeriodLabel(period)}`}
          </h2>
          <p className="text-sm text-slate-600">
            {lastScan
              ? `Skan FS ${scanTimeLabel(lastScan.scannedAt)} · sprawdzono ${lastScan.fsCheckedCount} FS za ${rolPeriodLabel(period)}`
              : `FS za ${rolPeriodLabel(period)} nie były jeszcze sprawdzane.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Miesiąc zgłoszenia"
            value={period}
            onChange={(e) => router.push(`/zakupy/asystent?sekcja=rol&miesiac=${e.target.value}`)}
            className="w-auto"
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {rolPeriodLabel(p)}
              </option>
            ))}
          </Select>
          {nextToReview ? (
            <Button onClick={() => setOpen(nextToReview.key)}>Przejrzyj {rowLabel(nextToReview)}</Button>
          ) : nextToSend ? (
            <Button
              onClick={() => {
                setOpen(nextToSend.key);
                setMailFor(nextToSend.key);
              }}
            >
              Przygotuj mail · {rowLabel(nextToSend)}
            </Button>
          ) : null}
          {programs.length ? (
            <Button variant="secondary" onClick={scan} disabled={scanning}>
              {scanning ? "Sprawdzam…" : "Sprawdź ponownie"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Ustawienia ROL">
            <IconSettings size={18} aria-hidden />
            <span className="ml-1.5 hidden sm:inline">Ustawienia ROL</span>
          </Button>
        </div>
      </div>

      {scanning ? (
        <div role="status" className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-sm text-slate-600 sm:px-6">
          <BrandLoader size="sm" />
          Sprawdzam FS za {rolPeriodLabel(period)} w Subiekcie — zwykle ok. 30 s na każdy raport (miesiąc, tygodnie).
        </div>
      ) : null}
      {scanError || loadError ? (
        <div className="px-4 pt-4 sm:px-6">
          <Alert tone="error" title={scanError ? "Nie udało się sprawdzić FS" : "Nie udało się wczytać zgłoszeń"}>
            {scanError ?? loadError}
          </Alert>
        </div>
      ) : null}

      {programs.length === 0 ? (
        <EmptyState
          title="Tu pojawią się comiesięczne zgłoszenia ROL"
          description="Dodaj klienta ROL z jego kartoteką w Subiekcie. Na początku miesiąca OnTime znajdzie jego FS z produktami Ivoclar."
          action={<Button onClick={() => setSettingsOpen(true)}>Dodaj klienta ROL</Button>}
        />
      ) : (
        <TableScroll className="sm:px-0 sm:pb-0">
          <DataTable className="max-sm:min-w-0!">
            <thead>
              <tr>
                {/* `max-sm:hidden!`: .data-table th/td ustawia display bez warstwy w globals.css i wygrywa ze zwykłym `hidden`. */}
                <th>Klient</th>
                <th className="max-sm:hidden!">FS</th>
                <th className="max-sm:hidden!">Pozycje Ivoclar</th>
                <th className="max-sm:hidden!">Stan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { program, batch } = row;
                const summary = batch ? rolBatchSummary(batch) : null;
                const expanded = open === row.key;
                const detailId = `rol-detail-${row.key}`;
                return (
                  <Fragment key={row.key}>
                    <tr className={cn(expanded && "bg-indigo-50")}>
                      <td>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={detailId}
                          disabled={!batch}
                          onClick={() => setOpen(expanded ? null : row.key)}
                          className="inline-flex items-center gap-1.5 text-left font-medium text-slate-900 disabled:cursor-default"
                        >
                          <IconChevronRight
                            size={14}
                            aria-hidden
                            className={cn("text-slate-400 transition-transform", expanded && "rotate-90", !batch && "invisible")}
                          />
                          {rowLabel(row)}
                        </button>
                        {batch && (batch.changeNote || rolEditSummary(batch)) ? (
                          <p className="mt-0.5 pl-5 text-xs text-slate-500">
                            {[batch.changeNote, rolEditSummary(batch)].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                        {/* Telefon: wiersz listy zamiast kolumn — stan i liczby pod nazwą klienta. */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 text-xs text-slate-600 tabular-nums sm:hidden">
                          {batch ? (
                            <Badge variant={ROL_STATUS_BADGE[batch.status].variant}>{ROL_STATUS_BADGE[batch.status].label}</Badge>
                          ) : (
                            <Badge>{program.active ? "Nie sprawdzono" : "Nieaktywny"}</Badge>
                          )}
                          {summary ? <span>{summary.text} · {summary.fsCount} FS</span> : null}
                          {batch && batch.lateFsCount > 0 ? (
                            <span className="text-amber-800">
                              Po wysłaniu {polishPlural(batch.lateFsCount, "doszła FS", "doszły FS", "doszło FS")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="tabular-nums max-sm:hidden!">{summary ? summary.fsCount : "—"}</td>
                      <td className="tabular-nums max-sm:hidden!">{summary ? summary.text : "—"}</td>
                      <td className="max-sm:hidden!">
                        {batch ? (
                          <Badge variant={ROL_STATUS_BADGE[batch.status].variant}>{ROL_STATUS_BADGE[batch.status].label}</Badge>
                        ) : (
                          <Badge>{program.active ? "Nie sprawdzono" : "Nieaktywny"}</Badge>
                        )}
                        {batch && batch.lateFsCount > 0 ? (
                          <p className="mt-1 text-xs text-amber-800">
                            Po wysłaniu {polishPlural(batch.lateFsCount, "doszła FS", "doszły FS", "doszło FS")}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                    {expanded && batch ? (
                      <tr id={detailId}>
                        <td colSpan={4} className="bg-card">
                          <RolBatchDetail program={program} batch={batch} autoOpenMail={mailFor === row.key} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </DataTable>
        </TableScroll>
      )}

      <RolSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} programs={programs} />
    </div>
  );
}
