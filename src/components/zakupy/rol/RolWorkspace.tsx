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
import { rolBatchSummary, rolPeriodLabel, ROL_STATUS_BADGE } from "@/lib/rol/view";
import { RolBatchDetail } from "./RolBatchDetail";
import { RolSettingsDialog } from "./RolSettingsDialog";

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

  const batchByProgram = new Map(batches.map((b) => [b.programId, b]));
  const toReview = batches.filter((b) => b.status === "wykryte");
  const ready = batches.filter((b) => b.status === "przejrzane");
  const nextToReview = programs.find((p) => toReview.some((b) => b.programId === p.id)) ?? null;
  const lastScan = batches.reduce<RolBatchView | null>((a, b) => (!a || b.scannedAt > a.scannedAt ? b : a), null);
  const monthEn = ENGLISH_MONTHS[Number(period.slice(5, 7)) - 1];

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
            <Button onClick={() => setOpen(nextToReview.id)}>Przejrzyj ROL {nextToReview.label}</Button>
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
          Sprawdzam FS za {rolPeriodLabel(period)} w Subiekcie — zwykle ok. 30 s.
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
              {programs.map((program) => {
                const batch = batchByProgram.get(program.id) ?? null;
                const summary = batch ? rolBatchSummary(batch) : null;
                const expanded = open === program.id;
                const detailId = `rol-detail-${program.id}`;
                return (
                  <Fragment key={program.id}>
                    <tr className={cn(expanded && "bg-indigo-50")}>
                      <td>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={detailId}
                          disabled={!batch}
                          onClick={() => setOpen(expanded ? null : program.id)}
                          className="inline-flex items-center gap-1.5 text-left font-medium text-slate-900 disabled:cursor-default"
                        >
                          <IconChevronRight
                            size={14}
                            aria-hidden
                            className={cn("text-slate-400 transition-transform", expanded && "rotate-90", !batch && "invisible")}
                          />
                          ROL {program.label}
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
                            <Badge>Nie sprawdzono</Badge>
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
                          <Badge>Nie sprawdzono</Badge>
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
                        <td colSpan={4} className="bg-white">
                          <RolBatchDetail program={program} batch={batch} monthEn={monthEn ?? ""} />
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
