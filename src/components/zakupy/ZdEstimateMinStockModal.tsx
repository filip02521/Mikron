"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import {
  actionDeleteZdEstimateMinStock,
  actionUpsertZdEstimateMinStock,
} from "@/app/actions/zd-estimate";
import { actionSubiektSuggestProducts } from "@/app/actions/subiekt";
import type { ZdEstimateMinStockRow } from "@/lib/data/zd-estimate-min-stock";
import type { SubiektProduct } from "@/lib/subiekt/types";
import {
  formatSubiektProductOption,
  inferProductZdLookupSearchField,
  minProductSearchLength,
  subiektFieldText,
} from "@/lib/subiekt/product-pick";
import {
  IconPackageCheck,
  IconSearch,
  IconX,
  IconPlusCircle,
  IconTrash2,
} from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import {
  TypeaheadDropdown,
  TypeaheadOption,
} from "@/components/ui/TypeaheadDropdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { panelTypography } from "@/lib/ui/ontime-theme";

const MIN_STOCK_MAX = 1_000_000;

type SortKey = "symbol" | "value" | "date";
type GroupFilter = "all" | string;

function assertMinStockSzt(raw: string):
  | { ok: true; value: number }
  | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, message: ZD_ESTIMATE_UI.minStockValueRequiredError };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return {
      ok: false,
      message: ZD_ESTIMATE_UI.minStockValueRequiredError,
    };
  }
  if (n > MIN_STOCK_MAX) {
    return { ok: false, message: ZD_ESTIMATE_UI.minStockValueRequiredError };
  }
  return { ok: true, value: Math.trunc(n) };
}

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

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
        active
          ? "bg-slate-100 text-slate-900"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      )}
    >
      {label}
      <span className="text-[9px] leading-none">
        {active ? (direction === "asc" ? "▲" : "▼") : "▾"}
      </span>
    </button>
  );
}

