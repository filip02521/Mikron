"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  actionResolveZdReceiveFilterByDokId,
  actionSearchZdReceiveFilter,
} from "@/app/actions/warehouse-delivery";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { validateZdQueryForSubmit, formatZdDocNumberLabel } from "@/lib/subiekt/zd-document";
import type { ZdReceiveSearchCandidate } from "@/lib/subiekt/zd-document";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import { brandLinkClass, controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import {
  journalToolbarCardClass,
  queueToolbarControlClass,
  queueToolbarFieldLabelClass,
  queueToolbarInputClass,
} from "@/lib/ui/queue-panel-styles";
import type { IndividualOrder } from "@/types/database";
import {
  countUnmatchedZdLines,
  countZdMatches,
  filterReceiveQueueBySupplierAndZd,
  type ZdReceiveFilterState,
  zdFilterUnmatchedLinesLabel,
} from "@/lib/warehouse/zd-receive-filter";
import { IconClipboardList, IconHelpCircle } from "@/components/icons/StrokeIcons";

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "choose";
      candidates: ZdReceiveSearchCandidate[];
      hint: string;
      subiektOffline: boolean;
    }
  | {
      status: "ready";
      filter: ZdReceiveFilterState;
      matchCount: number;
      supplierScopedCount: number;
      unmatchedLineCount: number;
      subiektOffline: boolean;
    };

function formatIssuedAt(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return null;
  return `${d}.${m}.${y}`;
}

function buildPreviewFromFilter(
  receiveQueue: IndividualOrder[],
  filter: ZdReceiveFilterState,
  subiektOffline: boolean
): Extract<PreviewState, { status: "ready" }> {
  const ordersForSupplier = receiveQueue.filter((o) => o.supplier_id === filter.supplierId);
  const supplierName =
    ordersForSupplier[0]?.supplier?.name?.trim() || filter.supplierName;
  const resolved = { ...filter, supplierName };
  const supplierScoped = filterReceiveQueueBySupplierAndZd(
    receiveQueue,
    supplierName,
    null
  );
  return {
    status: "ready",
    filter: resolved,
    matchCount: countZdMatches(supplierScoped, resolved.profile),
    supplierScopedCount: supplierScoped.length,
    unmatchedLineCount: countUnmatchedZdLines(resolved.profile, supplierScoped),
    subiektOffline,
  };
}

