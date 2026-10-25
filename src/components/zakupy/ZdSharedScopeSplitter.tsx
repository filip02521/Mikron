"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  actionLoadZdSharedScopeProducts,
  actionSetZdProductAssignments,
} from "@/app/actions/zd-scope-order";
import type { ZdEstimateSupplierOption } from "@/app/actions/zd-estimate";
import type { ZdSharedScope, ZdSharedScopeProduct } from "@/lib/data/zd-scope-order";
import {
  zdSplitAlignablePairs,
  zdSplitAlignPairs,
  zdSplitApplyHistory,
  zdSplitAssign,
  zdSplitHistoryFillCount,
  zdSplitImpact,
  zdSplitPairMismatch,
  zdSplitPairMismatchCount,
  zdSplitSorted,
  type ZdSplitSort,
  zdSplitChanged,
  zdSplitCounts,
  zdSplitRangeSelect,
  zdSplitShortName,
  zdSplitShortNames,
  zdSplitValue,
  zdSplitVisible,
  type ZdSplitFilter,
} from "@/lib/orders/zd-shared-scope-split";
import { IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { Input } from "@/components/ui/Field";
import { Kbd } from "@/components/ui/Kbd";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { zdEstimatePlCountWord as plWord } from "@/lib/orders/zd-estimate-ui-copy";
import { BrandLoader } from "@/components/ui/BrandLoader";

const PAGE = 300;
/** Powyżej tylu dostawców wybór w wierszu jest listą — przyciski przestają się mieścić. */
const MAX_INLINE_SUPPLIERS = 4;

const SPLIT_HELP =
  "Towar przypisany do dostawcy znika z listy „Do ZD” pozostałych dostawców tego zakresu. " +
  "Bez przypisania widzą go wszyscy. Para paczka/sztuka znika dopiero, gdy obie strony mają " +
  "tego samego dostawcę. Zmiana działa od kolejnego „Policz”.";

type Option = { id: string; name: string; short: string; key: string; swatch: string };

/**
 * Kolory segmentów paska podziału — odcienie Petrolu i szarości (DESIGN.md: jeden akcent).
 * Kolor rozróżnia dostawców, nie niesie stanu.
 */
const SUPPLIER_SWATCHES = [
  "bg-indigo-800",
  "bg-indigo-500",
  "bg-indigo-300",
  "bg-slate-600",
  "bg-slate-400",
  "bg-indigo-100",
];
const UNASSIGNED_SWATCH = "bg-slate-200";
const OUTSIDE_SWATCH = "bg-amber-300";

type Segment = { key: string; label: string; count: number; swatch: string };

function PartitionBar({ segments, total }: { segments: readonly Segment[]; total: number }) {
  if (total === 0) return null;
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(", ")}
    >
      {segments
        .filter((s) => s.count > 0)
        .map((s) => (
          <span
            key={s.key}
            title={`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
            className={cn("h-full transition-[width] duration-300 ease-out motion-reduce:transition-none", s.swatch)}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-sm", className)} />;
}

const SORT_OPTIONS: { value: ZdSplitSort; label: string; title: string }[] = [
  { value: "symbol", label: "Symbol", title: "Sortuj po symbolu" },
  { value: "orders", label: "Liczba ZD", title: "Najczęściej zamawiane na górze" },
  { value: "recent", label: "Ostatnie ZD", title: "Ostatnio zamawiane na górze" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  // Checkbox wiersza ma fokus po kliknięciu — skróty mają wtedy działać.
  if (el instanceof HTMLInputElement) return el.type !== "checkbox" && el.type !== "radio";
  return el.isContentEditable || ["SELECT", "TEXTAREA"].includes(el.tagName);
}

function FilterChip({
  active,
  count,
  onClick,
  children,
  title,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
        active
          ? "bg-indigo-50 text-indigo-900 ring-1 ring-inset ring-indigo-200"
          : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {children}
      <span
        className={cn(
          "rounded px-1 tabular-nums",
          active ? "bg-white text-indigo-700" : "text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function RowPicker({
  value,
  options,
  suggestedId,
  outsideName,
  disabled,
  label,
  onPick,
}: {
  value: string;
  options: readonly Option[];
  suggestedId: string | null;
  outsideName: string | null;
  disabled: boolean;
  label: string;
  onPick: (supplierId: string) => void;
}) {
  if (options.length > MAX_INLINE_SUPPLIERS) {
    return (
      <select
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onPick(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="h-8 w-full min-w-0 cursor-pointer rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 transition-colors duration-150 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-56"
      >
        <option value="">Wszyscy</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.key}. {o.name}
            {o.id === suggestedId ? " (wg ZD)" : ""}
          </option>
        ))}
        {outsideName ? <option value={value}>{outsideName} (spoza zakresu)</option> : null}
      </select>
    );
  }
  const segments: { id: string; text: string; title: string }[] = [
    { id: "", text: "Wszyscy", title: "Bez przypisania - towar widzą wszyscy dostawcy zakresu" },
    ...options.map((o) => ({
      id: o.id,
      text: o.short,
      title: `${o.name}${o.id === suggestedId ? " - najczęściej zamawiany tu (historia ZD)" : ""}`,
    })),
  ];
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-0.5 [scrollbar-width:thin]"
      onClick={(e) => e.stopPropagation()}
    >
      {segments.map((sg) => {
        const active = value === sg.id;
        const suggested = sg.id !== "" && sg.id === suggestedId;
        return (
          <button
            key={sg.id || "all"}
            type="button"
            role="radio"
            aria-checked={active}
            title={sg.title}
            disabled={disabled}
            onClick={() => onPick(sg.id)}
            className={cn(
              "relative inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] px-2 text-xs font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
              active
                ? sg.id === ""
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-white text-indigo-800 shadow-sm ring-1 ring-inset ring-indigo-200"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {sg.text}
            {suggested ? (
              <span
                aria-label="wg historii ZD"
                className={cn("size-1.5 rounded-full", active ? "bg-indigo-600" : "bg-slate-400")}
              />
            ) : null}
          </button>
        );
      })}
      {outsideName && value && !options.some((o) => o.id === value) ? (
        <span
          className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-[5px] bg-white px-2 text-xs font-medium text-amber-900 shadow-sm"
          title="Towar jest przypisany do dostawcy spoza tego zakresu"
        >
          {outsideName}
        </span>
      ) : null}
    </div>
  );
}

export function ZdSharedScopeSplitter({
  scope,
  suppliers,
  onError,
  onDirtyChange,
  onSaved,
}: {
  scope: ZdSharedScope;
  suppliers: readonly ZdEstimateSupplierOption[];
  onError: (message: string) => void;
  onDirtyChange: (changedCount: number) => void;
  onSaved: () => void;
}) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [products, setProducts] = useState<ZdSharedScopeProduct[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [includeAll, setIncludeAll] = useState(false);
  /** Tylko zmiany użytkownika; brak klucza = zapisane przypisanie. */
  const [edits, setEdits] = useState<Record<number, string>>({});
  const editsRef = useRef(edits);
  useEffect(() => {
    editsRef.current = edits;
  }, [edits]);
  const [filter, setFilter] = useState<ZdSplitFilter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [sort, setSort] = useState<ZdSplitSort>("symbol");

  // Nowa tożsamość callbacków rodzica nie może przeładować listy (skasowałaby zmiany).
  const onErrorRef = useRef(onError);
  const onDirtyRef = useRef(onDirtyChange);
  useEffect(() => {
    onErrorRef.current = onError;
    onDirtyRef.current = onDirtyChange;
  }, [onError, onDirtyChange]);

  const supplierKey = scope.supplierIds.join(",");
  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      const res = await actionLoadZdSharedScopeProducts({
        mode: scope.mode,
        scopeId: scope.scopeId,
        includeAll,
      });
      if (cancelled) return;
      if (!res.ok) {
        onErrorRef.current(res.message);
        setProducts((prev) => prev ?? []);
        return;
      }
      setProducts(res.products);
      setTruncated(res.truncated);
      // Dostawca mógł zniknąć z zakresu (odświeżenie okna) — takich zmian serwer nie przyjmie.
      const allowed = new Set(supplierKey.split(","));
      const prev = editsRef.current;
      const kept = Object.entries(prev).filter(([, v]) => v === "" || allowed.has(v));
      const dropped = Object.keys(prev).length - kept.length;
      if (dropped > 0) {
        setEdits(Object.fromEntries(kept));
        onErrorRef.current(
          `Pominięto ${dropped} ${plWord(dropped, "zmianę", "zmiany", "zmian")} - dostawca nie ma już tego zakresu.`
        );
      }
    });
    return () => {
      cancelled = true;
    };
    // Zmiana dostawców zakresu (odświeżenie okna) przeładowuje historię ZD per dostawca.
  }, [scope.mode, scope.scopeId, includeAll, supplierKey]);

  const options = useMemo<Option[]>(() => {
    const names = scope.supplierIds.map((id) => suppliers.find((s) => s.id === id)?.name?.trim() || id);
    const shorts = zdSplitShortNames(names);
    return scope.supplierIds.map((id, i) => ({
      id,
      name: names[i],
      short: shorts[i],
      key: String(i + 1),
      swatch: SUPPLIER_SWATCHES[i % SUPPLIER_SWATCHES.length],
    }));
  }, [scope.supplierIds, suppliers]);
  const impactLabel = (value: string) => (value === "" ? "bez przypisania" : nameOf(value));
  const nameOf = (id: string) =>
    options.find((o) => o.id === id)?.name ?? suppliers.find((s) => s.id === id)?.name ?? "inny dostawca";

  const all = useMemo(() => zdSplitSorted(products ?? [], sort), [products, sort]);
  const byTw = useMemo(() => new Map(all.map((p) => [p.subiektTwId, p])), [all]);
  const changed = useMemo(() => zdSplitChanged(all, edits), [all, edits]);
  const counts = useMemo(() => zdSplitCounts(all, edits), [all, edits]);
  const conflictCount = useMemo(
    () => zdSplitVisible(all, edits, { kind: "conflict" }, "").length,
    [all, edits]
  );
  const splitCtx = useMemo(() => ({ byTw, scopeSupplierIds: scope.supplierIds }), [byTw, scope.supplierIds]);
  const pairMismatchCount = useMemo(() => zdSplitPairMismatchCount(all, edits, byTw), [all, edits, byTw]);
  const alignablePairs = useMemo(
    () => zdSplitAlignablePairs(all, edits, byTw, scope.supplierIds),
    [all, edits, byTw, scope.supplierIds]
  );
  const historyFill = useMemo(() => zdSplitHistoryFillCount(all, edits), [all, edits]);
  const impact = useMemo(() => zdSplitImpact(all, edits), [all, edits]);
  const outsideCount = useMemo(
    () =>
      [...counts.entries()]
        .filter(([v]) => v !== "" && !scope.supplierIds.includes(v))
        .reduce((n, [, c]) => n + c, 0),
    [counts, scope.supplierIds]
  );
  const segments = useMemo<Segment[]>(() => {
    return [
      ...options.map((o) => ({ key: o.id, label: o.name, count: counts.get(o.id) ?? 0, swatch: o.swatch })),
      { key: "__outside", label: "Dostawcy spoza zakresu", count: outsideCount, swatch: OUTSIDE_SWATCH },
      { key: "", label: "Bez przypisania", count: counts.get("") ?? 0, swatch: UNASSIGNED_SWATCH },
    ];
  }, [counts, options, outsideCount]);
  const assignedCount = all.length - (counts.get("") ?? 0);
  const visible = useMemo(
    () => zdSplitVisible(all, edits, filter, query, splitCtx),
    [all, edits, filter, query, splitCtx]
  );
  const visibleIds = useMemo(() => visible.map((p) => p.subiektTwId), [visible]);
  const rendered = visible.slice(0, limit);
  const hasHistory = all.some((p) => p.suggestedSupplierId);

  useEffect(() => {
    onDirtyRef.current(changed.length);
  }, [changed.length]);
  // Panel znika (np. zakres przestał być wspólny) — jego zmian już nie ma, rodzic nie może o nie pytać.
  useEffect(() => () => onDirtyRef.current(0), []);

  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected;
  const headerBoxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerBoxRef.current) headerBoxRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const touch = () => setSavedCount(null);

  const assign = (ids: Iterable<number>, supplierId: string) => {
    touch();
    setEdits((prev) => zdSplitAssign(prev, ids, supplierId));
  };

  const applyHistory = (ids?: ReadonlySet<number>) => {
    touch();
    // Bez zaznaczenia uzupełniamy tylko puste — zapisane decyzje zostają.
    setEdits((prev) => zdSplitApplyHistory(prev, all, ids, { onlyUnassigned: !ids }));
  };

  const toggleRow = (tw: number, shift: boolean) => {
    const select = !selected.has(tw);
    setSelected((prev) => {
      if (shift) return zdSplitRangeSelect(visibleIds, prev, anchor, tw, select);
      const next = new Set(prev);
      if (select) next.add(tw);
      else next.delete(tw);
      return next;
    });
    setAnchor(tw);
    // Klik w komórkę nie daje fokusu — bez tego skróty 1–9 / 0 / H nie działają.
    if (!rootRef.current?.contains(document.activeElement)) rootRef.current?.focus({ preventScroll: true });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
    setAnchor(null);
  };

  const changeFilter = (next: ZdSplitFilter) => {
    setFilter(next);
    setLimit(PAGE);
  };

  const save = () => {
    if (!changed.length) return;
    const items = changed.map((p) => ({
      subiektTwId: p.subiektTwId,
      supplierId: zdSplitValue(edits, p) || null,
    }));
    startSave(async () => {
      const res = await actionSetZdProductAssignments({ items });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      const saved = new Map(items.map((i) => [i.subiektTwId, i.supplierId]));
      const now = new Date().toISOString();
      setProducts((prev) =>
        (prev ?? []).map((p) => {
          let next = p;
          if (saved.has(p.subiektTwId)) {
            const sid = saved.get(p.subiektTwId) ?? null;
            next = { ...next, assignedSupplierId: sid, assignedAt: sid ? now : null, assignedBy: sid ? "Ty" : null };
          }
          if (next.pair && saved.has(next.pair.otherTwId)) {
            next = {
              ...next,
              pair: { ...next.pair, otherAssignedSupplierId: saved.get(next.pair.otherTwId) ?? null },
            };
          }
          return next;
        })
      );
      setEdits({});
      setSavedCount(items.length);
      onSaved();
    });
  };

  const selectionSet = useMemo(() => new Set(selectedVisible), [selectedVisible]);
  // Zapis w trakcie przeładowania listy dałby wyścig: stara odpowiedź nadpisałaby zapisane przypisania.
  const busy = saving || loading;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && selectionSet.size > 0) {
      // Najpierw czyści zaznaczenie (także z pola szukania), dopiero kolejny Esc zamyka okno.
      e.preventDefault();
      e.stopPropagation();
      clearSelection();
      return;
    }
    if (isTypingTarget(e.target) || e.altKey) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setSelected((prev) => new Set([...prev, ...visibleIds]));
      return;
    }
    if (e.metaKey || e.ctrlKey) return;
    if (!selectionSet.size || busy) return;
    if (e.key === "0") {
      e.preventDefault();
      assign(selectionSet, "");
    } else if (/^[1-9]$/.test(e.key)) {
      const opt = options[Number(e.key) - 1];
      if (!opt) return;
      e.preventDefault();
      assign(selectionSet, opt.id);
    } else if (e.key.toLowerCase() === "h" && hasHistory) {
      e.preventDefault();
      applyHistory(selectionSet);
    }
  };

  const filterIs = (f: ZdSplitFilter) =>
    filter.kind === f.kind &&
    (f.kind !== "supplier" || (filter.kind === "supplier" && filter.supplierId === f.supplierId));

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="flex min-w-0 flex-col outline-none lg:min-h-0 lg:flex-1"
      onKeyDown={onKeyDown}
      aria-busy={busy || undefined}
    >
      <div className="shrink-0 space-y-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={scope.mode === "cecha" ? "info" : "default"}>
                {scope.mode === "cecha" ? "Cecha" : "Grupa"}
              </Badge>
              <h3 className="min-w-0 truncate text-base font-semibold tracking-tight text-slate-900">
                {scope.label || `#${scope.scopeId}`}
              </h3>
              <span className="text-xs tabular-nums text-slate-500">#{scope.scopeId}</span>
              <HelpHintBubble message={SPLIT_HELP} ariaLabel="Jak działa rozdzielanie" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {alignablePairs > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  touch();
                  setEdits((prev) => zdSplitAlignPairs(all, prev, byTw, scope.supplierIds));
                }}
                title="Sztuki dostają dostawcę paczki (paczka bez przypisania przejmuje dostawcę sztuk) - inaczej para nie znika u pozostałych dostawców"
              >
                Wyrównaj pary ({alignablePairs})
              </Button>
            ) : null}
            {historyFill > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => applyHistory()}
                title="Towary bez przypisania dostają dostawcę, u którego zamawiasz je najczęściej. Zapisane decyzje zostają bez zmian."
              >
                Uzupełnij wg historii ZD ({historyFill})
              </Button>
            ) : null}
          </div>
        </div>

        {all.length > 0 ? (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 text-xs">
              <span className="text-slate-600">
                <span className="font-medium tabular-nums text-slate-900">{assignedCount}</span> z{" "}
                <span className="tabular-nums">{all.length}</span> przypisanych
                <span className="tabular-nums text-slate-500">
                  {" "}
                  ({Math.round((assignedCount / all.length) * 100)}%)
                </span>
              </span>
              {changed.length > 0 ? <span className="text-slate-500">· z niezapisanymi</span> : null}
            </div>
            <div className="min-w-0 flex-1">
              <PartitionBar segments={segments} total={all.length} />
            </div>
          </div>
        ) : null}

        <div
          className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          role="group"
          aria-label="Filtr towarów"
        >
          <FilterChip active={filterIs({ kind: "all" })} count={all.length} onClick={() => changeFilter({ kind: "all" })}>
            Wszystkie
          </FilterChip>
          <FilterChip
            active={filterIs({ kind: "unassigned" })}
            count={counts.get("") ?? 0}
            onClick={() => changeFilter({ kind: "unassigned" })}
            title="Towary widoczne u wszystkich dostawców zakresu"
          >
            <Swatch className={UNASSIGNED_SWATCH} />
            Bez przypisania
          </FilterChip>
          {options.map((o) => (
            <FilterChip
              key={o.id}
              active={filterIs({ kind: "supplier", supplierId: o.id })}
              count={counts.get(o.id) ?? 0}
              onClick={() => changeFilter({ kind: "supplier", supplierId: o.id })}
              title={o.name}
            >
              <Swatch className={o.swatch} />
              {o.name}
              <Kbd className="bg-white">{o.key}</Kbd>
            </FilterChip>
          ))}
          {outsideCount > 0 || filter.kind === "outside" ? (
            <FilterChip
              active={filterIs({ kind: "outside" })}
              count={outsideCount}
              onClick={() => changeFilter({ kind: "outside" })}
              title="Towary przypisane do dostawcy, który nie ma tego zakresu - nie pokażą się u żadnego z dostawców zakresu"
            >
              <Swatch className={OUTSIDE_SWATCH} />
              Spoza zakresu
            </FilterChip>
          ) : null}
          {pairMismatchCount > 0 || filter.kind === "pair" ? (
            <FilterChip
              active={filterIs({ kind: "pair" })}
              count={pairMismatchCount}
              onClick={() => changeFilter({ kind: "pair" })}
              title="Pary paczka/sztuki z różnym dostawcą po obu stronach - para nie zniknie u pozostałych"
            >
              Niespójne pary
            </FilterChip>
          ) : null}
          {conflictCount > 0 || filter.kind === "conflict" ? (
            <FilterChip
              active={filterIs({ kind: "conflict" })}
              count={conflictCount}
              onClick={() => changeFilter({ kind: "conflict" })}
              title="Wybór różny od dostawcy, u którego zamawiasz najczęściej"
            >
              Inaczej niż w ZD
            </FilterChip>
          ) : null}
          {changed.length > 0 || filter.kind === "changed" ? (
            <FilterChip
              active={filterIs({ kind: "changed" })}
              count={changed.length}
              onClick={() => changeFilter({ kind: "changed" })}
            >
              Niezapisane
            </FilterChip>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <label htmlFor={searchId} className="relative min-w-0 flex-1">
            <span className="sr-only">Szukaj towaru</span>
            <IconSearch
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              ref={searchRef}
              id={searchId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Symbol, nazwa albo id towaru…"
              className="h-9 pl-8 pr-8"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                aria-label="Wyczyść wyszukiwanie"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
              >
                <IconX size={14} strokeWidth={2} />
              </button>
            ) : null}
          </label>
          {(query.trim() || filter.kind !== "all") && visibleIds.length > 0 && !allVisibleSelected ? (
            <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={toggleAllVisible}>
              Zaznacz wyniki ({visibleIds.length})
            </Button>
          ) : null}
          <SegmentedControl
            ariaLabel="Sortowanie towarów"
            density="compact"
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            className="shrink-0 self-start sm:self-auto"
          />
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={includeAll}
              disabled={loading || changed.length > 0}
              title={changed.length > 0 ? "Zapisz albo cofnij zmiany przed przełączeniem listy" : undefined}
              onChange={(e) => {
                setIncludeAll(e.target.checked);
                clearSelection();
              }}
            />
            Także towary bez historii ZD
          </label>
        </div>

      </div>

      <div className="relative min-w-0 overflow-x-auto lg:min-h-0 lg:flex-1 lg:overflow-auto">
        {products == null ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
            <BrandLoader size="md" /> Wczytuję towary zakresu…
          </div>
        ) : all.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-900">Brak towarów z historią ZD</p>
            <p className="mt-1 text-sm text-slate-500">
              {includeAll
                ? "Indeks Subiekta nie ma towarów w tym zakresie."
                : "Żaden towar z zakresu nie był zamawiany u tych dostawców. Włącz „Także towary bez historii ZD”."}
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-900">Nic nie pasuje do filtra</p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-indigo-700 underline-offset-4 hover:underline"
              onClick={() => {
                setQuery("");
                changeFilter({ kind: "all" });
              }}
            >
              Pokaż wszystkie towary
            </button>
          </div>
        ) : (
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
              <tr className="text-left text-[0.8125rem] font-medium text-slate-500">
                <th className="w-10 border-b border-slate-200 py-2.5 pl-5 pr-2 sm:pl-6">
                  <input
                    ref={headerBoxRef}
                    type="checkbox"
                    className="size-4 cursor-pointer rounded border-slate-300 align-middle"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label={
                      allVisibleSelected
                        ? "Odznacz widoczne towary"
                        : `Zaznacz wszystkie widoczne towary (${visibleIds.length})`
                    }
                  />
                </th>
                <th className="w-full border-b border-slate-200 px-2 py-2.5 font-medium">Towar</th>
                <th className="hidden w-64 border-b border-slate-200 px-2 py-2.5 font-medium md:table-cell">
                  Historia ZD
                </th>
                <th className="w-px whitespace-nowrap border-b border-slate-200 py-2.5 pl-2 pr-5 font-medium sm:pr-6">
                  Zamawiaj u
                </th>
              </tr>
            </thead>
            <tbody>
              {rendered.map((p) => {
                const tw = p.subiektTwId;
                const value = zdSplitValue(edits, p);
                const isChanged = value !== (p.assignedSupplierId ?? "");
                const isSelected = selected.has(tw);
                const outside =
                  value && !scope.supplierIds.includes(value) ? nameOf(value) : null;
                const pairMismatch = zdSplitPairMismatch(p, edits, byTw);
                const history = Object.entries(p.orderCountBySupplier)
                  .filter(([, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1]);
                return (
                  <tr
                    key={tw}
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      // Shift+klik zaznacza wiersze, nie tekst między nimi.
                      if (e.shiftKey) e.preventDefault();
                    }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, select, input, a")) return;
                      toggleRow(tw, e.shiftKey);
                    }}
                    className={cn(
                      "cursor-default transition-colors duration-150 [&>td]:border-b [&>td]:border-slate-100",
                      isSelected ? "bg-indigo-50/60" : "hover:bg-slate-50"
                    )}
                  >
                    <td className="py-2 pl-5 pr-2 align-middle sm:pl-6">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer rounded border-slate-300 align-middle"
                        checked={isSelected}
                        onChange={() => undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(tw, e.shiftKey);
                        }}
                        aria-label={`Zaznacz ${p.twSymbol ?? p.twNazwa}`}
                      />
                    </td>
                    <td className="max-w-0 px-2 py-2 align-middle">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-xs font-medium text-slate-900">
                          {p.twSymbol ?? `#${tw}`}
                        </span>
                        {isChanged ? (
                          <span className="shrink-0 rounded bg-indigo-50 px-1 text-[0.6875rem] font-medium text-indigo-800">
                            zmiana
                          </span>
                        ) : null}
                        {p.pair ? (
                          pairMismatch ? (
                            <span
                              className="shrink-0 rounded bg-amber-50 px-1 text-[0.6875rem] font-medium text-amber-900"
                              title={`${p.pair.role === "pack" ? "Sztuki" : "Paczka"} ${
                                p.pair.otherSymbol ?? `#${p.pair.otherTwId}`
                              } ma innego dostawcę${
                                byTw.has(p.pair.otherTwId) ? "" : " (towar spoza tej listy)"
                              }. Para zniknie u pozostałych dopiero przy zgodnym wyborze.`}
                            >
                              para: {p.pair.otherSymbol ?? `#${p.pair.otherTwId}`} inaczej
                            </span>
                          ) : (
                            <span
                              className="shrink-0 rounded bg-slate-100 px-1 text-[0.6875rem] font-medium text-slate-600"
                              title={`Para z ${p.pair.otherSymbol ?? `#${p.pair.otherTwId}`}`}
                            >
                              {p.pair.role === "pack" ? "paczka" : "sztuki"}
                            </span>
                          )
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-slate-500" title={p.twNazwa}>
                        {p.twNazwa || "-"}
                      </p>
                    </td>
                    <td className="hidden max-w-64 px-2 py-2 align-middle text-xs text-slate-600 md:table-cell">
                      {history.length ? (
                        <>
                          <p className="truncate">
                            {history.map(([sid, n], i) => (
                              <span key={sid}>
                                {i > 0 ? <span className="text-slate-300"> · </span> : null}
                                <span className={cn(sid === p.suggestedSupplierId && "font-medium text-slate-900")}>
                                  {options.find((o) => o.id === sid)?.short ?? zdSplitShortName(nameOf(sid))}
                                </span>{" "}
                                <span className="tabular-nums text-slate-500">{n}×</span>
                              </span>
                            ))}
                          </p>
                          {p.lastOrderAt ? (
                            <p className="tabular-nums text-slate-500">ostatnio {formatPlDate(p.lastOrderAt)}</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-400">brak ZD</span>
                      )}
                    </td>
                    <td className="py-2 pl-2 pr-5 align-middle sm:pr-6">
                      <RowPicker
                        value={value}
                        options={options}
                        suggestedId={p.suggestedSupplierId}
                        outsideName={outside}
                        disabled={saving}
                        label={`Dostawca dla ${p.twSymbol ?? p.twNazwa}`}
                        onPick={(sid) => assign([tw], sid)}
                      />
                      {p.assignedAt && !isChanged ? (
                        <p className="mt-1 text-[0.6875rem] tabular-nums text-slate-500">
                          zapisane {formatPlDate(p.assignedAt)}
                          {p.assignedBy ? ` · ${p.assignedBy}` : ""}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {visible.length > rendered.length ? (
          <div className="flex justify-center py-4">
            <Button type="button" size="sm" variant="ghost" onClick={() => setLimit((n) => n + PAGE)}>
              Pokaż kolejne {Math.min(PAGE, visible.length - rendered.length)} z {visible.length - rendered.length}
            </Button>
          </div>
        ) : null}
        {truncated ? (
          <p className="px-6 pb-4 text-center text-xs text-slate-500">
            {includeAll
              ? `Zakres ma więcej towarów - pokazuję ${all.length}: najpierw z historią ZD i przypisaniem, potem najnowsze. Wyłącz „Także towary bez historii ZD”, żeby zobaczyć tylko zamawiane.`
              : `Zakres ma ponad ${all.length} towarów z historią ZD lub przypisaniem - pokazuję ${all.length} najnowszych w katalogu. Starsze towary są poza listą - podziel zakres na mniejsze grupy lub cechy.`}
          </p>
        ) : null}
        {loading && products != null ? (
          <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
              <BrandLoader size="sm" tile={false} /> Odświeżam listę…
            </span>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:px-6 lg:static lg:flex-row lg:items-center lg:justify-between">
        {selectionSet.size > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2" role="toolbar" aria-label="Akcje dla zaznaczonych">
            <span className="text-sm font-medium tabular-nums text-slate-900">
              Zaznaczone: {selectionSet.size}
            </span>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            {options.map((o) => (
              <Button
                key={o.id}
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => assign(selectionSet, o.id)}
                title={`Przypisz zaznaczone do: ${o.name}`}
              >
                <Kbd>{o.key}</Kbd>
                {o.name}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => assign(selectionSet, "")}
              title="Zdejmij przypisanie - towary zobaczą wszyscy dostawcy zakresu"
            >
              <Kbd>0</Kbd>
              Wszyscy
            </Button>
            {hasHistory ? (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => applyHistory(selectionSet)}>
                <Kbd>H</Kbd>
                Wg historii ZD
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
              <Kbd>Esc</Kbd>
              Odznacz
            </Button>
          </div>
        ) : (
          <p
            className={cn(
              "min-w-0 text-xs leading-relaxed text-slate-500",
              savedCount == null && changed.length === 0 && "hidden sm:block"
            )}
          >
            {changed.length > 0 ? (
              <span className="text-slate-600">
                Po zapisie:{" "}
                {impact.length === 0 ? (
                  <span className="text-slate-500">liczby bez zmian - towary zamieniają się między dostawcami</span>
                ) : null}
                {impact.map((row, i) => (
                  <span key={row.value || "none"} className="whitespace-nowrap">
                    {i > 0 ? <span className="text-slate-300"> · </span> : null}
                    {impactLabel(row.value)}{" "}
                    <span className="tabular-nums text-slate-500">{row.before}</span>
                    <span className="text-slate-400"> → </span>
                    <span className="font-medium tabular-nums text-slate-900">{row.after}</span>
                  </span>
                ))}
              </span>
            ) : savedCount != null ? (
              <span className="font-medium text-emerald-700">
                Zapisano {savedCount} {plWord(savedCount, "zmianę", "zmiany", "zmian")} - działa od kolejnego „Policz”.
              </span>
            ) : (
              <>
                Klik w wiersz zaznacza, <Kbd>Shift</Kbd> + klik zaznacza zakres, <Kbd>Ctrl</Kbd>+<Kbd>A</Kbd> wszystkie widoczne.
              </>
            )}
          </p>
        )}
        <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving || changed.length === 0}
            onClick={() => {
              setEdits({});
              touch();
            }}
          >
            Cofnij zmiany
          </Button>
          <Button type="button" size="sm" disabled={busy || changed.length === 0} onClick={save}>
            {saving ? <Spinner size="sm" /> : null}
            {changed.length
              ? `Zapisz ${changed.length} ${plWord(changed.length, "zmianę", "zmiany", "zmian")}`
              : "Zapisz"}
          </Button>
        </div>
      </div>
    </div>
  );
}