function MinStockRow({
  row,
  editing,
  selected,
  pending,
  draftValue,
  draftNote,
  showDraftError,
  draftCheck,
  onToggleSelect,
  onBeginEdit,
  onCancelEdit,
  onDraftValueChange,
  onDraftNoteChange,
  onSave,
  onRemove,
}: {
  row: ZdEstimateMinStockRow;
  editing: boolean;
  selected: boolean;
  pending: boolean;
  draftValue: string;
  draftNote: string;
  showDraftError: boolean;
  draftCheck: { ok: true; value: number } | { ok: false; message: string };
  onToggleSelect: () => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onDraftValueChange: (v: string) => void;
  onDraftNoteChange: (v: string) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border bg-white px-4 py-3.5 shadow-sm shadow-slate-900/[0.02] transition",
        editing
          ? "border-indigo-200/80 ring-1 ring-indigo-100"
          : selected
            ? "border-indigo-200/60 bg-indigo-50/30"
            : "border-slate-200/90"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <label className="mt-0.5 flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="size-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/40"
              aria-label={`Zaznacz ${row.twSymbol ?? row.twNazwa}`}
            />
          </label>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-semibold tabular-nums tracking-tight text-slate-900">
                {row.twSymbol ?? `tw_Id ${row.subiektTwId}`}
              </p>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-900 ring-1 ring-emerald-100">
                min {row.minStockSzt} szt
              </span>
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
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={editing ? onCancelEdit : onBeginEdit}
          >
            {editing ? "Anuluj" : "Edytuj"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={onRemove}
            title={ZD_ESTIMATE_UI.minStockClearCta}
          >
            Usuń
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
          <div className="grid gap-2.5 sm:grid-cols-[8rem_1fr]">
            <label className="block text-xs font-medium text-slate-600">
              {ZD_ESTIMATE_UI.minStockValueLabel}
              <Input
                type="number"
                min={0}
                max={MIN_STOCK_MAX}
                step={1}
                className="mt-1 tabular-nums"
                value={draftValue}
                onChange={(e) => onDraftValueChange(e.target.value)}
                aria-invalid={showDraftError || undefined}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSave();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onCancelEdit();
                  }
                }}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              {ZD_ESTIMATE_UI.minStockNoteLabel}
              <Input
                className="mt-1"
                value={draftNote}
                maxLength={500}
                placeholder="Dlaczego to minimum…"
                onChange={(e) => onDraftNoteChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSave();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onCancelEdit();
                  }
                }}
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2">
            {showDraftError ? (
              <p className={cn(panelTypography.caption, "text-amber-800")}>
                {draftCheck.ok ? null : draftCheck.message}
              </p>
            ) : (
              <p className={cn(panelTypography.caption)}>
                {ZD_ESTIMATE_UI.minStockValueHint}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              disabled={pending || !draftCheck.ok}
              onClick={onSave}
            >
              {pending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3.5" /> Zapis…
                </span>
              ) : (
                "Zapisz"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ZdEstimateMinStockModal({
  open,
  onClose,
  minStock,
  onMinStockChange,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  minStock: ZdEstimateMinStockRow[];
  onMinStockChange: (rows: ZdEstimateMinStockRow[]) => void;
  onError: (message: string) => void;
}) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const addSearchAnchorRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // --- Add-product typeahead state ---
  const [addQuery, setAddQuery] = useState("");
  const debouncedAddQuery = useDebouncedValue(addQuery, 250);
  const [suggestions, setSuggestions] = useState<SubiektProduct[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [typeaheadOpen, setTypeaheadOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [addDraftMin, setAddDraftMin] = useState("");
  const [addDraftNote, setAddDraftNote] = useState("");
  const [addPending, startAdd] = useTransition();
  const listboxId = useId();

  // --- Reset on close (via callback, nie effect) ---
  const handleClose = useCallback(() => {
    setQuery("");
    setGroupFilter("all");
    setSortKey("symbol");
    setSortDir("asc");
    setEditingId(null);
    setSelected(new Set());
    setAddQuery("");
    setSuggestions([]);
    setSuggestError(null);
    setSuggestLoading(false);
    setTypeaheadOpen(false);
    setAddDraftMin("");
    setAddDraftNote("");
    onClose();
  }, [onClose]);

  // --- Group counts ---
  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of minStock) {
      const key = e.grtNazwa?.trim() || "Bez grupy";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl"));
  }, [minStock]);

  // --- Filtered + sorted ---
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = minStock.filter((e) => {
      const groupKey = e.grtNazwa?.trim() || "Bez grupy";
      if (groupFilter !== "all" && groupKey !== groupFilter) return false;
      if (!q) return true;
      const hay = [
        e.twSymbol ?? "",
        e.twNazwa,
        e.grtNazwa ?? "",
        e.note,
        String(e.minStockSzt),
        String(e.subiektTwId),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "symbol") {
        return (
          (a.twSymbol ?? "").localeCompare(b.twSymbol ?? "", "pl") * dir
        );
      }
      if (sortKey === "value") {
        return (a.minStockSzt - b.minStockSzt) * dir;
      }
      // date
      return (
        String(a.createdAt).localeCompare(String(b.createdAt)) * dir
      );
    });
  }, [minStock, query, groupFilter, sortKey, sortDir]);

  const hasActiveFilters = query.trim().length > 0 || groupFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setGroupFilter("all");
    searchRef.current?.focus();
  };

  // --- Summary stats ---
  const summary = useMemo(() => {
    if (minStock.length === 0) return null;
    const total = minStock.reduce((s, r) => s + r.minStockSzt, 0);
    const avg = Math.round(total / minStock.length);
    return { count: minStock.length, total, avg };
  }, [minStock]);

  // --- Edit handlers ---
  const draftCheck = assertMinStockSzt(draftValue);
  const draftOk = draftCheck.ok;
  const showDraftError = draftValue.trim() !== "" && !draftOk;

  const beginEdit = (row: ZdEstimateMinStockRow) => {
    setEditingId(row.subiektTwId);
    setDraftValue(String(row.minStockSzt));
    setDraftNote(row.note);
  };

  const cancelEdit = () => setEditingId(null);

  const save = (row: ZdEstimateMinStockRow) => {
    const check = assertMinStockSzt(draftValue);
    if (!check.ok) {
      onError(check.message);
      return;
    }
    start(async () => {
      const res = await actionUpsertZdEstimateMinStock({
        subiektTwId: row.subiektTwId,
        twSymbol: row.twSymbol,
        twNazwa: row.twNazwa,
        grtId: row.grtId,
        grtNazwa: row.grtNazwa,
        minStockSzt: check.value,
        note: draftNote,
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onMinStockChange(res.minStock);
      setEditingId(null);
    });
  };

  const remove = (subiektTwId: number) => {
    start(async () => {
      const res = await actionDeleteZdEstimateMinStock(subiektTwId);
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onMinStockChange(res.minStock);
      if (editingId === subiektTwId) setEditingId(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(subiektTwId);
        return next;
      });
    });
  };

  // --- Batch delete ---
  const batchDelete = () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    start(async () => {
      for (const id of ids) {
        const res = await actionDeleteZdEstimateMinStock(id);
        if (!res.ok) {
          onError(res.message);
          return;
        }
        onMinStockChange(res.minStock);
      }
      setSelected(new Set());
      if (editingId && ids.includes(editingId)) setEditingId(null);
    });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered) next.add(r.subiektTwId);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // --- Add-product typeahead ---
  const trimmedAddQuery = debouncedAddQuery.trim();
  const addSearchField = inferProductZdLookupSearchField(trimmedAddQuery);
  const addSearchActive =
    open &&
    trimmedAddQuery.length >= minProductSearchLength(addSearchField);

  const visibleSuggestions = useMemo(
    () => (addSearchActive ? suggestions : []),
    [addSearchActive, suggestions]
  );
  const visibleSuggestError = addSearchActive ? suggestError : null;
  const visibleSuggestLoading = addSearchActive && suggestLoading;

  useEffect(() => {
    if (!addSearchActive) return;
    let cancelled = false;
    void (async () => {
      setSuggestLoading(true);
      setSuggestError(null);
      const result = await actionSubiektSuggestProducts(
        trimmedAddQuery,
        addSearchField
      );
      if (cancelled) return;
      setSuggestLoading(false);
      if (!result.ok) {
        setSuggestions([]);
        setSuggestError(
          result.feedback?.message ?? "Nie udało się wyszukać produktu."
        );
        return;
      }
      setSuggestions(result.items);
    })();
    return () => {
      cancelled = true;
      setSuggestLoading(false);
    };
  }, [addSearchActive, trimmedAddQuery, addSearchField]);

  const suggestionsKey = visibleSuggestions.map((p) => p.tw_Id).join("\0");
  const [appliedSuggestionsKey, setAppliedSuggestionsKey] =
    useState(suggestionsKey);
  if (suggestionsKey !== appliedSuggestionsKey) {
    setAppliedSuggestionsKey(suggestionsKey);
    setHighlightedIndex(0);
  }

  // Close typeahead on outside click
  useEffect(() => {
    if (!typeaheadOpen) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (addSearchAnchorRef.current?.contains(target)) return;
      const listbox = document.getElementById(listboxId);
      if (listbox?.contains(target)) return;
      setTypeaheadOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listboxId, typeaheadOpen]);

  const existingTwIds = useMemo(
    () => new Set(minStock.map((r) => r.subiektTwId)),
    [minStock]
  );

  const addDraftCheck = assertMinStockSzt(addDraftMin);
  const addDraftOk = addDraftCheck.ok;
  const showAddDraftError = addDraftMin.trim() !== "" && !addDraftOk;

  const addProduct = (product: SubiektProduct) => {
    const check = assertMinStockSzt(addDraftMin);
    if (!check.ok) {
      onError(check.message);
      return;
    }
    startAdd(async () => {
      const res = await actionUpsertZdEstimateMinStock({
        subiektTwId: product.tw_Id,
        twSymbol: subiektFieldText(product.tw_Symbol) || null,
        twNazwa: subiektFieldText(product.tw_Nazwa) || "",
        grtId: product.tw_IdGrupa ?? null,
        grtNazwa: subiektFieldText(product.grt_Nazwa) || null,
        minStockSzt: check.value,
        note: addDraftNote.trim(),
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onMinStockChange(res.minStock);
      setAddQuery("");
      setAddDraftMin("");
      setAddDraftNote("");
      setSuggestions([]);
      setTypeaheadOpen(false);
      addInputRef.current?.focus();
    });
  };

  const handleAddKeydown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!typeaheadOpen || visibleSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % visibleSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        i === 0 ? visibleSuggestions.length - 1 : i - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const product = visibleSuggestions[highlightedIndex];
      if (product) addProduct(product);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setTypeaheadOpen(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={ZD_ESTIMATE_UI.minStockModalTitle}
      titleHint={ZD_ESTIMATE_UI.minStockModalHint}
      size="xl"
      bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending || addPending ? "Zapisuję…" : null}
      disableBackdropClose={pending || addPending}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">
            {minStock.length === 0
              ? "Brak zapisanych minimum stanów"
              : hasActiveFilters
                ? `Widoczne ${filtered.length} z ${minStock.length}`
                : `${minStock.length} ${ZD_ESTIMATE_UI.minStockSummaryProducts}`}
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
      {/* Intro */}
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <div className="flex gap-3">
          <IconPackageCheck
            size={18}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-slate-500"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {ZD_ESTIMATE_UI.minStockIntroTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {ZD_ESTIMATE_UI.minStockIntroBody}
            </p>
          </div>
        </div>
      </div>

      {/* Add product section */}
      <div className="rounded-lg border border-indigo-100/80 bg-indigo-50/30 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <IconPlusCircle
            size={15}
            strokeWidth={2.25}
            className="shrink-0 text-indigo-600"
            aria-hidden
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900/80">
            {ZD_ESTIMATE_UI.minStockAddSectionTitle}
          </p>
        </div>
        <div
          ref={addSearchAnchorRef}
          className="relative mt-2.5"
        >
          <label
            htmlFor={searchId}
            className="block text-xs font-medium text-slate-600"
          >
            <span className="sr-only">{ZD_ESTIMATE_UI.minStockAddPlaceholder}</span>
          </label>
          <div className="relative">
            <IconSearch
              size={15}
              strokeWidth={2.25}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              ref={addInputRef}
              id={searchId}
              value={addQuery}
              onChange={(e) => {
                setAddQuery(e.target.value);
                setTypeaheadOpen(true);
              }}
              onFocus={() => setTypeaheadOpen(true)}
              onKeyDown={handleAddKeydown}
              placeholder={ZD_ESTIMATE_UI.minStockAddPlaceholder}
              className="pl-8 pr-9"
              autoComplete="off"
              aria-controls={listboxId}
              aria-expanded={typeaheadOpen}
            />
            {addQuery ? (
              <button
                type="button"
                aria-label="Wyczyść"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => {
                  setAddQuery("");
                  setSuggestions([]);
                  addInputRef.current?.focus();
                }}
              >
                <IconX size={14} strokeWidth={2.25} />
              </button>
            ) : null}
          </div>
          <TypeaheadDropdown
            open={typeaheadOpen && (visibleSuggestLoading || visibleSuggestions.length > 0)}
            listboxId={listboxId}
            emptyMessage={
              visibleSuggestLoading
                ? "Szukam…"
                : addSearchActive
                  ? ZD_ESTIMATE_UI.minStockAddNoResults
                  : undefined
            }
            className="z-50"
          >
            {visibleSuggestions.map((product, idx) => {
              const opt = formatSubiektProductOption(product);
              const already = existingTwIds.has(product.tw_Id);
              return (
                <TypeaheadOption
                  key={product.tw_Id}
                  highlighted={idx === highlightedIndex}
                  onHighlight={() => setHighlightedIndex(idx)}
                  onSelect={() => {
                    if (!already) addProduct(product);
                  }}
                  title={opt.title}
                  subtitle={
                    already
                      ? `${opt.subtitle} · ${ZD_ESTIMATE_UI.minStockAddAlreadyConfigured}`
                      : opt.subtitle
                  }
                  badge={already ? "na liście" : opt.badge}
                />
              );
            })}
          </TypeaheadDropdown>
        </div>

        {/* Add form: min + note + button */}
        {addSearchActive || visibleSuggestions.length > 0 ? (
          <div className="mt-2.5 grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
            <label className="block text-xs font-medium text-slate-600">
              {ZD_ESTIMATE_UI.minStockAddMinLabel}
              <Input
                type="number"
                min={0}
                max={MIN_STOCK_MAX}
                step={1}
                className="mt-1 tabular-nums"
                value={addDraftMin}
                onChange={(e) => setAddDraftMin(e.target.value)}
                placeholder="np. 10"
                aria-invalid={showAddDraftError || undefined}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              {ZD_ESTIMATE_UI.minStockAddNoteLabel}
              <Input
                className="mt-1"
                value={addDraftNote}
                maxLength={500}
                onChange={(e) => setAddDraftNote(e.target.value)}
                placeholder="Dlaczego to minimum…"
              />
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                disabled={
                  addPending ||
                  !addDraftOk ||
                  visibleSuggestions.length === 0
                }
                onClick={() => {
                  const product = suggestions[highlightedIndex];
                  if (product) addProduct(product);
                }}
                className="h-9"
              >
                {addPending ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Spinner className="size-3.5" /> Dodaję…
                  </span>
                ) : (
                  ZD_ESTIMATE_UI.minStockAddCta
                )}
              </Button>
            </div>
          </div>
        ) : null}
        {showAddDraftError ? (
          <p className={cn(panelTypography.caption, "mt-1.5 text-amber-800")}>
            {addDraftCheck.ok ? null : addDraftCheck.message}
          </p>
        ) : (
          <p className={cn(panelTypography.caption, "mt-1.5")}>
            {ZD_ESTIMATE_UI.minStockAddHint}
          </p>
        )}
        {visibleSuggestError ? (
          <p className={cn(panelTypography.caption, "mt-1.5 text-amber-800")}>
            {visibleSuggestError}
          </p>
        ) : null}
      </div>

      {/* Summary stats */}
      {summary ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200/70 bg-white px-4 py-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums text-slate-900">
              {summary.count}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              {ZD_ESTIMATE_UI.minStockSummaryProducts}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums text-emerald-700">
              {summary.total}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              {ZD_ESTIMATE_UI.minStockSummaryPieces}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tabular-nums text-slate-700">
              {summary.avg}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              {ZD_ESTIMATE_UI.minStockSummaryAvg}
            </span>
          </div>
        </div>
      ) : null}

      {/* Search + filters */}
      <div className="space-y-2.5">
        <label htmlFor={`search-${searchId}`} className="block text-xs font-medium text-slate-600">
          Szukaj na liście
          <div className="relative mt-1">
            <IconSearch
              size={15}
              strokeWidth={2.25}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              ref={searchRef}
              id={`search-${searchId}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Symbol, nazwa, grupa, notatka…"
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

        {groupCounts.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <GroupChip
              label="Wszystkie"
              count={minStock.length}
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

      {/* Sort + batch actions bar */}
      {minStock.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Sortuj:
            </span>
            <SortButton
              label={ZD_ESTIMATE_UI.minStockSortSymbol}
              active={sortKey === "symbol"}
              direction={sortDir}
              onClick={() => toggleSort("symbol")}
            />
            <SortButton
              label={ZD_ESTIMATE_UI.minStockSortValue}
              active={sortKey === "value"}
              direction={sortDir}
              onClick={() => toggleSort("value")}
            />
            <SortButton
              label={ZD_ESTIMATE_UI.minStockSortDate}
              active={sortKey === "date"}
              direction={sortDir}
              onClick={() => toggleSort("date")}
            />
          </div>
          {selected.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-600">
                Zaznaczono {selected.size}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={clearSelection}
                disabled={pending}
              >
                {ZD_ESTIMATE_UI.minStockBatchClear}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={batchDelete}
                disabled={pending}
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                <span className="inline-flex items-center gap-1.5">
                  <IconTrash2 size={13} strokeWidth={2.25} />
                  {ZD_ESTIMATE_UI.minStockBatchDeleteCta}
                </span>
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              onClick={selectAllVisible}
              disabled={filtered.length === 0}
            >
              {ZD_ESTIMATE_UI.minStockBatchSelectAll}
            </button>
          )}
        </div>
      ) : null}

      {/* List */}
      {minStock.length === 0 ? (
        <EmptyState
          icon={<IconPackageCheck size={28} strokeWidth={1.75} />}
          title={ZD_ESTIMATE_UI.minStockEmptyTitle}
          description={ZD_ESTIMATE_UI.minStockEmptyBody}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            {ZD_ESTIMATE_UI.minStockNoFilterResults}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            {ZD_ESTIMATE_UI.minStockNoFilterHint}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={clearFilters}
            >
              Wyczyść filtry
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="max-h-[min(52vh,28rem)] space-y-2.5 overflow-y-auto overscroll-contain pr-0.5">
          {filtered.map((row) => (
            <MinStockRow
              key={row.subiektTwId}
              row={row}
              editing={editingId === row.subiektTwId}
              selected={selected.has(row.subiektTwId)}
              pending={pending}
              draftValue={draftValue}
              draftNote={draftNote}
              showDraftError={showDraftError}
              draftCheck={draftCheck}
              onToggleSelect={() => toggleSelect(row.subiektTwId)}
              onBeginEdit={() => beginEdit(row)}
              onCancelEdit={cancelEdit}
              onDraftValueChange={setDraftValue}
              onDraftNoteChange={setDraftNote}
              onSave={() => save(row)}
              onRemove={() => remove(row.subiektTwId)}
            />
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
