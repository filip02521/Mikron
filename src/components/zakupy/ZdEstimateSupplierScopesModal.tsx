"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  actionDeleteZdEstimateSupplierScope,
  actionListZdEstimateSupplierScopes,
  actionSearchZdEstimateCechy,
  actionSearchZdEstimateGroups,
  actionSetPrimaryZdEstimateSupplierScope,
  actionUpsertZdEstimateSupplierScope,
  type ZdEstimateCechaOption,
  type ZdEstimateGroupOption,
  type ZdEstimateSupplierOption,
} from "@/app/actions/zd-estimate";
import type { ZdEstimateSupplierScopeRow } from "@/lib/data/zd-estimate-supplier-scopes";
import { actionLoadZdScopeOrder, actionStartZdScopeIndexSync } from "@/app/actions/zd-scope-order";
import type { ZdSharedScope, ZdSharedScopeStats } from "@/lib/data/zd-scope-order";
import type { ZdScopeSuggestion, ZdSupplierScopeInsight } from "@/lib/orders/zd-scope-suggest";
import { IconPackage, IconPlus, IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import {
  ZD_ESTIMATE_UI,
  zdEstimatePlCountWord as plWord,
  zdEstimateSupplierScopesFooterCount,
} from "@/lib/orders/zd-estimate-ui-copy";
import {
  zdEstimateScopeCoverage,
  type ZdEstimateScopeCoverage,
} from "@/lib/orders/zd-estimate-scope-coverage";
import { askConfirm } from "@/components/ui/ConfirmHost";
import { ZdSharedScopeSplitter } from "@/components/zakupy/ZdSharedScopeSplitter";

function supplierLabel(
  suppliers: readonly ZdEstimateSupplierOption[],
  supplierId: string
): string {
  const hit = suppliers.find((s) => s.id === supplierId);
  return hit?.name?.trim() || supplierId;
}

const sharedKeyOf = (mode: ZdEstimateRunMode, id: number) => `${mode}:${id}`;

type Tab = "suppliers" | "shared" | "today";

type ScopeDraft = {
  supplierId: string;
  mode: ZdEstimateRunMode;
  query: string;
  groupHits: ZdEstimateGroupOption[];
  cechaHits: ZdEstimateCechaOption[];
  pickedGroup: ZdEstimateGroupOption | null;
  pickedCecha: ZdEstimateCechaOption | null;
};

const emptyDraft = (): ScopeDraft => ({
  supplierId: "",
  mode: "grupa",
  query: "",
  groupHits: [],
  cechaHits: [],
  pickedGroup: null,
  pickedCecha: null,
});

function ModeBadge({ mode }: { mode: ZdEstimateRunMode }) {
  return (
    <Badge variant={mode === "cecha" ? "info" : "default"}>
      {mode === "cecha" ? "Cecha" : "Grupa"}
    </Badge>
  );
}

function ScopeEditorForm({
  draft,
  configured,
  searching,
  disabled,
  onChange,
  onSearch,
}: {
  draft: ScopeDraft;
  configured: boolean;
  searching: boolean;
  disabled: boolean;
  onChange: (patch: Partial<ScopeDraft>) => void;
  onSearch: () => void;
}) {
  const searchFieldId = useId();
  const hits = draft.mode === "grupa" ? draft.groupHits : draft.cechaHits;
  const pickedId = draft.mode === "grupa" ? draft.pickedGroup?.grt_Id : draft.pickedCecha?.ctw_Id;
  const pickedLabel = draft.mode === "grupa" ? draft.pickedGroup?.grt_Nazwa : draft.pickedCecha?.ctw_Nazwa;
  const items =
    draft.mode === "grupa"
      ? draft.groupHits.map((g) => ({ id: g.grt_Id, name: g.grt_Nazwa, pick: () => onChange({ pickedGroup: g }) }))
      : draft.cechaHits.map((c) => ({ id: c.ctw_Id, name: c.ctw_Nazwa, pick: () => onChange({ pickedCecha: c }) }));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <SegmentedControl
          ariaLabel="Rodzaj zakresu"
          value={draft.mode}
          onChange={(v) =>
            onChange({ mode: v, pickedGroup: null, pickedCecha: null, groupHits: [], cechaHits: [] })
          }
          options={[
            { value: "grupa", label: "Grupa" },
            { value: "cecha", label: "Cecha" },
          ]}
          className="h-10 shrink-0 self-start sm:self-auto"
        />
        <div className="flex min-w-0 flex-1 gap-2">
          <label htmlFor={searchFieldId} className="relative min-w-0 flex-1">
            <span className="sr-only">{draft.mode === "grupa" ? "Grupa Subiekta" : "Cecha Subiekta"}</span>
            <IconSearch
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              id={searchFieldId}
              value={draft.query}
              onChange={(e) => onChange({ query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSearch();
                }
              }}
              placeholder={
                draft.mode === "grupa"
                  ? ZD_ESTIMATE_UI.supplierScopesSearchGroupPlaceholder
                  : ZD_ESTIMATE_UI.supplierScopesSearchCechaPlaceholder
              }
              disabled={!configured || disabled}
              className="h-10 pl-8"
              autoComplete="off"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || searching || !configured || !draft.query.trim()}
            onClick={onSearch}
            className="h-10 shrink-0"
          >
            {searching ? <Spinner size="sm" /> : null}
            {ZD_ESTIMATE_UI.supplierScopesSearchCta}
          </Button>
        </div>
      </div>

      {hits.length > 0 ? (
        <ul
          className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-white"
          role="listbox"
          aria-label={draft.mode === "grupa" ? "Wyniki grup" : "Wyniki cech"}
        >
          {items.map((it) => {
            const active = pickedId === it.id;
            return (
              <li key={it.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-150",
                    active ? "bg-indigo-50 text-indigo-900" : "text-slate-800 hover:bg-slate-50"
                  )}
                  onClick={it.pick}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{it.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">#{it.id}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {pickedLabel ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>{ZD_ESTIMATE_UI.supplierScopesPickedPrefix}:</span>
          <ModeBadge mode={draft.mode} />
          <span className="min-w-0 truncate font-medium text-slate-900">{pickedLabel}</span>
          {pickedId != null ? <span className="text-xs tabular-nums text-slate-500">#{pickedId}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

function SuggestionChip({
  suggestion: s,
  disabled,
  onPick,
  actionLabel,
}: {
  suggestion: ZdScopeSuggestion;
  disabled?: boolean;
  onPick: (s: ZdScopeSuggestion) => void;
  actionLabel: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(s)}
      title={`${s.supplierHits} towarów dostawcy z ZD w tym zakresie · ${Math.round(
        s.purity * 100
      )}% kupowanych z niego towarów to ten dostawca · ${s.productCount} towarów w Subiekcie`}
      className="group inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-50"
    >
      <ModeBadge mode={s.mode} />
      <span className="min-w-0 truncate font-medium text-slate-900">{s.name}</span>
      <span className="shrink-0 tabular-nums text-slate-500">+{s.newHits} z ZD</span>
      {s.otherSupplierCount > 0 ? (
        <span className="shrink-0 tabular-nums text-amber-800" title="Udział tego dostawcy w zakresie">
          {Math.round(s.purity * 100)}%
        </span>
      ) : null}
      <span className="shrink-0 font-medium text-indigo-700 group-hover:text-indigo-800">{actionLabel}</span>
    </button>
  );
}

function CoverageMeter({ insight }: { insight: ZdSupplierScopeInsight | undefined }) {
  if (!insight || insight.totalProducts === 0) {
    return <span className="text-xs text-slate-500">brak historii ZD</span>;
  }
  const pct = Math.round((insight.coveredProducts / insight.totalProducts) * 100);
  const tone = pct >= 90 ? "bg-emerald-600" : pct >= 60 ? "bg-amber-500" : "bg-red-600";
  return (
    <span
      className="inline-flex items-center gap-2 text-xs tabular-nums text-slate-600"
      title="Ile towarów zamawianych u tego dostawcy (historia ZD) obejmują jego zakresy"
    >
      <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </span>
      {insight.coveredProducts}/{insight.totalProducts} z ZD
    </span>
  );
}

function SharedProgress({ stats }: { stats: ZdSharedScopeStats | undefined }) {
  if (!stats) return null;
  if (stats.products === 0) return <span className="text-xs text-slate-500">brak towarów z ZD</span>;
  const pct = Math.round((stats.assigned / stats.products) * 100);
  return (
    <span className="inline-flex items-center gap-2 text-xs tabular-nums text-slate-500">
      <span className="h-1 w-12 overflow-hidden rounded-full bg-slate-200/80" aria-hidden>
        <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
      </span>
      {stats.assigned}/{stats.products}
    </span>
  );
}

export function ZdEstimateSupplierScopesModal({
  open,
  onClose,
  suppliers,
  configured,
  onError,
  todayCoverage,
  onMappedSupplierIdsChange,
  onScopesChange,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: readonly ZdEstimateSupplierOption[];
  configured: boolean;
  onError: (message: string) => void;
  todayCoverage?: ZdEstimateScopeCoverage | null;
  /** @deprecated Prefer onScopesChange — kept for coverage-only callers. */
  onMappedSupplierIdsChange?: (supplierIds: string[]) => void;
  onScopesChange?: (
    scopes: ZdEstimateSupplierScopeRow[],
    meta: { reason: "load" | "mutate" }
  ) => void;
}) {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [searching, startSearch] = useTransition();
  const [, startOrder] = useTransition();
  const [loading, setLoading] = useState(false);
  const [scopes, setScopes] = useState<ZdEstimateSupplierScopeRow[]>([]);
  // Najnowsza lista dla handlerów async — callbacki rodzica wołamy poza updaterem
  // setState (updater działa w renderze → setState rodzica w trakcie renderu).
  const scopesRef = useRef(scopes);
  const commitScopes = (next: ZdEstimateSupplierScopeRow[]) => {
    scopesRef.current = next;
    setScopes(next);
    onScopesChange?.(next, { reason: "mutate" });
    onMappedSupplierIdsChange?.([...new Set(next.map((s) => s.supplierId))]);
  };
  const [order, setOrder] = useState<{
    indexSyncedAt: string | null;
    insights: Map<string, ZdSupplierScopeInsight>;
    sharedScopes: ZdSharedScope[];
    sharedStats: Map<string, ZdSharedScopeStats>;
    indexSyncRunning: boolean;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("suppliers");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ScopeDraft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<ScopeDraft>(emptyDraft);
  const [sharedKey, setSharedKey] = useState<string | null>(null);
  const [splitDirty, setSplitDirty] = useState(0);
  /** Niezapisane zmiany zakresu, który po odświeżeniu przestał być wspólny. */
  const [lostSplitEdits, setLostSplitEdits] = useState(0);
  // Stan z chwili odpowiedzi serwera, nie z domknięcia — po zapisie licznik zdąży spaść do 0.
  const splitDirtyRef = useRef(0);
  const sharedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    splitDirtyRef.current = splitDirty;
    sharedKeyRef.current = sharedKey;
  }, [splitDirty, sharedKey]);

  const applyOrder = (res: Extract<Awaited<ReturnType<typeof actionLoadZdScopeOrder>>, { ok: true }>) => {
    // Domyślny wspólny zakres wybieramy raz, jawnie — potem nie zmienia się sam.
    const first = res.sharedScopes[0];
    if (first) setSharedKey((prev) => prev ?? sharedKeyOf(first.mode, first.scopeId));
    setOrder({
      indexSyncedAt: res.indexSyncedAt,
      insights: new Map(res.insights.map((i) => [i.supplierId, i])),
      sharedScopes: res.sharedScopes,
      sharedStats: new Map(res.sharedScopeStats.map((s) => [sharedKeyOf(s.mode, s.scopeId), s])),
      indexSyncRunning: res.indexSyncRunning,
    });
  };

  // Podpowiedzi i postęp odświeżamy w tle — bez nakładki „Zapisuję…”.
  const reloadOrder = () => {
    startOrder(async () => {
      const res = await actionLoadZdScopeOrder();
      if (!res.ok) {
        onError(res.message);
        return;
      }
      const key = sharedKeyRef.current;
      if (key && !res.sharedScopes.some((sh) => sharedKeyOf(sh.mode, sh.scopeId) === key)) {
        setLostSplitEdits(splitDirtyRef.current);
      }
      applyOrder(res);
    });
  };

  const resetUi = () => {
    setQuery("");
    setEditingId(null);
    setEditDraft(emptyDraft());
    setAdding(false);
    setAddDraft(emptyDraft());
    setSharedKey(null);
    setSplitDirty(0);
    setLostSplitEdits(0);
  };

  /** Niezapisane rozdzielanie ginie przy zmianie zakresu, zakładki i zamknięciu. */
  const confirmDiscardSplit = async () => {
    if (splitDirty === 0) return true;
    const ok = await askConfirm({
      title: "Porzucić niezapisane przypisania?",
      message: `${splitDirty} ${plWord(splitDirty, "zmiana", "zmiany", "zmian")} w rozdzielaniu towarów nie ${
        splitDirty === 1 ? "została zapisana" : "zostały zapisane"
      }.`,
      confirmLabel: "Porzuć",
      danger: true,
    });
    if (ok) setSplitDirty(0);
    return ok;
  };

  // Esc w oknie potwierdzenia trafia też do tego modala — bez blokady pytanie wraca od nowa.
  const closingRef = useRef(false);
  const handleClose = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const ok = await confirmDiscardSplit().finally(() => {
      closingRef.current = false;
    });
    if (!ok) return;
    resetUi();
    setTab("suppliers");
    setLoading(false);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      resetUi();
      setTab("suppliers");
      setLoading(true);
      start(async () => {
        const [res, orderRes] = await Promise.all([
          actionListZdEstimateSupplierScopes(),
          actionLoadZdScopeOrder(),
        ]);
        if (cancelled) return;
        setLoading(false);
        if (!res.ok) {
          onError(res.message);
          return;
        }
        scopesRef.current = res.scopes;
        setScopes(res.scopes);
        onScopesChange?.(res.scopes, { reason: "load" });
        onMappedSupplierIdsChange?.([...new Set(res.scopes.map((s) => s.supplierId))]);
        if (orderRes.ok) {
          applyOrder(orderRes);
        } else {
          // Podpowiedzi opcjonalne — mapowania działają bez nich.
          setOrder(null);
        }
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only
  }, [open]);

  const scopesBySupplier = useMemo(() => {
    const map = new Map<string, ZdEstimateSupplierScopeRow[]>();
    for (const row of scopes) {
      const list = map.get(row.supplierId) ?? [];
      list.push(row);
      map.set(row.supplierId, list);
    }
    return map;
  }, [scopes]);

  const mappedIds = useMemo(() => new Set(scopesBySupplier.keys()), [scopesBySupplier]);
  const unmappedSuppliers = useMemo(() => suppliers.filter((s) => !mappedIds.has(s.id)), [suppliers, mappedIds]);
  const mappedSuppliers = useMemo(() => suppliers.filter((s) => mappedIds.has(s.id)), [suppliers, mappedIds]);

  const filterText = query.trim().toLowerCase();
  const hasActiveFilter = filterText.length > 0;

  const supplierCards = useMemo(() => {
    return [...scopesBySupplier.keys()]
      .map((supplierId) => ({
        supplierId,
        name: supplierLabel(suppliers, supplierId),
        rows: scopesBySupplier.get(supplierId) ?? [],
      }))
      .filter(
        (c) =>
          !filterText ||
          c.name.toLowerCase().includes(filterText) ||
          c.rows.some(
            (s) =>
              s.label.toLowerCase().includes(filterText) ||
              String(s.grupaId ?? "").includes(filterText) ||
              String(s.cechaId ?? "").includes(filterText)
          )
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [scopesBySupplier, suppliers, filterText]);

  const liveCoverage = useMemo(
    () => (todayCoverage ? zdEstimateScopeCoverage(todayCoverage.today, mappedIds) : null),
    [todayCoverage, mappedIds]
  );
  const allUnmapped = liveCoverage?.unmapped ?? [];
  const liveUnmapped = allUnmapped.filter(
    (s) => !filterText || s.supplierName.toLowerCase().includes(filterText)
  );
  const allShared = useMemo(() => order?.sharedScopes ?? [], [order]);
  const sharedScopes = allShared.filter(
    (sh) =>
      !filterText ||
      sh.label.toLowerCase().includes(filterText) ||
      sh.supplierIds.some((sid) => supplierLabel(suppliers, sid).toLowerCase().includes(filterText))
  );
  const sharedKeys = useMemo(
    () => new Set(allShared.map((sh) => sharedKeyOf(sh.mode, sh.scopeId))),
    [allShared]
  );
  // Aktywny zakres jest zawsze jawnie wybrany (sharedKey) — domyślny z przefiltrowanej
  // listy albo po odświeżeniu zmieniałby się sam, a remount panelu gubiłby zmiany bez pytania.
  const activeShared = allShared.find((sh) => sharedKeyOf(sh.mode, sh.scopeId) === sharedKey) ?? null;
  const sharedGone = sharedKey != null && activeShared == null && order != null;
  const activeSharedKey = activeShared ? sharedKeyOf(activeShared.mode, activeShared.scopeId) : null;

  const insightFor = (supplierId: string) => order?.insights.get(supplierId);

  const switchTab = async (next: Tab) => {
    if (next === tab) return;
    if (tab === "shared" && !(await confirmDiscardSplit())) return;
    // Brak wyboru albo zakres, który przestał być wspólny — wracamy do pierwszego na liście.
    if (next === "shared" && (sharedKey == null || sharedGone)) {
      setSharedKey(allShared[0] ? sharedKeyOf(allShared[0].mode, allShared[0].scopeId) : null);
      setLostSplitEdits(0);
    }
    setTab(next);
  };

  const openShared = async (key: string) => {
    if (key === activeSharedKey && tab === "shared") return;
    if (!(await confirmDiscardSplit())) return;
    setLostSplitEdits(0);
    setSharedKey(key);
    setTab("shared");
  };

  const beginEdit = (row: ZdEstimateSupplierScopeRow) => {
    setAdding(false);
    setAddDraft(emptyDraft());
    setEditingId(row.id);
    setEditDraft({ ...emptyDraft(), supplierId: row.supplierId, mode: row.mode, query: row.label });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyDraft());
  };

  const beginAdd = async (supplierId?: string) => {
    if (tab !== "suppliers") {
      if (tab === "shared" && !(await confirmDiscardSplit())) return;
      setTab("suppliers");
    }
    setEditingId(null);
    setEditDraft(emptyDraft());
    setAdding(true);
    setAddDraft({ ...emptyDraft(), ...(supplierId ? { supplierId } : {}) });
  };

  const cancelAdd = () => {
    setAdding(false);
    setAddDraft(emptyDraft());
  };

  const searchDraft = (
    draft: ScopeDraft,
    setDraft: (d: ScopeDraft | ((prev: ScopeDraft) => ScopeDraft)) => void
  ) => {
    const q = draft.query.trim();
    if (!q || !configured) return;
    startSearch(async () => {
      if (draft.mode === "grupa") {
        const res = await actionSearchZdEstimateGroups(q);
        if (!res.ok) {
          onError(res.message);
          return;
        }
        setDraft((prev) => ({ ...prev, groupHits: res.groups, cechaHits: [] }));
      } else {
        const res = await actionSearchZdEstimateCechy(q);
        if (!res.ok) {
          onError(res.message);
          return;
        }
        setDraft((prev) => ({ ...prev, cechaHits: res.cechy, groupHits: [] }));
      }
    });
  };

  /** Zapis zakresu: `scopeId` — zmiana istniejącego, bez — dodanie kolejnego. */
  const persistScope = (
    input: { supplierId: string; scopeId?: string; mode: ZdEstimateRunMode; id: number; label: string },
    onDone?: () => void
  ) => {
    start(async () => {
      const res = await actionUpsertZdEstimateSupplierScope({
        scopeId: input.scopeId ?? null,
        supplierId: input.supplierId,
        mode: input.mode,
        ...(input.mode === "grupa" ? { grupaId: input.id } : { cechaId: input.id }),
        label: input.label,
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      const rest = scopesRef.current.filter((s) => s.id !== res.scope.id);
      commitScopes([...rest, res.scope]);
      onDone?.();
      reloadOrder();
    });
  };

  /**
   * Szybkie akcje z podpowiedzi (Przypisz / Dodaj / Zamień) zmieniają mapowanie
   * całego działu jednym kliknięciem — zawsze z potwierdzeniem.
   */
  const confirmSuggestion = async (
    action: "assign" | "add" | "replace",
    supplierId: string,
    sg: ZdScopeSuggestion,
    scopeId?: string
  ) => {
    const name = supplierLabel(suppliers, supplierId);
    const scopeText = `${sg.mode === "cecha" ? "cechę" : "grupę"} „${sg.name}”`;
    const text =
      action === "replace"
        ? `Zamienić zakres dostawcy ${name} na ${scopeText}?`
        : action === "add"
          ? `Dodać ${scopeText} jako kolejny zakres dostawcy ${name}?`
          : `Przypisać ${scopeText} dostawcy ${name}?`;
    if (
      !(await askConfirm({
        title: text,
        message: `Obejmuje ${sg.supplierHits} towarów z ZD tego dostawcy. Zmiana obowiązuje cały dział.`,
        confirmLabel: action === "replace" ? "Zamień" : action === "add" ? "Dodaj" : "Przypisz",
      }))
    ) {
      return;
    }
    persistScope({ supplierId, scopeId, mode: sg.mode, id: sg.id, label: sg.name });
  };

  const saveDraft = (draft: ScopeDraft, scopeId: string | undefined, onDone: () => void) => {
    const supplierId = draft.supplierId.trim();
    if (!supplierId) {
      onError("Wybierz dostawcę.");
      return;
    }
    const picked =
      draft.mode === "grupa"
        ? draft.pickedGroup && { id: draft.pickedGroup.grt_Id, label: draft.pickedGroup.grt_Nazwa }
        : draft.pickedCecha && { id: draft.pickedCecha.ctw_Id, label: draft.pickedCecha.ctw_Nazwa };
    if (!picked) {
      onError(draft.mode === "grupa" ? "Wybierz grupę z wyników wyszukiwania." : "Wybierz cechę z wyników wyszukiwania.");
      return;
    }
    persistScope({ supplierId, scopeId, mode: draft.mode, ...picked }, onDone);
  };

  const removeScope = async (row: ZdEstimateSupplierScopeRow, supplierName: string) => {
    const isLast = (scopesBySupplier.get(row.supplierId) ?? []).length <= 1;
    if (
      !(await askConfirm({
        title: isLast ? "Usunąć jedyny zakres?" : "Usunąć zakres?",
        message: isLast
          ? `Zakres „${row.label}” dostawcy ${supplierName}. Jego towary znikną z Kreatora i panelu Braki.`
          : `Zakres „${row.label}” dostawcy ${supplierName}. Jego towary znikną z listy tego dostawcy.`,
        confirmLabel: "Usuń",
        danger: true,
      }))
    ) {
      return;
    }
    start(async () => {
      const res = await actionDeleteZdEstimateSupplierScope({ scopeId: row.id });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      commitScopes(scopesRef.current.filter((s) => s.id !== row.id));
      if (editingId === row.id) cancelEdit();
      reloadOrder();
    });
  };

  const makePrimary = (row: ZdEstimateSupplierScopeRow) => {
    start(async () => {
      const res = await actionSetPrimaryZdEstimateSupplierScope({ scopeId: row.id });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      commitScopes([...scopesRef.current.filter((s) => s.supplierId !== row.supplierId), ...res.scopes]);
    });
  };

  const startIndexSync = () => {
    startOrder(async () => {
      const res = await actionStartZdScopeIndexSync();
      if (!res.ok) {
        onError(res.message);
        return;
      }
      setOrder((prev) => (prev ? { ...prev, indexSyncRunning: true } : prev));
    });
  };

  const pickSuggestionIntoDraft = (s: ZdScopeSuggestion) => {
    setAddDraft((d) => ({
      ...d,
      mode: s.mode,
      query: s.name,
      groupHits: [],
      cechaHits: [],
      pickedGroup: s.mode === "grupa" ? ({ grt_Id: s.id, grt_Nazwa: s.name } as ZdEstimateGroupOption) : null,
      pickedCecha: s.mode === "cecha" ? ({ ctw_Id: s.id, ctw_Nazwa: s.name } as ZdEstimateCechaOption) : null,
    }));
  };

  const listLoading = loading && scopes.length === 0;
  const addSuggestions = addDraft.supplierId ? (insightFor(addDraft.supplierId)?.suggestions ?? []) : [];
  const showTodayTab = Boolean(todayCoverage);

  const tabOptions: { value: Tab; label: React.ReactNode }[] = [
    {
      value: "suppliers",
      label: (
        <>
          Dostawcy <span className="tabular-nums text-slate-500">{scopesBySupplier.size}</span>
        </>
      ),
    },
    {
      value: "shared",
      label: (
        <>
          Wspólne zakresy <span className="tabular-nums text-slate-500">{allShared.length}</span>
        </>
      ),
    },
    ...(showTodayTab
      ? [
          {
            value: "today" as const,
            label: (
              <>
                Dziś bez zakresu{" "}
                <span className={cn("tabular-nums", allUnmapped.length ? "text-amber-800" : "text-slate-500")}>
                  {allUnmapped.length}
                </span>
              </>
            ),
          },
        ]
      : []),
  ];

  const filterPlaceholder =
    tab === "shared" ? "Filtruj zakres lub dostawcę…" : tab === "today" ? "Filtruj dostawcę…" : ZD_ESTIMATE_UI.supplierScopesSearchPlaceholder;

  const indexStatus = order?.indexSyncRunning
    ? "Buduję indeks grup i cech z Subiekta (ok. 2 min)."
    : order?.indexSyncedAt
      ? `Indeks Subiekta z ${formatPlDate(order.indexSyncedAt)}.`
      : "Podpowiedzi wymagają indeksu grup i cech z Subiekta.";

  const footerCount = listLoading
    ? ZD_ESTIMATE_UI.supplierScopesLoading
    : tab === "suppliers" && hasActiveFilter
      ? `Widoczne ${supplierCards.length} z ${scopesBySupplier.size} dostawców`
      : scopes.length === 0
        ? ZD_ESTIMATE_UI.supplierScopesEmptyTitle
        : `${scopesBySupplier.size} dostawców · ${zdEstimateSupplierScopesFooterCount(scopes.length)}`;

  return (
    <ModalShell
      open={open}
      onClose={() => void handleClose()}
      title={ZD_ESTIMATE_UI.supplierScopesPanelTitle}
      titleHint={`${ZD_ESTIMATE_UI.supplierScopesPanelHint} ${ZD_ESTIMATE_UI.supplierScopesIntroBody}`}
      titleHintAriaLabel="O zakresach dostawców"
      size="full"
      className="h-[min(calc(100dvh-2rem),880px)]"
      bodyClassName="flex flex-col overflow-hidden"
      loadingMessage={pending && !loading ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>{footerCount}</span>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <span>{indexStatus}</span>
            {order?.indexSyncRunning ? (
              <button
                type="button"
                className="font-medium text-indigo-700 underline-offset-4 hover:underline"
                onClick={reloadOrder}
              >
                Sprawdź
              </button>
            ) : (
              <button
                type="button"
                className="font-medium text-indigo-700 underline-offset-4 hover:underline disabled:opacity-50"
                disabled={!configured}
                onClick={startIndexSync}
              >
                {order?.indexSyncedAt ? "Odśwież teraz" : "Zbuduj teraz"}
              </button>
            )}
          </p>
          <Button type="button" variant="secondary" onClick={() => void handleClose()} className="self-end sm:self-auto">
            {ZD_ESTIMATE_UI.supplierScopesCloseCta}
          </Button>
        </div>
      }
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          ariaLabel="Widok zakresów"
          value={tab}
          onChange={(v) => void switchTab(v)}
          options={tabOptions}
        />
        <div className="flex min-w-0 items-center gap-2 lg:w-[28rem]">
          <label htmlFor={searchId} className="relative min-w-0 flex-1">
            <span className="sr-only">Filtruj</span>
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder={filterPlaceholder}
              className="h-9 pl-8 pr-8"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                aria-label="Wyczyść filtr"
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
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || suppliers.length === 0}
            title={suppliers.length === 0 ? ZD_ESTIMATE_UI.supplierScopesAllMappedTitle : undefined}
            onClick={() => void beginAdd()}
            className="h-9 shrink-0"
          >
            <IconPlus size={14} strokeWidth={2} aria-hidden />
            {ZD_ESTIMATE_UI.supplierScopesAddCta}
          </Button>
        </div>
      </div>

      {listLoading ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 py-12"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <BrandLoader size="md" />
          <p className="text-sm text-slate-500">{ZD_ESTIMATE_UI.supplierScopesLoading}</p>
        </div>
      ) : tab === "shared" ? (
        allShared.length === 0 ? (
          <div className="flex-1 overflow-y-auto">
            <EmptyState
              title="Brak wspólnych zakresów"
              description="Gdy ta sama grupa lub cecha jest przypisana kilku dostawcom, tutaj rozdzielisz jej towary między nich."
              icon={<IconPackage size={28} strokeWidth={1.75} />}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:overflow-hidden">
            <nav
              aria-label="Wspólne zakresy"
              className="border-b border-slate-100 bg-slate-50/60 p-2 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r"
            >
              {sharedScopes.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-500">Brak zakresów pasujących do filtra.</p>
              ) : (
                <ul className="space-y-0.5">
                  {sharedScopes.map((sh) => {
                    const key = sharedKeyOf(sh.mode, sh.scopeId);
                    const active = key === activeSharedKey;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          aria-current={active || undefined}
                          onClick={() => void openShared(key)}
                          className={cn(
                            "w-full rounded-md px-3 py-2.5 text-left transition-colors duration-150",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
                            active
                              ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200"
                              : "hover:bg-white"
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <ModeBadge mode={sh.mode} />
                            <span
                              className={cn(
                                "min-w-0 truncate text-sm font-medium",
                                active ? "text-indigo-900" : "text-slate-900"
                              )}
                            >
                              {sh.label || `#${sh.scopeId}`}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            {sh.supplierIds.map((sid) => supplierLabel(suppliers, sid)).join(" · ")}
                          </span>
                          <span className="mt-1.5 block">
                            <SharedProgress stats={order?.sharedStats.get(key)} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </nav>
            <section className="flex min-w-0 flex-col lg:min-h-0" aria-label="Rozdzielanie towarów">
              {activeShared ? (
                <ZdSharedScopeSplitter
                  key={activeSharedKey}
                  scope={activeShared}
                  suppliers={suppliers}
                  onError={onError}
                  onDirtyChange={setSplitDirty}
                  onSaved={reloadOrder}
                />
              ) : (
                <div className="px-6 py-16 text-center" role="status">
                  <p className="text-sm font-medium text-slate-900">
                    {sharedGone ? "Ten zakres nie jest już wspólny" : "Wybierz zakres z listy"}
                  </p>
                  {sharedGone ? (
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                      Mapowanie zmieniło się w międzyczasie - ta grupa lub cecha nie jest już przypisana kilku
                      dostawcom. Zapisane przypisania jej towarów zostają.
                      {lostSplitEdits > 0
                        ? ` ${lostSplitEdits} ${plWord(lostSplitEdits, "niezapisana zmiana przepadła", "niezapisane zmiany przepadły", "niezapisanych zmian przepadło")}.`
                        : null}
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        )
      ) : tab === "today" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {liveUnmapped.length > 0 ? (
            <>
              <p className="px-5 pt-4 text-sm text-slate-500 sm:px-6">{ZD_ESTIMATE_UI.todayScopeCoverageHint}</p>
              <ul className="mt-2 divide-y divide-slate-100">
                {liveUnmapped.map((s) => {
                  const top = insightFor(s.supplierId)?.suggestions[0];
                  return (
                    <li
                      key={s.supplierId}
                      className="flex flex-col gap-2 px-5 py-3 transition-colors duration-150 hover:bg-slate-50 sm:flex-row sm:items-center sm:px-6"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{s.supplierName}</p>
                        {s.isOverduePlan ? (
                          <Badge variant="danger">{ZD_ESTIMATE_UI.supplierScopesOverdueSuffix}</Badge>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {top ? (
                          <SuggestionChip
                            suggestion={top}
                            disabled={pending}
                            actionLabel="Przypisz"
                            onPick={(sg) => confirmSuggestion("assign", s.supplierId, sg)}
                          />
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => void beginAdd(s.supplierId)}
                        >
                          {top ? "Inny zakres" : ZD_ESTIMATE_UI.supplierScopesAssignCta}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <EmptyState
              title={hasActiveFilter ? ZD_ESTIMATE_UI.supplierScopesFilterEmptyTitle : "Wszystko przypisane"}
              description={
                hasActiveFilter
                  ? ZD_ESTIMATE_UI.supplierScopesFilterEmptyDescription
                  : ZD_ESTIMATE_UI.todayScopeCoverageEmpty
              }
              icon={<IconPackage size={28} strokeWidth={1.75} />}
            />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {adding ? (
            <section
              aria-label={ZD_ESTIMATE_UI.supplierScopesAddCta}
              className="space-y-4 border-b border-slate-200 bg-slate-50/70 px-5 py-5 sm:px-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                    {ZD_ESTIMATE_UI.supplierScopesAddCta}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                    {ZD_ESTIMATE_UI.supplierScopesAddHint}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Zamknij dodawanie"
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  onClick={cancelAdd}
                >
                  <IconX size={16} strokeWidth={2} />
                </button>
              </div>
              <label className="block max-w-md">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Dostawca</span>
                <Select
                  value={addDraft.supplierId}
                  onChange={(e) => setAddDraft({ ...emptyDraft(), supplierId: e.target.value })}
                  className="h-10 w-full"
                >
                  <option value="">{ZD_ESTIMATE_UI.supplierScopesPickSupplier}</option>
                  {unmappedSuppliers.length ? (
                    <optgroup label="Bez zakresu">
                      {unmappedSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {mappedSuppliers.length ? (
                    <optgroup label="Z zakresem - dodaj kolejny">
                      {mappedSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({scopesBySupplier.get(s.id)?.length ?? 0})
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </label>
              {addDraft.supplierId ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600">Podpowiedzi z historii ZD</p>
                    <CoverageMeter insight={insightFor(addDraft.supplierId)} />
                  </div>
                  {addSuggestions.length ? (
                    <div className="flex flex-wrap gap-2">
                      {addSuggestions.map((s) => (
                        <SuggestionChip
                          key={`${s.mode}:${s.id}`}
                          suggestion={s}
                          disabled={pending}
                          actionLabel="Wybierz"
                          onPick={pickSuggestionIntoDraft}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {order?.indexSyncedAt
                        ? "Brak podpowiedzi - wyszukaj grupę lub cechę ręcznie."
                        : "Indeks nie jest zbudowany - wyszukaj ręcznie albo zbuduj indeks (stopka okna)."}
                    </p>
                  )}
                </div>
              ) : null}
              <ScopeEditorForm
                draft={addDraft}
                configured={configured}
                searching={searching}
                disabled={pending}
                onChange={(patch) => setAddDraft((d) => ({ ...d, ...patch }))}
                onSearch={() => searchDraft(addDraft, setAddDraft)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    pending ||
                    !addDraft.supplierId ||
                    (addDraft.mode === "grupa" ? !addDraft.pickedGroup : !addDraft.pickedCecha)
                  }
                  onClick={() => saveDraft(addDraft, undefined, cancelAdd)}
                >
                  {ZD_ESTIMATE_UI.supplierScopesSaveCta}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancelAdd}>
                  {ZD_ESTIMATE_UI.supplierScopesCancelCta}
                </Button>
              </div>
            </section>
          ) : null}

          {supplierCards.length === 0 && !adding ? (
            <EmptyState
              title={hasActiveFilter ? ZD_ESTIMATE_UI.supplierScopesFilterEmptyTitle : ZD_ESTIMATE_UI.supplierScopesEmptyTitle}
              description={
                hasActiveFilter
                  ? ZD_ESTIMATE_UI.supplierScopesFilterEmptyDescription
                  : ZD_ESTIMATE_UI.supplierScopesEmptyDescription
              }
              icon={<IconPackage size={28} strokeWidth={1.75} />}
              action={
                hasActiveFilter ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                  >
                    Wyczyść filtr
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => void beginAdd()}>
                    {ZD_ESTIMATE_UI.supplierScopesAddCta}
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {supplierCards.map((card) => {
                const insight = insightFor(card.supplierId);
                const hitsFor = (row: ZdEstimateSupplierScopeRow) =>
                  insight?.currentScopeHits.find(
                    (h) => h.mode === row.mode && h.id === (row.mode === "cecha" ? row.cechaId : row.grupaId)
                  )?.hits;
                // Zakres bez żadnego towaru z ZD dostawcy = najpewniej błędne mapowanie.
                const hasHistory = (insight?.totalProducts ?? 0) > 0;
                const hasDeadScope = hasHistory && card.rows.some((r) => hitsFor(r) === 0);
                const topSuggestion = insight?.suggestions[0];
                const missingSuggestion =
                  !hasDeadScope && insight && insight.coveredProducts < insight.totalProducts
                    ? topSuggestion
                    : undefined;
                return (
                  <li key={card.supplierId} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="truncate text-sm font-semibold tracking-tight text-slate-900">{card.name}</h3>
                        <CoverageMeter insight={insight} />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => void beginAdd(card.supplierId)}
                      >
                        <IconPlus size={13} strokeWidth={2} aria-hidden />
                        Zakres
                      </Button>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {card.rows.map((row, idx) => {
                        const editing = editingId === row.id;
                        const scopeNumId = row.mode === "cecha" ? row.cechaId : row.grupaId;
                        const shared = scopeNumId != null && sharedKeys.has(sharedKeyOf(row.mode, scopeNumId));
                        const hits = hitsFor(row);
                        const dead = hasHistory && hits === 0;
                        return (
                          <li
                            key={row.id}
                            className={cn(
                              "rounded-md border bg-white transition-colors duration-150",
                              editing ? "border-indigo-200" : dead ? "border-red-200" : "border-slate-200"
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <ModeBadge mode={row.mode} />
                                <span className="max-w-full truncate text-sm font-medium text-slate-900">
                                  {row.label || "-"}
                                </span>
                                {scopeNumId != null ? (
                                  <span className="text-xs tabular-nums text-slate-500">#{scopeNumId}</span>
                                ) : null}
                                {card.rows.length > 1 && idx === 0 ? <Badge>główny</Badge> : null}
                                {dead ? (
                                  <Badge
                                    variant="danger"
                                    className="font-medium"
                                  >
                                    0 towarów z ZD - sprawdź mapowanie
                                  </Badge>
                                ) : hasHistory && hits != null ? (
                                  <span className="text-xs tabular-nums text-slate-500">{hits} z ZD</span>
                                ) : null}
                                {shared ? (
                                  <button
                                    type="button"
                                    onClick={() => void openShared(sharedKeyOf(row.mode, scopeNumId!))}
                                    className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-800 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                                    title="Ten zakres ma też inny dostawca - rozdziel jego towary"
                                  >
                                    Wspólny · rozdziel
                                  </button>
                                ) : null}
                                <span className="text-xs text-slate-500">
                                  {ZD_ESTIMATE_UI.supplierScopesUpdatedPrefix} {formatPlDate(row.updatedAt)}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {card.rows.length > 1 && idx > 0 ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={pending}
                                    onClick={() => makePrimary(row)}
                                    title="Od zakresu głównego startuje Kreator; pod nim zapisuje się historia ZD"
                                  >
                                    Ustaw jako główny
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => (editing ? cancelEdit() : beginEdit(row))}
                                >
                                  {editing ? ZD_ESTIMATE_UI.supplierScopesCancelCta : ZD_ESTIMATE_UI.supplierScopesEditCta}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => removeScope(row, card.name)}
                                  aria-label={`Usuń zakres ${row.label}`}
                                  className="px-2 hover:bg-red-50 hover:text-red-700"
                                >
                                  <IconX size={14} strokeWidth={2} />
                                </Button>
                              </div>
                            </div>
                            {dead && topSuggestion && !editing ? (
                              <div className="flex flex-wrap items-center gap-2 border-t border-red-100 px-3 py-2">
                                <span className="text-xs text-red-700">Zamień na (z historii ZD):</span>
                                {(insight?.suggestions ?? []).map((sg) => (
                                  <SuggestionChip
                                    key={`${sg.mode}:${sg.id}`}
                                    suggestion={sg}
                                    disabled={pending}
                                    actionLabel="Zamień"
                                    onPick={(pick) => confirmSuggestion("replace", card.supplierId, pick, row.id)}
                                  />
                                ))}
                              </div>
                            ) : null}
                            {editing ? (
                              <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                                <p className="text-xs text-slate-600">
                                  Wyszukaj i wybierz nową {editDraft.mode === "grupa" ? "grupę" : "cechę"} - obecna:{" "}
                                  <span className="font-medium text-slate-900">{row.label || "-"}</span>
                                </p>
                                <ScopeEditorForm
                                  draft={editDraft}
                                  configured={configured}
                                  searching={searching}
                                  disabled={pending}
                                  onChange={(patch) => setEditDraft((d) => ({ ...d, ...patch }))}
                                  onSearch={() => searchDraft(editDraft, setEditDraft)}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={
                                      pending || (editDraft.mode === "grupa" ? !editDraft.pickedGroup : !editDraft.pickedCecha)
                                    }
                                    onClick={() => saveDraft(editDraft, row.id, cancelEdit)}
                                  >
                                    {ZD_ESTIMATE_UI.supplierScopesSaveCta}
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancelEdit}>
                                    {ZD_ESTIMATE_UI.supplierScopesCancelCta}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {missingSuggestion ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-amber-800">
                          {insight!.totalProducts - insight!.coveredProducts} towarów z ZD poza zakresami - podpowiedź:
                        </span>
                        <SuggestionChip
                          suggestion={missingSuggestion}
                          disabled={pending}
                          actionLabel="Dodaj"
                          onPick={(sg) => confirmSuggestion("add", card.supplierId, sg)}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </ModalShell>
  );
}
