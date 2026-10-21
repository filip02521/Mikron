"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  actionLoadZdSharedScopeProducts,
  actionSetZdProductAssignments,
} from "@/app/actions/zd-scope-order";
import type { ZdEstimateSupplierOption } from "@/app/actions/zd-estimate";
import type { ZdSharedScope, ZdSharedScopeProduct } from "@/lib/data/zd-scope-order";
import {
  zdSplitApplyHistory,
  zdSplitAssign,
  zdSplitChanged,
  zdSplitCounts,
  zdSplitRangeSelect,
  zdSplitShortName,
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
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { zdEstimatePlCountWord as plWord } from "@/lib/orders/zd-estimate-ui-copy";

const PAGE = 300;
/** Powyżej tylu dostawców wybór w wierszu jest listą — przyciski przestają się mieścić. */
const MAX_INLINE_SUPPLIERS = 4;

const SPLIT_HELP =
  "Towar przypisany do dostawcy znika z listy „Do ZD” pozostałych dostawców tego zakresu. " +
  "Bez przypisania widzą go wszyscy. Para paczka/sztuka znika dopiero, gdy obie strony mają " +
  "tego samego dostawcę. Zmiana działa od kolejnego „Policz”.";

type Option = { id: string; name: string; short: string; key: string };

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
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
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [products, setProducts] = useState<ZdSharedScopeProduct[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [includeAll, setIncludeAll] = useState(false);
  /** Tylko zmiany użytkownika; brak klucza = zapisane przypisanie. */
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<ZdSplitFilter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // Nowa tożsamość callbacków rodzica nie może przeładować listy (skasowałaby zmiany).
  const onErrorRef = useRef(onError);
  const onDirtyRef = useRef(onDirtyChange);
  useEffect(() => {
    onErrorRef.current = onError;
    onDirtyRef.current = onDirtyChange;
  }, [onError, onDirtyChange]);

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
    });
    return () => {
      cancelled = true;
    };
  }, [scope.mode, scope.scopeId, includeAll]);

  const options = useMemo<Option[]>(
    () =>
      scope.supplierIds.map((id, i) => {
        const name = suppliers.find((s) => s.id === id)?.name?.trim() || id;
        return { id, name, short: zdSplitShortName(name), key: String(i + 1) };
      }),
    [scope.supplierIds, suppliers]
  );
  const nameOf = (id: string) =>
    options.find((o) => o.id === id)?.name ?? suppliers.find((s) => s.id === id)?.name ?? "inny dostawca";

  const all = useMemo(() => products ?? [], [products]);
  const changed = useMemo(() => zdSplitChanged(all, edits), [all, edits]);
  const counts = useMemo(() => zdSplitCounts(all, edits), [all, edits]);
  const conflictCount = useMemo(
    () => zdSplitVisible(all, edits, { kind: "conflict" }, "").length,
    [all, edits]
  );
  const visible = useMemo(() => zdSplitVisible(all, edits, filter, query), [all, edits, filter, query]);
  const visibleIds = useMemo(() => visible.map((p) => p.subiektTwId), [visible]);
  const rendered = visible.slice(0, limit);
  const hasHistory = all.some((p) => p.suggestedSupplierId);

  useEffect(() => {
    onDirtyRef.current(changed.length);
  }, [changed.length]);

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
    setEdits((prev) => zdSplitApplyHistory(prev, all, ids));
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
      twSymbol: p.twSymbol,
      twNazwa: p.twNazwa,
    }));
    startSave(async () => {
      const res = await actionSetZdProductAssignments({ items });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      const saved = new Map(items.map((i) => [i.subiektTwId, i.supplierId]));
      setProducts((prev) =>
        (prev ?? []).map((p) =>
          saved.has(p.subiektTwId) ? { ...p, assignedSupplierId: saved.get(p.subiektTwId) ?? null } : p
        )
      );
      setEdits({});
      setSavedCount(items.length);
      onSaved();
    });
  };

  const selectionSet = useMemo(() => new Set(selectedVisible), [selectedVisible]);
  const busy = saving || (loading && products == null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(e.target) || e.altKey) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setSelected((prev) => new Set([...prev, ...visibleIds]));
      return;
    }
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "Escape" && selectionSet.size > 0) {
      // Najpierw czyści zaznaczenie, dopiero kolejny Esc zamyka okno.
      e.preventDefault();
      e.stopPropagation();
      clearSelection();
      return;
    }
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
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={onKeyDown}
      aria-busy={busy || undefined}
    >
      <div className="shrink-0 space-y-4 border-b border-slate-100 px-5 py-4 sm:px-6">
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
            <p className="mt-1 text-sm text-slate-500">
              Wskaż, u którego dostawcy zamawiasz każdy towar. Zaznacz wiele wierszy i przypisz je naraz.
            </p>
          </div>
          {hasHistory ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => applyHistory()}
              title="Każdy towar z historią ZD dostaje dostawcę, u którego zamawiasz go najczęściej"
            >
              Wszystkie wg historii ZD
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtr towarów">
          <FilterChip active={filterIs({ kind: "all" })} count={all.length} onClick={() => changeFilter({ kind: "all" })}>
            Wszystkie
          </FilterChip>
          <FilterChip
            active={filterIs({ kind: "unassigned" })}
            count={counts.get("") ?? 0}
            onClick={() => changeFilter({ kind: "unassigned" })}
            title="Towary widoczne u wszystkich dostawców zakresu"
          >
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
              <Kbd className="bg-white">{o.key}</Kbd>
              {o.name}
            </FilterChip>
          ))}
          {conflictCount > 0 ? (
            <FilterChip
              active={filterIs({ kind: "conflict" })}
              count={conflictCount}
              onClick={() => changeFilter({ kind: "conflict" })}
              title="Wybór różny od dostawcy, u którego zamawiasz najczęściej"
            >
              Inaczej niż w ZD
            </FilterChip>
          ) : null}
          {changed.length > 0 ? (
            <FilterChip
              active={filterIs({ kind: "changed" })}
              count={changed.length}
              onClick={() => changeFilter({ kind: "changed" })}
            >
              Niezapisane
            </FilterChip>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={includeAll}
              disabled={loading}
              onChange={(e) => setIncludeAll(e.target.checked)}
            />
            Także towary bez historii ZD
          </label>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {products == null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
            <Spinner size="sm" /> Wczytuję towary zakresu…
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
              <tr className="text-left text-[13px] font-medium text-slate-500">
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
                <th className="border-b border-slate-200 px-2 py-2.5 font-medium">Towar</th>
                <th className="hidden border-b border-slate-200 px-2 py-2.5 font-medium md:table-cell">
                  Historia ZD
                </th>
                <th className="border-b border-slate-200 py-2.5 pl-2 pr-5 font-medium sm:pr-6">Zamawiaj u</th>
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
                const history = Object.entries(p.orderCountBySupplier).sort((a, b) => b[1] - a[1]);
                return (
                  <tr
                    key={tw}
                    aria-selected={isSelected}
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
                          <span className="shrink-0 rounded bg-indigo-50 px-1 text-[11px] font-medium text-indigo-800">
                            zmiana
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-slate-500" title={p.twNazwa}>
                        {p.twNazwa || "-"}
                      </p>
                    </td>
                    <td className="hidden px-2 py-2 align-middle text-xs text-slate-600 md:table-cell">
                      {history.length ? (
                        <>
                          <p className="truncate">
                            {history.map(([sid, n], i) => (
                              <span key={sid}>
                                {i > 0 ? <span className="text-slate-300"> · </span> : null}
                                <span className={cn(sid === p.suggestedSupplierId && "font-medium text-slate-900")}>
                                  {zdSplitShortName(nameOf(sid))}
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
            Zakres ma więcej towarów - pokazuję pierwsze {all.length}. Zawęź wyszukiwaniem w Subiekcie albo wyłącz towary bez historii.
          </p>
        ) : null}
        {loading && products != null ? (
          <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
              <Spinner size="sm" /> Odświeżam listę…
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
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
          <p className="text-xs leading-relaxed text-slate-500">
            {savedCount != null && changed.length === 0 ? (
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
