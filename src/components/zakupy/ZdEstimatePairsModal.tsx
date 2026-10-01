"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  actionDeleteZdProductPair,
  actionUpsertZdProductPair,
} from "@/app/actions/zd-estimate";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import { IconLayers, IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { normalizeUnitsPerPack } from "@/lib/orders/zd-product-pair-units";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";

export type ZdPairSeedProduct = {
  twId: number;
  symbol: string;
  nazwa: string;
};

function resetManualDraft(setters: {
  setDraftPack: (v: string) => void;
  setDraftPiece: (v: string) => void;
  setDraftRatio: (v: string) => void;
  setDraftPackSym: (v: string) => void;
  setDraftPieceSym: (v: string) => void;
}) {
  setters.setDraftPack("");
  setters.setDraftPiece("");
  setters.setDraftRatio("100");
  setters.setDraftPackSym("");
  setters.setDraftPieceSym("");
}

export function ZdEstimatePairsModal({
  open,
  onClose,
  pairs,
  onPairsChange,
  onError,
  seed = null,
  onSeedConsumed,
}: {
  open: boolean;
  onClose: () => void;
  pairs: ZdProductPairRow[];
  onPairsChange: (rows: ZdProductPairRow[]) => void;
  onError: (message: string) => void;
  /** Dwa zaznaczone towary ze szacunku — tylko wybór ról + ratio. */
  seed?: readonly [ZdPairSeedProduct, ZdPairSeedProduct] | null;
  onSeedConsumed?: () => void;
}) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [draftPack, setDraftPack] = useState("");
  const [draftPiece, setDraftPiece] = useState("");
  const [draftRatio, setDraftRatio] = useState("100");
  const [draftPackSym, setDraftPackSym] = useState("");
  const [draftPieceSym, setDraftPieceSym] = useState("");
  /** Który z seed[0]/seed[1] jest paczką. */
  const [seedPackIndex, setSeedPackIndex] = useState<0 | 1>(0);

  const fromSeed = seed != null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (seed) {
        setSeedPackIndex(0);
        setDraftRatio("100");
        return;
      }
      resetManualDraft({
        setDraftPack,
        setDraftPiece,
        setDraftRatio,
        setDraftPackSym,
        setDraftPieceSym,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, seed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pairs;
    return pairs.filter((e) => {
      const hay = [
        e.packSymbol ?? "",
        e.pieceSymbol ?? "",
        e.packNazwa ?? "",
        e.pieceNazwa ?? "",
        String(e.packTwId),
        String(e.pieceTwId),
        String(e.unitsPerPack),
        e.source,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [pairs, query]);

  const seedPack = seed ? seed[seedPackIndex] : null;
  const seedPiece = seed ? seed[seedPackIndex === 0 ? 1 : 0] : null;
  const unitsPerPackValid = normalizeUnitsPerPack(Number(draftRatio)) != null;
  const seedReady =
    fromSeed &&
    seedPack != null &&
    seedPiece != null &&
    seedPack.twId !== seedPiece.twId;
  const canSubmitPair = fromSeed
    ? seedReady && unitsPerPackValid
    : unitsPerPackValid &&
      Math.trunc(Number(draftPack)) > 0 &&
      Math.trunc(Number(draftPiece)) > 0 &&
      Math.trunc(Number(draftPack)) !== Math.trunc(Number(draftPiece));

  const addPair = () => {
    if (!canSubmitPair || pending) return;

    const unitsPerPack = normalizeUnitsPerPack(Number(draftRatio));
    if (unitsPerPack == null) {
      onError("Podaj całkowitą liczbę sztuk w paczce (≥ 2).");
      return;
    }

    const packTwId = fromSeed
      ? seedPack!.twId
      : Math.trunc(Number(draftPack));
    const pieceTwId = fromSeed
      ? seedPiece!.twId
      : Math.trunc(Number(draftPiece));
    const packSymbol = fromSeed
      ? seedPack!.symbol.trim() || null
      : draftPackSym.trim() || null;
    const pieceSymbol = fromSeed
      ? seedPiece!.symbol.trim() || null
      : draftPieceSym.trim() || null;
    const packNazwa = fromSeed ? seedPack!.nazwa.trim() || null : null;
    const pieceNazwa = fromSeed ? seedPiece!.nazwa.trim() || null : null;

    // Snapshot przed await — zamknięcie/zmiana seed w trakcie requestu nie psuje zapisu.
    const createdFromSeed = fromSeed;

    start(async () => {
      const res = await actionUpsertZdProductPair({
        packTwId,
        pieceTwId,
        unitsPerPack,
        packSymbol,
        pieceSymbol,
        packNazwa,
        pieceNazwa,
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onPairsChange(res.pairs);
      if (createdFromSeed) {
        onSeedConsumed?.();
        onClose();
      } else {
        resetManualDraft({
          setDraftPack,
          setDraftPiece,
          setDraftRatio,
          setDraftPackSym,
          setDraftPieceSym,
        });
      }
    });
  };

  const remove = (id: string) => {
    start(async () => {
      const res = await actionDeleteZdProductPair({ id });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onPairsChange(res.pairs);
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={ZD_ESTIMATE_UI.pairsModalTitle}
      titleHint={ZD_ESTIMATE_UI.pairsModalHint}
      size="xl"
      bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zapisuję…" : null}
      disableBackdropClose={pending}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">
            {pairs.length === 0
              ? "Brak zapisanych par"
              : query.trim()
                ? `Widoczne ${filtered.length} z ${pairs.length}`
                : `${pairs.length} par`}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled
              title="Wymaga GET /products/komplety na hoście ORDERS — endpoint niedostępny. Dodaj pary ręcznie albo zaznacz 2 towary na liście i wybierz „Para”."
            >
              Sync (niedostępny)
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={pending}
            >
              Zamknij
            </Button>
          </div>
        </div>
      }
    >
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <div className="flex gap-3">
          <IconLayers
            size={18}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-slate-500"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {ZD_ESTIMATE_UI.pairsIntroTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {fromSeed
                ? ZD_ESTIMATE_UI.pairsIntroBodySeed
                : ZD_ESTIMATE_UI.pairsIntroBodyManual}
            </p>
          </div>
        </div>
      </div>

      {fromSeed && seed && seedPack && seedPiece ? (
        <div className="space-y-3 rounded-lg border border-indigo-200/80 bg-indigo-50/40 p-3">
          <p className="text-xs font-medium text-indigo-950">
            Zaznaczone towary — wybierz role
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([0, 1] as const).map((idx) => {
              const p = seed[idx];
              const isPack = seedPackIndex === idx;
              return (
                <button
                  key={p.twId}
                  type="button"
                  disabled={pending}
                  onClick={() => setSeedPackIndex(idx)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition",
                    isPack
                      ? "border-indigo-400 bg-white shadow-sm ring-2 ring-indigo-200"
                      : "border-slate-200/80 bg-white/70 hover:border-slate-300"
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {isPack ? "Paczka (ZD)" : "Sztuki"}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {p.symbol || `tw ${p.twId}`}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                    {p.nazwa || `tw_Id ${p.twId}`}
                  </p>
                  <p className="mt-2 text-[11px] text-indigo-800">
                    {isPack
                      ? "Kliknij drugi towar, żeby zamienić role"
                      : "Kliknij, żeby ustawić jako paczkę"}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
              Ile sztuk w 1 paczce
              <Input
                value={draftRatio}
                onChange={(e) => setDraftRatio(e.target.value)}
                className={cn("mt-1", controlFocusClass)}
                inputMode="numeric"
                autoFocus
              />
            </label>
            <Button
              type="button"
              onClick={addPair}
              disabled={pending || !canSubmitPair}
              className="sm:w-auto"
              title={
                unitsPerPackValid
                  ? undefined
                  : "Podaj całkowitą liczbę sztuk w paczce (≥ 2)"
              }
            >
              Zapisz parę
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            Zamówienie pójdzie na{" "}
            <span className="font-medium text-slate-700">
              {seedPack.symbol || `tw ${seedPack.twId}`}
            </span>
            ; popyt i pokrycie liczone ze{" "}
            <span className="font-medium text-slate-700">
              {seedPiece.symbol || `tw ${seedPiece.twId}`}
            </span>
            . Po zapisie lista przeliczy się od razu (oznaczenia Paczka/Sztuki i Do
            ZD).
          </p>
        </div>
      ) : (
        <div className="grid gap-2 rounded-lg border border-slate-200/80 bg-white p-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs font-medium text-slate-600 lg:col-span-1">
            Pack tw_Id
            <Input
              value={draftPack}
              onChange={(e) => setDraftPack(e.target.value)}
              className={cn("mt-1", controlFocusClass)}
              inputMode="numeric"
              placeholder="np. 100"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 lg:col-span-1">
            Piece tw_Id
            <Input
              value={draftPiece}
              onChange={(e) => setDraftPiece(e.target.value)}
              className={cn("mt-1", controlFocusClass)}
              inputMode="numeric"
              placeholder="np. 200"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 lg:col-span-1">
            Sztuk / paczka
            <Input
              value={draftRatio}
              onChange={(e) => setDraftRatio(e.target.value)}
              className={cn("mt-1", controlFocusClass)}
              inputMode="numeric"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 lg:col-span-1">
            Symbol pack
            <Input
              value={draftPackSym}
              onChange={(e) => setDraftPackSym(e.target.value)}
              className={cn("mt-1", controlFocusClass)}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 lg:col-span-1">
            Symbol piece
            <Input
              value={draftPieceSym}
              onChange={(e) => setDraftPieceSym(e.target.value)}
              className={cn("mt-1", controlFocusClass)}
            />
          </label>
          <div className="flex items-end lg:col-span-1">
            <Button
              type="button"
              onClick={addPair}
              disabled={pending || !canSubmitPair}
              className="w-full"
            >
              Dodaj
            </Button>
          </div>
        </div>
      )}

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
            placeholder="Symbol, tw_Id…"
            className="pl-8 pr-9"
            autoComplete="off"
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

      {filtered.length === 0 ? (
        <EmptyState
          title={pairs.length === 0 ? "Brak par" : "Brak wyników"}
          description={
            pairs.length === 0
              ? "Zaznacz 2 towary na liście → Para, albo dodaj ręcznie (Sync z Subiekta niedostępny)."
              : "Zmień filtr wyszukiwania."
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200/80">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {row.packSymbol ?? `tw ${row.packTwId}`}{" "}
                  <span className="font-normal text-slate-400">↔</span>{" "}
                  {row.pieceSymbol ?? `tw ${row.pieceTwId}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {row.unitsPerPack} szt / 1 paczka · {row.source}
                  {row.updatedAt
                    ? ` · ${formatPlDate(row.updatedAt.slice(0, 10))}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => remove(row.id)}
                className="self-end sm:self-auto"
              >
                Usuń
              </Button>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
