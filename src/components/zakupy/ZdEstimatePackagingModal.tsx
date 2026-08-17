"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import {
  actionDeleteZdEstimatePackaging,
  actionUpsertZdEstimatePackaging,
} from "@/app/actions/zd-estimate";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import { IconPackage, IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  assertPackagingUnits,
  ZD_PACKAGING_UNITS_MAX,
  ZD_PACKAGING_UNITS_MIN,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-packaging";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZdPackagingLabelPresets } from "@/components/zakupy/ZdPackagingLabelPresets";

export function ZdEstimatePackagingModal({
  open,
  onClose,
  packaging,
  onPackagingChange,
  onError,
  packPairTwIds,
}: {
  open: boolean;
  onClose: () => void;
  packaging: ZdEstimatePackagingRow[];
  onPackagingChange: (rows: ZdEstimatePackagingRow[]) => void;
  onError: (message: string) => void;
  /** tw_Id paczek z pary — Mode B niedostępny. */
  packPairTwIds?: ReadonlySet<number> | null;
}) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftUnits, setDraftUnits] = useState("");
  const [draftLabel, setDraftLabel] = useState("op.");
  const [draftNote, setDraftNote] = useState("");
  const [draftMode, setDraftMode] =
    useState<ZdPackagingDocumentUnitMode>("packages");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return packaging;
    return packaging.filter((e) => {
      const hay = [
        e.twSymbol ?? "",
        e.twNazwa,
        e.grtNazwa ?? "",
        e.note,
        String(e.unitsPerPackage),
        String(e.subiektTwId),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [packaging, query]);

  const draftUnitsCheck = assertPackagingUnits(draftUnits);
  const draftUnitsOk = draftUnitsCheck.ok;
  const showDraftUnitsError = draftUnits.trim() !== "" && !draftUnitsOk;

  const beginEdit = (row: ZdEstimatePackagingRow) => {
    setEditingId(row.subiektTwId);
    setDraftUnits(String(row.unitsPerPackage));
    setDraftLabel(row.packageLabel);
    setDraftNote(row.note);
    setDraftMode(
      packPairTwIds?.has(row.subiektTwId)
        ? "packages"
        : row.documentUnitMode
    );
  };

  const save = (row: ZdEstimatePackagingRow) => {
    const unitsCheck = assertPackagingUnits(draftUnits);
    if (!unitsCheck.ok) {
      onError(unitsCheck.message);
      return;
    }
    const mode: ZdPackagingDocumentUnitMode = packPairTwIds?.has(
      row.subiektTwId
    )
      ? "packages"
      : draftMode;
    start(async () => {
      const res = await actionUpsertZdEstimatePackaging({
        subiektTwId: row.subiektTwId,
        twSymbol: row.twSymbol,
        twNazwa: row.twNazwa,
        grtId: row.grtId,
        grtNazwa: row.grtNazwa,
        unitsPerPackage: unitsCheck.units,
        packageLabel: draftLabel,
        documentUnitMode: mode,
        note: draftNote,
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onPackagingChange(res.packaging);
      setEditingId(null);
    });
  };

  const remove = (subiektTwId: number) => {
    start(async () => {
      const res = await actionDeleteZdEstimatePackaging(subiektTwId);
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onPackagingChange(res.packaging);
      if (editingId === subiektTwId) setEditingId(null);
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={ZD_ESTIMATE_UI.packagingModalTitle}
      titleHint={ZD_ESTIMATE_UI.packagingModalHint}
      size="xl"
      bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">
            {packaging.length === 0
              ? "Brak zapisanych opakowań"
              : query.trim()
                ? `Widoczne ${filtered.length} z ${packaging.length}`
                : `${packaging.length} produktów z opakowaniem`}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="self-end sm:self-auto"
          >
            Zamknij
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <div className="flex gap-3">
          <IconPackage
            size={18}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-slate-500"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {ZD_ESTIMATE_UI.packagingIntroTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {ZD_ESTIMATE_UI.packagingIntroBody}
            </p>
          </div>
        </div>
      </div>

      <label htmlFor={searchId} className="block text-xs font-medium text-slate-600">
        Szukaj
        <div className="relative mt-1">
          <IconSearch
            size={15}
            strokeWidth={2.25}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            ref={searchRef}
            id={searchId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Symbol, nazwa, grupa…"
            className="pl-8 pr-9"
            autoComplete="off"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              aria-label="Wyczyść"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
            >
              <IconX size={14} strokeWidth={2.25} />
            </button>
          ) : null}
        </div>
      </label>

      {packaging.length === 0 ? (
        <EmptyState
          icon={<IconPackage size={28} strokeWidth={1.75} />}
          title="Brak opakowań"
          description="Na liście szacunku kliknij „Opak.” przy produkcie (np. DO.6312.03 → 10 szt)."
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Nic nie pasuje</p>
          <p className="mt-1 text-xs text-slate-500">Zmień frazę wyszukiwania.</p>
        </div>
      ) : (
        <ul className="max-h-[min(58vh,32rem)] space-y-2.5 overflow-y-auto overscroll-contain pr-0.5">
          {filtered.map((row) => {
            const editing = editingId === row.subiektTwId;
            const pairPackBlocksPiecesMode =
              packPairTwIds?.has(row.subiektTwId) === true;
            const editMode: ZdPackagingDocumentUnitMode =
              pairPackBlocksPiecesMode ? "packages" : draftMode;
            return (
              <li
                key={row.subiektTwId}
                className={cn(
                  "rounded-lg border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm shadow-slate-900/[0.02]",
                  editing && "border-indigo-200/80 ring-1 ring-indigo-100"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="font-semibold tabular-nums text-slate-900">
                        {row.twSymbol ?? `tw_Id ${row.subiektTwId}`}
                      </p>
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-900 ring-1 ring-indigo-100">
                        {row.documentUnitMode === "pieces_multiple"
                          ? `dobij ×${row.unitsPerPackage}`
                          : `1 ${row.packageLabel} = ${row.unitsPerPackage} szt`}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{row.twNazwa}</p>
                    <p className="text-[11px] text-slate-400">
                      {row.grtNazwa ? `${row.grtNazwa} · ` : ""}
                      od {formatPlDate(row.createdAt)}
                    </p>
                    {!editing && row.note ? (
                      <p className="mt-1 text-xs text-slate-500">{row.note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        editing ? setEditingId(null) : beginEdit(row)
                      }
                    >
                      {editing ? "Anuluj" : "Edytuj"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => remove(row.subiektTwId)}
                      title={ZD_ESTIMATE_UI.packagingClearCta}
                    >
                      Usuń
                    </Button>
                  </div>
                </div>
                {editing ? (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap gap-3 text-xs">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`zd-modal-mode-${row.subiektTwId}`}
                          checked={editMode === "packages"}
                          disabled={pending}
                          onChange={() => setDraftMode("packages")}
                        />
                        {ZD_ESTIMATE_UI.packagingModePackagesLabel}
                      </label>
                      <label
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          pairPackBlocksPiecesMode && "opacity-60"
                        )}
                      >
                        <input
                          type="radio"
                          name={`zd-modal-mode-${row.subiektTwId}`}
                          checked={editMode === "pieces_multiple"}
                          disabled={pending || pairPackBlocksPiecesMode}
                          onChange={() => setDraftMode("pieces_multiple")}
                        />
                        {ZD_ESTIMATE_UI.packagingModePiecesLabel}
                      </label>
                    </div>
                    {pairPackBlocksPiecesMode ? (
                      <p className="text-[11px] leading-snug text-amber-800">
                        {ZD_ESTIMATE_UI.packagingModePairBlockedHint}
                      </p>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-xs font-medium text-slate-600">
                        {ZD_ESTIMATE_UI.packagingUnitsLabel}
                        <Input
                          type="number"
                          min={ZD_PACKAGING_UNITS_MIN}
                          max={ZD_PACKAGING_UNITS_MAX}
                          className="mt-1"
                          value={draftUnits}
                          onChange={(e) => setDraftUnits(e.target.value)}
                          aria-invalid={showDraftUnitsError || undefined}
                        />
                      </label>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">
                          {ZD_ESTIMATE_UI.packagingLabelField}
                          <Input
                            className="mt-1"
                            value={draftLabel}
                            maxLength={24}
                            onChange={(e) => setDraftLabel(e.target.value)}
                          />
                        </label>
                        <ZdPackagingLabelPresets
                          value={draftLabel}
                          disabled={pending}
                          onSelect={setDraftLabel}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    {showDraftUnitsError ? (
                      <p className={cn(panelTypography.caption, "text-amber-800")}>
                        {draftUnitsCheck.message}
                      </p>
                    ) : (
                      <p className={panelTypography.caption}>
                        {ZD_ESTIMATE_UI.packagingUnitsHint}
                      </p>
                    )}
                    <label className="block text-xs font-medium text-slate-600">
                      Notatka
                      <textarea
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        rows={2}
                        maxLength={500}
                        className={cn(
                          "mt-1 w-full resize-y rounded-md border border-slate-200 px-2.5 py-1.5 text-sm",
                          controlFocusClass
                        )}
                      />
                    </label>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || !draftUnitsOk}
                        onClick={() => save(row)}
                      >
                        {pending ? <Spinner className="size-4" /> : "Zapisz"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>
  );
}
