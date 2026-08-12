"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import {
  actionClearZdEstimateOnRequest,
  actionUpdateZdEstimateOnRequestNote,
} from "@/app/actions/zd-estimate";
import type { ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import { IconClipboardList, IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";

type GroupFilter = "all" | string;

function GroupChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition",
        active
          ? "border-slate-800 bg-slate-900 text-white"
          : "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <span className="max-w-[10rem] truncate">{label}</span>
      <span
        className={cn(
          "rounded px-1 py-px text-[10px] font-semibold tabular-nums",
          active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function OnRequestRow({
  row,
  editing,
  draftNote,
  pending,
  onBeginEdit,
  onCancelEdit,
  onDraftNoteChange,
  onSaveNote,
  onClear,
}: {
  row: ZdEstimateOnRequestRow;
  editing: boolean;
  draftNote: string;
  pending: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onDraftNoteChange: (value: string) => void;
  onSaveNote: () => void;
  onClear: () => void;
}) {
  return (
    <li
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm shadow-slate-900/[0.02]",
        editing && "border-indigo-200/80 ring-1 ring-indigo-100"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-semibold tabular-nums tracking-tight text-slate-900">
              {row.twSymbol ?? `tw_Id ${row.subiektTwId}`}
            </p>
            {row.grtNazwa ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {row.grtNazwa}
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-snug text-slate-600">{row.twNazwa}</p>
          <p className="text-[11px] tabular-nums text-slate-400">
            tw_Id {row.subiektTwId}
            {" · "}
            od {formatPlDate(row.createdAt)}
          </p>
          {!editing && row.note ? (
            <p className="mt-1.5 rounded-md border border-amber-100/80 bg-amber-50/50 px-2.5 py-1.5 text-xs leading-relaxed text-amber-950/80">
              {row.note}
            </p>
          ) : null}
          {!editing && !row.note ? (
            <p className="mt-1 text-[11px] italic text-slate-400">Bez notatki</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={editing ? onCancelEdit : onBeginEdit}
          >
            {editing ? "Anuluj" : row.note ? "Edytuj" : "Notatka"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={onClear}
          >
            Usuń
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <label className="block text-xs font-medium text-slate-600">
            Notatka
            <Input
              value={draftNote}
              onChange={(e) => onDraftNoteChange(e.target.value)}
              maxLength={500}
              placeholder="Dlaczego tylko na prośbę…"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveNote();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] tabular-nums text-slate-400">
              {draftNote.length}/500
            </p>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={onSaveNote}
            >
              {pending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3.5" /> Zapis…
                </span>
              ) : (
                "Zapisz notatkę"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ZdEstimateOnRequestModal({
  open,
  onClose,
  onRequests,
  onOnRequestsChange,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onRequests: ZdEstimateOnRequestRow[];
  onOnRequestsChange: (rows: ZdEstimateOnRequestRow[]) => void;
  onError: (message: string) => void;
}) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of onRequests) {
      const key = e.grtNazwa?.trim() || "Bez grupy";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "pl")
    );
  }, [onRequests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return onRequests.filter((e) => {
      const groupKey = e.grtNazwa?.trim() || "Bez grupy";
      if (groupFilter !== "all" && groupKey !== groupFilter) return false;
      if (!q) return true;
      const hay = [
        e.twSymbol ?? "",
        e.twNazwa,
        e.grtNazwa ?? "",
        e.note,
        String(e.subiektTwId),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [onRequests, query, groupFilter]);

  const hasActiveFilters = query.trim().length > 0 || groupFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setGroupFilter("all");
    searchRef.current?.focus();
  };

  const beginEdit = (row: ZdEstimateOnRequestRow) => {
    setEditingId(row.subiektTwId);
    setDraftNote(row.note);
  };

  const saveNote = (subiektTwId: number) => {
    start(async () => {
      const res = await actionUpdateZdEstimateOnRequestNote({
        subiektTwId,
        note: draftNote,
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onOnRequestsChange(res.onRequests);
      setEditingId(null);
    });
  };

  const clear = (subiektTwId: number) => {
    start(async () => {
      const res = await actionClearZdEstimateOnRequest(subiektTwId);
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onOnRequestsChange(res.onRequests);
      if (editingId === subiektTwId) setEditingId(null);
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Tylko na prośbę"
      titleHint="Bez aktywnej prośby handlowca produkt zostaje poza Do ZD. Z prośbą — na listę tylko w ilości z prośby (bez celu zapasu). Lista wspólna dla działu — nie mylić z „w razie potrzeby” u dostawcy."
      size="xl"
      bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">
            {onRequests.length === 0
              ? "Brak produktów „tylko na prośbę”"
              : hasActiveFilters
                ? `Widoczne ${filtered.length} z ${onRequests.length}`
                : onRequests.length === 1
                  ? "1 produkt na liście"
                  : `${onRequests.length} produktów na liście`}
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
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <div className="flex gap-3">
          <IconClipboardList
            size={18}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-slate-500"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Zamawianie tylko przy prośbie
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Usuń wpis, gdy produkt ma wrócić do zwykłego liczenia zapasu.{" "}
              {ZD_ESTIMATE_UI.onRequestVsHardExclude}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
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
              placeholder="Symbol, nazwa, grupa, notatka…"
              className="pl-8 pr-9"
              autoComplete="off"
              autoFocus
            />
            {query ? (
              <button
                type="button"
                aria-label="Wyczyść wyszukiwanie"
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

        {groupCounts.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <GroupChip
              label="Wszystkie"
              count={onRequests.length}
              active={groupFilter === "all"}
              onClick={() => setGroupFilter("all")}
            />
            {groupCounts.map(([name, count]) => (
              <GroupChip
                key={name}
                label={name}
                count={count}
                active={groupFilter === name}
                onClick={() => setGroupFilter(name)}
              />
            ))}
            {hasActiveFilters ? (
              <button
                type="button"
                className="ml-0.5 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                onClick={clearFilters}
              >
                Wyczyść filtry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">
          {filtered.length === onRequests.length
            ? "Lista „tylko na prośbę”"
            : `Wyniki: ${filtered.length} z ${onRequests.length}`}
        </p>
        {filtered.length > 0 ? (
          <p className="text-[10px] text-slate-400">
            Usuń = wraca do zwykłego liczenia
          </p>
        ) : null}
      </div>

      {onRequests.length === 0 ? (
        <EmptyState
          icon={<IconClipboardList size={28} strokeWidth={1.75} />}
          title="Brak wpisów"
          description="Na liście szacunku otwórz menu ⋮ przy produkcie i wybierz „Tylko na prośbę” — poza Do ZD bez aktywnej prośby."
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nic nie pasuje do filtrów
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Spróbuj innego hasła albo wyczyść filtry grupy.
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={clearFilters}
            >
              Wyczyść filtry
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="max-h-[min(58vh,32rem)] space-y-2.5 overflow-y-auto overscroll-contain pr-0.5">
          {filtered.map((row) => (
            <OnRequestRow
              key={row.subiektTwId}
              row={row}
              editing={editingId === row.subiektTwId}
              draftNote={draftNote}
              pending={pending}
              onBeginEdit={() => beginEdit(row)}
              onCancelEdit={() => setEditingId(null)}
              onDraftNoteChange={setDraftNote}
              onSaveNote={() => saveNote(row.subiektTwId)}
              onClear={() => clear(row.subiektTwId)}
            />
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