function ZdReceiveCandidateList({
  hint,
  candidates,
  resolvingDokId,
  onPick,
  onDismiss,
}: {
  hint: string;
  candidates: ZdReceiveSearchCandidate[];
  resolvingDokId: number | null;
  onPick: (candidate: ZdReceiveSearchCandidate) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
      <p className="text-xs font-medium text-emerald-950">{hint}</p>
      <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto" role="listbox" aria-label="Pasujące dokumenty ZD">
        {candidates.map((candidate) => {
          const issued = formatIssuedAt(candidate.issuedAt);
          const resolving = resolvingDokId === candidate.dokId;
          return (
            <li key={candidate.dokId}>
              <button
                type="button"
                role="option"
                aria-selected={resolving}
                disabled={resolvingDokId != null}
                onClick={() => onPick(candidate)}
                className="flex w-full flex-col rounded-lg border border-white/80 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 disabled:opacity-60"
              >
                <span className="text-sm font-semibold text-slate-900">
                  {formatZdDocNumberLabel(candidate.docNumber)}
                </span>
                {candidate.supplierLabel ? (
                  <span className="text-xs text-slate-600">{candidate.supplierLabel}</span>
                ) : null}
                {issued ? (
                  <span className="mt-0.5 text-[11px] text-slate-500">Wystawiono {issued}</span>
                ) : null}
                {resolving ? (
                  <span className="mt-0.5 text-[11px] font-medium text-emerald-800">Wczytywanie…</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="mt-2 text-xs text-emerald-800 hover:text-emerald-950"
        onClick={onDismiss}
        disabled={resolvingDokId != null}
      >
        Anuluj wybór
      </button>
    </div>
  );
}

export function ZdReceiveFilterModal({
  open,
  onClose,
  receiveQueue,
  onApply,
  onError,
  onSubiektOffline,
}: {
  open: boolean;
  onClose: () => void;
  receiveQueue: IndividualOrder[];
  onApply: (filter: ZdReceiveFilterState) => void;
  onError: (message: string) => void;
  onSubiektOffline?: () => void;
}) {
  const [value, setValue] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [chooseRequiredHint, setChooseRequiredHint] = useState<string | null>(null);
  const [resolvingDokId, setResolvingDokId] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const offlineNotifiedRef = useRef(false);
  const debouncedValue = useDebouncedValue(value, 300);

  const notifySubiektOffline = useCallback(() => {
    if (offlineNotifiedRef.current) return;
    offlineNotifiedRef.current = true;
    onSubiektOffline?.();
  }, [onSubiektOffline]);

  const reset = useCallback(() => {
    setValue("");
    setPreview({ status: "idle" });
    setHelpOpen(false);
    setChooseRequiredHint(null);
    setResolvingDokId(null);
    offlineNotifiedRef.current = false;
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const debouncedValidation = validateZdQueryForSubmit(debouncedValue);
  const previewQueryKey =
    open && debouncedValidation.ok ? debouncedValidation.normalized : "";

  useEffect(() => {
    if (!previewQueryKey) return;

    let cancelled = false;

    void (async () => {
      setPreview({ status: "loading" });
      try {
        const result = await actionSearchZdReceiveFilter(previewQueryKey);
        if (cancelled) return;
        if (result.subiektOffline) notifySubiektOffline();
        setChooseRequiredHint(null);
        if (result.kind === "choose") {
          setPreview({
            status: "choose",
            candidates: result.candidates,
            hint: result.hint,
            subiektOffline: result.subiektOffline,
          });
          return;
        }
        setPreview(
          buildPreviewFromFilter(receiveQueue, result.filter, result.subiektOffline)
        );
      } catch (e) {
        if (cancelled) return;
        setPreview({
          status: "error",
          message: e instanceof Error ? e.message : "Nie udało się wczytać ZD.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewQueryKey, notifySubiektOffline, receiveQueue]);

  const canApply = preview.status === "ready";

  const apply = () => {
    if (!canApply) return;
    onApply(preview.filter);
    handleClose();
  };

  const pickCandidate = (candidate: ZdReceiveSearchCandidate) => {
    setChooseRequiredHint(null);
    setResolvingDokId(candidate.dokId);
    void (async () => {
      try {
        const result = await actionResolveZdReceiveFilterByDokId(candidate.dokId);
        if (result.subiektOffline) notifySubiektOffline();
        setPreview(
          buildPreviewFromFilter(receiveQueue, result.filter, result.subiektOffline)
        );
      } catch (e) {
        setPreview({
          status: "error",
          message: e instanceof Error ? e.message : "Nie udało się wczytać ZD.",
        });
      } finally {
        setResolvingDokId(null);
      }
    })();
  };

  const submitNow = () => {
    const validation = validateZdQueryForSubmit(value);
    if (!validation.ok) {
      onError(validation.message);
      return;
    }
    if (preview.status === "choose") {
      setChooseRequiredHint("Wybierz dokument ZD z listy poniżej.");
      return;
    }
    if (canApply && preview.filter.docNumber) {
      apply();
      return;
    }
    start(async () => {
      try {
        const result = await actionSearchZdReceiveFilter(validation.normalized);
        if (result.subiektOffline) notifySubiektOffline();
        setChooseRequiredHint(null);
        if (result.kind === "choose") {
          setPreview({
            status: "choose",
            candidates: result.candidates,
            hint: result.hint,
            subiektOffline: result.subiektOffline,
          });
          return;
        }
        const built = buildPreviewFromFilter(
          receiveQueue,
          result.filter,
          result.subiektOffline
        );
        onApply(built.filter);
        handleClose();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Nie udało się wczytać ZD.");
      }
    });
  };

  const showStatusPanel =
    debouncedValidation.ok &&
    (preview.status === "loading" ||
      preview.status === "ready" ||
      preview.status === "error" ||
      preview.status === "choose");

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="secondary" onClick={handleClose}>
        Anuluj
      </Button>
      <Button
        type="button"
        onClick={submitNow}
        disabled={
          pending ||
          resolvingDokId != null ||
          !value.trim() ||
          preview.status === "choose" ||
          preview.status === "loading"
        }
      >
        {pending ? "Szukam…" : "Pokaż w kolejce"}
      </Button>
    </div>
  );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Sprawdź wg ZD"
      description="Zawęź kolejkę do pozycji z wybranego zamówienia do dostawcy."
      size="md"
      loadingMessage={pending ? "Wczytywanie ZD…" : null}
      footer={footer}
      className="border-emerald-100/80"
      bodyClassName="bg-emerald-50/20"
    >
      <div className="space-y-4 px-5 py-4 sm:px-6">
        <div className={cn(journalToolbarCardClass, "space-y-3")}>
          <div>
            <label className={queueToolbarFieldLabelClass} htmlFor="zd-receive-modal-number">
              Numer dokumentu ZD
            </label>
            <div className="relative">
              <IconClipboardList
                size={16}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-700/70"
                aria-hidden
              />
              <input
                id="zd-receive-modal-number"
                type="text"
                role="searchbox"
                enterKeyHint="search"
                autoComplete="off"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setChooseRequiredHint(null);
                  if (preview.status !== "idle") setPreview({ status: "idle" });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitNow();
                  }
                }}
                placeholder="np. 81 lub ZD/123/2026"
                autoFocus
                className={cn(
                  queueToolbarInputClass,
                  controlFocusClass,
                  queueToolbarControlClass,
                  "pl-9"
                )}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Krótki kod (min. 2 znaki) pokaże listę ZD z ostatnich 6 miesięcy — wybierz właściwy
              dokument. Pełny numer (np. 123/2026) szuka do 2 lat wstecz.
            </p>
          </div>

          <div>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800",
                brandLinkClass
              )}
              onClick={() => setHelpOpen((v) => !v)}
              aria-expanded={helpOpen}
            >
              <IconHelpCircle size={14} aria-hidden />
              Jak szukać?
            </button>
            {helpOpen ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-slate-600">
                <li>Krótki kod, np. 81 — lista ZD z ostatnich 6 miesięcy (nawet jeden wynik)</li>
                <li>Pełny numer: 123/2026 — szuka do 2 lat wstecz i zawęża kolejkę, gdy jednoznaczny</li>
                <li>Możesz łączyć filtr ZD z wyszukiwarką towaru nad listą</li>
              </ul>
            ) : null}
          </div>

          {showStatusPanel && preview.status === "error" ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {preview.message}
            </p>
          ) : null}

          {chooseRequiredHint ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {chooseRequiredHint}
            </p>
          ) : null}

          {showStatusPanel && preview.status === "choose" ? (
            <ZdReceiveCandidateList
              hint={preview.hint}
              candidates={preview.candidates}
              resolvingDokId={resolvingDokId}
              onPick={pickCandidate}
              onDismiss={() => {
                setPreview({ status: "idle" });
                setChooseRequiredHint(null);
              }}
            />
          ) : null}

          {showStatusPanel && preview.status === "ready" ? (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-950">
              <p className="font-semibold text-slate-900">{preview.filter.docNumber}</p>
              <p className={cn(panelTypography.caption, "text-slate-600")}>
                {preview.filter.supplierName}
              </p>
              <p className="mt-1.5">
                <span className="font-semibold tabular-nums">{preview.matchCount}</span> pozycji w
                kolejce pasuje do tego ZD
                {preview.supplierScopedCount > 0 ? (
                  <span className="text-emerald-800/80">
                    {" "}
                    (z {preview.supplierScopedCount} u tego dostawcy)
                  </span>
                ) : null}
              </p>
              {zdFilterUnmatchedLinesLabel(preview.unmatchedLineCount) ? (
                <p className="mt-1 text-[11px] text-amber-800">
                  {zdFilterUnmatchedLinesLabel(preview.unmatchedLineCount)}
                </p>
              ) : null}
              {preview.matchCount === 0 ? (
                <p className="mt-1 text-[11px] text-amber-800">
                  Na tym ZD nie ma pozycji oczekujących w przyjęciu — możesz anulować lub
                  sprawdzić inny numer.
                </p>
              ) : null}
            </div>
          ) : showStatusPanel && preview.status === "loading" ? (
            <p className="text-sm text-slate-500">Wczytywanie dokumentu ZD…</p>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
