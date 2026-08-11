"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  actionLinkZdEstimateSnapshot,
  actionSearchZdForEstimateLink,
  type ZdEstimateLinkCandidate,
  type ZdEstimateLinkLineMeta,
} from "@/app/actions/zd-estimate";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";

export function ZdEstimateLinkZdDialog({
  open,
  supplierId,
  scopeMode,
  grtId,
  cechaId,
  lineMeta,
  initialNr,
  pending: pendingExternal,
  onClose,
  onLinked,
  onError,
}: {
  open: boolean;
  supplierId?: string | null;
  scopeMode?: "grupa" | "cecha" | null;
  grtId?: number | null;
  cechaId?: number | null;
  lineMeta?: ZdEstimateLinkLineMeta[] | null;
  /** Prefill numeru (np. po create bez snapshotu / timeout). */
  initialNr?: string | null;
  pending?: boolean;
  onClose: () => void;
  onLinked: (info: { dokNrPelny: string; lineCount: number }) => void;
  onError: (message: string) => void;
}) {
  const nrId = useId();
  const [nr, setNr] = useState("");
  const [docs, setDocs] = useState<ZdEstimateLinkCandidate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDokId, setSelectedDokId] = useState<number | null>(null);
  const [pending, startPending] = useTransition();
  const busy = pending || pendingExternal;

  useEffect(() => {
    if (!open) return;
    setNr(initialNr?.trim() ?? "");
    setSelectedDokId(null);
    setLoadError(null);
    startPending(async () => {
      const res = await actionSearchZdForEstimateLink({ days: 21 });
      if (!res.ok) {
        setDocs([]);
        setLoadError(res.message);
        return;
      }
      setDocs(res.documents);
    });
  }, [open, initialNr]);

  if (!open) return null;

  const confirm = () => {
    if (!supplierId?.trim()) {
      onError("Wybierz dostawcę w workbenchu — historia jest per kontrahent.");
      return;
    }
    startPending(async () => {
      const res = await actionLinkZdEstimateSnapshot({
        dokId: selectedDokId,
        dokNrPelny: selectedDokId ? null : nr.trim() || null,
        supplierId: supplierId ?? null,
        scopeMode: scopeMode ?? null,
        grtId: scopeMode === "grupa" ? (grtId ?? null) : null,
        cechaId: scopeMode === "cecha" ? (cechaId ?? null) : null,
        lineMeta: lineMeta ?? null,
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onLinked({ dokNrPelny: res.dokNrPelny, lineCount: res.lineCount });
      onClose();
    });
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Powiąż ZD"
      titleHint="Gdy ZD powstało poza OnTime (lub po timeout create) — zapisz snapshot. „Utwórz ZD” robi to automatycznie."
      titleId="zd-estimate-link-zd-title"
      size="md"
      tier="raised"
      disableBackdropClose={busy}
      bodyClassName="space-y-4 px-5 py-5 sm:px-6"
      loadingMessage={busy ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onClose}
            disabled={busy}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            onClick={confirm}
            disabled={
              busy ||
              (!selectedDokId && !nr.trim()) ||
              !supplierId?.trim() ||
              (scopeMode !== "grupa" && scopeMode !== "cecha")
            }
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" /> Zapisuję…
              </span>
            ) : (
              "Zapisz snapshot"
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <label
          htmlFor={nrId}
          className={cn(panelTypography.sectionLabel, "text-slate-700")}
        >
          Numer ZD (dok_NrPelny)
        </label>
        <input
          id={nrId}
          value={nr}
          onChange={(e) => {
            setNr(e.target.value);
            setSelectedDokId(null);
          }}
          disabled={busy}
          placeholder="np. ZD 123/2026"
          className={cn(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm",
            controlFocusClass
          )}
        />
      </div>

      <div className="space-y-2">
        <p className={cn(panelTypography.sectionLabel, "text-slate-700")}>
          Ostatnie ZD (21 dni)
        </p>
        {loadError ? (
          <p className="text-sm text-amber-800">{loadError}</p>
        ) : docs.length === 0 && !busy ? (
          <p className="text-sm text-slate-500">Brak dokumentów w oknie.</p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200/90 bg-slate-50/50 p-1.5">
            {docs.map((d) => {
              const selected = selectedDokId === d.dokId;
              return (
                <li key={d.dokId}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setSelectedDokId(d.dokId);
                      setNr(d.dokNrPelny);
                    }}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                      selected
                        ? "bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200"
                        : "hover:bg-white"
                    )}
                  >
                    <span className="font-medium tabular-nums">
                      {d.dokNrPelny}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {d.dataWyst ?? "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}
