"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { IconAlertCircle, IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { useActiveTeethShortages } from "@/components/layout/TeethShortagesContext";
import {
  TEETH_KIND_LABELS,
  parseTeethProductLine,
  teethProductLineLabel,
} from "@/lib/teeth/teeth-catalog";
import {
  classifyTeethShortageAvailability,
  teethShortageAvailabilityBadgeClass,
  teethShortageAvailabilityBadgeLabel,
} from "@/lib/teeth/teeth-shortage-copy";
import type { ActiveTeethShortageEntry } from "@/lib/data/teeth-shortages";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  salesTypography,
} from "@/lib/ui/ontime-theme";
import { warsawNowParts } from "@/lib/time/warsaw";

type AvailabilityFilter = "all" | "undated" | "past" | "noted";

const FILTER_CHIPS: { id: AvailabilityFilter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "undated", label: "Bez daty" },
  { id: "past", label: "Termin minął" },
  { id: "noted", label: "Z uwagą" },
];

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        "inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs",
        active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
      )}
    >
      {label}
      {typeof count === "number" ? (
        <span
          className={cn(
            "tabular-nums",
            active ? "text-indigo-800/80" : "text-slate-400",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function VariantMeta({
  color,
  mould,
  kind,
}: {
  color: string;
  mould: string;
  kind: ActiveTeethShortageEntry["kind"];
}) {
  const parts = [
    color.trim(),
    mould.trim() || null,
    kind ? TEETH_KIND_LABELS[kind] : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {parts.map((part) => (
        <span
          key={part}
          className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200/80"
        >
          {part}
        </span>
      ))}
    </div>
  );
}

function ShortageLookupRow({
  shortage,
  todayKey,
}: {
  shortage: ActiveTeethShortageEntry;
  todayKey: string;
}) {
  const lineLabel =
    teethProductLineLabel(parseTeethProductLine(shortage.productLine)) ??
    shortage.productLine;
  const note = shortage.note.trim();
  const availabilityKind = classifyTeethShortageAvailability(
    shortage.availableFrom,
    todayKey,
  );

  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-3 sm:px-3.5",
        availabilityKind === "undated"
          ? "border-amber-200/80 bg-amber-50/40"
          : availabilityKind === "past"
            ? "border-rose-200/70 bg-rose-50/30"
            : "border-slate-200/80 bg-white",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold text-slate-900", salesTypography.rowBody)}>
            {lineLabel}
          </p>
          <p className={cn("mt-0.5 text-slate-600", salesTypography.rowMeta)}>
            {shortage.supplierName}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1",
            teethShortageAvailabilityBadgeClass(shortage.availableFrom, todayKey),
          )}
        >
          {teethShortageAvailabilityBadgeLabel(shortage.availableFrom, todayKey)}
        </span>
      </div>

      <VariantMeta
        color={shortage.color}
        mould={shortage.mould}
        kind={shortage.kind}
      />

      {note ? (
        <p className="mt-2 rounded-md border border-amber-200/70 bg-amber-50/70 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950">
          <span className="font-semibold text-amber-900/80">Uwaga: </span>
          {note}
        </p>
      ) : null}
    </li>
  );
}

export function TeethShortageLookupButton({
  className,
}: {
  className?: string;
}) {
  const shortages = useActiveTeethShortages();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  if (shortages.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "gap-1.5 border-amber-200/90 bg-amber-50/50 text-amber-950 hover:bg-amber-50",
          className,
        )}
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        <IconAlertCircle size={14} strokeWidth={2.25} className="text-amber-700" />
        Braki zębowe
        <span className="rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-900">
          {shortages.length}
        </span>
      </Button>
      <TeethShortageLookupModal
        key={session}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function TeethShortageLookupModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const shortages = useActiveTeethShortages();
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const todayKey = warsawNowParts().dateKey;

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  const filterCounts = useMemo(() => {
    let undated = 0;
    let past = 0;
    let noted = 0;
    for (const s of shortages) {
      const kind = classifyTeethShortageAvailability(s.availableFrom, todayKey);
      if (kind === "undated") undated += 1;
      if (kind === "past") past += 1;
      if (s.note.trim()) noted += 1;
    }
    return {
      all: shortages.length,
      undated,
      past,
      noted,
    } satisfies Record<AvailabilityFilter, number>;
  }, [shortages, todayKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shortages
      .filter((s) => {
        if (availabilityFilter === "undated") {
          return classifyTeethShortageAvailability(s.availableFrom, todayKey) === "undated";
        }
        if (availabilityFilter === "past") {
          return classifyTeethShortageAvailability(s.availableFrom, todayKey) === "past";
        }
        if (availabilityFilter === "noted") {
          return Boolean(s.note.trim());
        }
        return true;
      })
      .filter((s) => {
        if (!q) return true;
        const hay = [
          s.supplierName,
          s.productLine,
          s.color,
          s.mould,
          s.note,
          s.kind ? TEETH_KIND_LABELS[s.kind] : "",
          teethProductLineLabel(parseTeethProductLine(s.productLine)),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice()
      .sort((a, b) => {
        const ak = classifyTeethShortageAvailability(a.availableFrom, todayKey);
        const bk = classifyTeethShortageAvailability(b.availableFrom, todayKey);
        const rank = (k: typeof ak) => (k === "undated" ? 0 : k === "past" ? 1 : 2);
        const rd = rank(ak) - rank(bk);
        if (rd !== 0) return rd;
        const ad = a.availableFrom ?? "";
        const bd = b.availableFrom ?? "";
        if (ad !== bd) return ad.localeCompare(bd);
        return a.productLine.localeCompare(b.productLine);
      });
  }, [shortages, query, availabilityFilter, todayKey]);

  const hasActiveFilters = query.trim().length > 0 || availabilityFilter !== "all";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Braki zębowe u dostawców"
      titleHint="Lista aktywnych braków z działu zębów. Przy składaniu prośby zobaczysz też ostrzeżenie, jeśli wybierzesz taki wariant — wysyłka nie jest blokowana."
      titleId="teeth-shortage-lookup-title"
      size="lg"
      tier="stack"
      bodyClassName="space-y-3 px-4 py-3 sm:px-5 sm:py-4"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">
            To tylko informacja — możesz wysłać prośbę mimo braku.
          </p>
          <Button variant="secondary" onClick={onClose} className="self-end sm:self-auto">
            Zamknij
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border border-amber-200/70 bg-amber-50/45 px-3 py-2.5">
        <div className="flex gap-2.5">
          <IconAlertCircle
            size={18}
            strokeWidth={2.25}
            className="mt-0.5 shrink-0 text-amber-700"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-950">
              {filterCounts.all === 1
                ? "1 aktywny brak u dostawcy"
                : `${filterCounts.all} aktywnych braków u dostawców`}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-amber-900/85">
              Sprawdź kolor i fason przed wysłaniem — albo użyj wyszukiwarki poniżej.
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
              placeholder="linia, kolor, fason, dostawca, uwaga…"
              className="pl-8 pr-9"
              autoComplete="off"
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

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_CHIPS.map((chip) => (
            <FilterChip
              key={chip.id}
              label={chip.label}
              active={availabilityFilter === chip.id}
              count={filterCounts[chip.id]}
              onClick={() => setAvailabilityFilter(chip.id)}
            />
          ))}
          {hasActiveFilters ? (
            <button
              type="button"
              className="ml-0.5 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              onClick={() => {
                setQuery("");
                setAvailabilityFilter("all");
                searchRef.current?.focus();
              }}
            >
              Wyczyść filtry
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500">
          {filtered.length === shortages.length
            ? "Lista braków"
            : `Wyniki: ${filtered.length} z ${shortages.length}`}
        </p>
        {filtered.length > 0 ? (
          <p className="text-[10px] text-slate-400">Najpierw bez daty, potem minione terminy</p>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Nic nie pasuje do filtrów</p>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Spróbuj innego hasła albo wyczyść filtry — lista pokazuje tylko aktywne braki.
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setQuery("");
                setAvailabilityFilter("all");
              }}
            >
              Wyczyść filtry
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="max-h-[min(52vh,28rem)] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
          {filtered.map((s) => (
            <ShortageLookupRow key={s.id} shortage={s} todayKey={todayKey} />
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
