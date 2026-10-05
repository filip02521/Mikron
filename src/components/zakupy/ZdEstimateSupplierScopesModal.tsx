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
import {
  actionLoadZdScopeOrder,
  actionLoadZdSharedScopeProducts,
  actionSetZdProductAssignments,
  actionStartZdScopeIndexSync,
} from "@/app/actions/zd-scope-order";
import type { ZdSharedScope, ZdSharedScopeProduct } from "@/lib/data/zd-scope-order";
import type { ZdScopeSuggestion, ZdSupplierScopeInsight } from "@/lib/orders/zd-scope-suggest";
import {
  IconPackage,
  IconSearch,
  IconTruck,
  IconX,
} from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import {
  ZD_ESTIMATE_UI,
  zdEstimateSupplierScopesFooterCount,
} from "@/lib/orders/zd-estimate-ui-copy";
import {
  zdEstimateScopeCoverage,
  type ZdEstimateScopeCoverage,
} from "@/lib/orders/zd-estimate-scope-coverage";
import { askConfirm } from "@/components/ui/ConfirmHost";

function supplierLabel(
  suppliers: readonly ZdEstimateSupplierOption[],
  supplierId: string
): string {
  const hit = suppliers.find((s) => s.id === supplierId);
  return hit?.name?.trim() || supplierId;
}

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
  pending,
  onChange,
  onSearch,
}: {
  draft: ScopeDraft;
  configured: boolean;
  pending: boolean;
  onChange: (patch: Partial<ScopeDraft>) => void;
  onSearch: () => void;
}) {
  const searchFieldId = useId();
  const pickedLabel =
    draft.mode === "grupa"
      ? draft.pickedGroup?.grt_Nazwa
      : draft.pickedCecha?.ctw_Nazwa;
  const pickedId =
    draft.mode === "grupa"
      ? draft.pickedGroup?.grt_Id
      : draft.pickedCecha?.ctw_Id;
  const hits =
    draft.mode === "grupa" ? draft.groupHits : draft.cechaHits;

  return (
    <div className="space-y-3">
      <SegmentedControl
        ariaLabel="Tryb mapowania"
        value={draft.mode}
        onChange={(v) =>
          onChange({
            mode: v,
            pickedGroup: null,
            pickedCecha: null,
            groupHits: [],
            cechaHits: [],
          })
        }
        options={[
          { value: "grupa", label: "Grupa" },
          { value: "cecha", label: "Cecha" },
        ]}
      />

      <div>
        <label
          htmlFor={searchFieldId}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          {draft.mode === "grupa" ? "Grupa Subiekta" : "Cecha Subiekta"}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <IconSearch
              size={15}
              strokeWidth={2.25}
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
              disabled={!configured || pending}
              className="h-10 pl-8"
              autoComplete="off"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !configured || !draft.query.trim()}
            onClick={onSearch}
            className="h-10 shrink-0"
          >
            {ZD_ESTIMATE_UI.supplierScopesSearchCta}
          </Button>
        </div>
      </div>

      {pickedLabel ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-3 py-2">
          <span className="text-[11px] font-medium text-emerald-800/80">
            {ZD_ESTIMATE_UI.supplierScopesPickedPrefix}
          </span>
          <ModeBadge mode={draft.mode} />
          <span className="min-w-0 truncate text-sm font-medium text-emerald-950">
            {pickedLabel}
          </span>
          {pickedId != null ? (
            <span className="text-[11px] tabular-nums text-emerald-800/70">
              #{pickedId}
            </span>
          ) : null}
        </div>
      ) : null}

      {hits.length > 0 ? (
        <ul
          className="max-h-40 overflow-y-auto rounded-md border border-slate-200/90 bg-white divide-y divide-slate-100"
          role="listbox"
          aria-label={
            draft.mode === "grupa" ? "Wyniki grup" : "Wyniki cech"
          }
        >
          {draft.mode === "grupa"
            ? draft.groupHits.map((g) => {
                const active = draft.pickedGroup?.grt_Id === g.grt_Id;
                return (
                  <li key={g.grt_Id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition",
                        active
                          ? "bg-indigo-50 text-indigo-950"
                          : "text-slate-800 hover:bg-slate-50"
                      )}
                      onClick={() => onChange({ pickedGroup: g })}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {g.grt_Nazwa}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                        #{g.grt_Id}
                      </span>
                    </button>
                  </li>
                );
              })
            : draft.cechaHits.map((c) => {
                const active = draft.pickedCecha?.ctw_Id === c.ctw_Id;
                return (
                  <li key={c.ctw_Id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition",
                        active
                          ? "bg-indigo-50 text-indigo-950"
                          : "text-slate-800 hover:bg-slate-50"
                      )}
                      onClick={() => onChange({ pickedCecha: c })}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {c.ctw_Nazwa}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                        #{c.ctw_Id}
                      </span>
                    </button>
                  </li>
                );
              })}
        </ul>
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
      className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-indigo-200/90 bg-white px-2 py-1 text-left text-xs text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
    >
      <ModeBadge mode={s.mode} />
      <span className="min-w-0 truncate font-medium">{s.name}</span>
      <span className="shrink-0 tabular-nums text-emerald-700">+{s.newHits} z ZD</span>
      {s.otherSupplierCount > 0 ? (
        <span className="shrink-0 text-[10px] text-amber-700">
          {Math.round(s.purity * 100)}%
        </span>
      ) : null}
      <span className="shrink-0 font-semibold text-indigo-700 group-hover:underline">
        {actionLabel}
      </span>
    </button>
  );
}

function CoverageLine({ insight }: { insight: ZdSupplierScopeInsight | undefined }) {
  if (!insight || insight.totalProducts === 0) {
    return <span className="text-[11px] text-slate-400">brak historii ZD</span>;
  }
  const pct = Math.round((insight.coveredProducts / insight.totalProducts) * 100);
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums",
        pct >= 90 ? "text-emerald-700" : pct >= 60 ? "text-amber-700" : "text-red-700"
      )}
      title="Ile towarów zamawianych u tego dostawcy (historia ZD) obejmują jego zakresy"
    >
      Towary z ZD w zakresach: {insight.coveredProducts}/{insight.totalProducts} ({pct}%)
    </span>
  );
}

function SharedScopeSplitter({
  scope,
  suppliers,
  onError,
  onClose,
}: {
  scope: ZdSharedScope;
  suppliers: readonly ZdEstimateSupplierOption[];
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [products, setProducts] = useState<ZdSharedScopeProduct[] | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);
  // Nowa tożsamość onError nie może przeładować listy (skasowałaby niezapisane wybory).
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    start(async () => {
      const res = await actionLoadZdSharedScopeProducts({
        mode: scope.mode,
        scopeId: scope.scopeId,
      });
      if (cancelled) return;
      if (!res.ok) {
        onErrorRef.current(res.message);
        return;
      }
      setProducts(res.products);
      setDraft(
        Object.fromEntries(res.products.map((p) => [p.subiektTwId, p.assignedSupplierId ?? ""]))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [scope.mode, scope.scopeId]);

  const changed = (products ?? []).filter(
    (p) => (draft[p.subiektTwId] ?? "") !== (p.assignedSupplierId ?? "")
  );

  const applyHistory = () => {
    setSaved(false);
    setDraft((prev) => {
      const next = { ...prev };
      for (const p of products ?? []) {
        if (p.suggestedSupplierId) next[p.subiektTwId] = p.suggestedSupplierId;
      }
      return next;
    });
  };

  const save = () => {
    start(async () => {
      const res = await actionSetZdProductAssignments({
        items: changed.map((p) => ({
          subiektTwId: p.subiektTwId,
          supplierId: draft[p.subiektTwId] || null,
          twSymbol: p.twSymbol,
          twNazwa: p.twNazwa,
        })),
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      setProducts((prev) =>
        (prev ?? []).map((p) => ({ ...p, assignedSupplierId: draft[p.subiektTwId] || null }))
      );
      setSaved(true);
    });
  };

  return (
    <div className="space-y-3 border-t border-sky-100 bg-sky-50/30 px-4 py-3.5">
      <p className="text-xs leading-relaxed text-slate-600">
        Towar przypisany do dostawcy znika z listy „Do ZD” pozostałych dostawców tego zakresu.
        Bez przypisania - widzą go wszyscy. Para paczka/sztuka znika dopiero, gdy obie strony
        mają tego samego dostawcę. Lista obejmuje tylko towary, które kupowaliśmy od tych
        dostawców (historia ZD).
      </p>
      {products == null ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
          <Spinner size="sm" /> Wczytuję towary…
        </div>
      ) : products.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">Brak towarów z historią ZD w tym zakresie.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-white">
          {products.map((p) => (
            <li key={p.subiektTwId} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[12px] font-semibold text-slate-900">
                  {p.twSymbol ?? `#${p.subiektTwId}`}
                </p>
                <p className="truncate text-[11px] text-slate-500" title={p.twNazwa}>
                  {p.twNazwa}
                </p>
                <p className="text-[11px] text-slate-500">
                  ZD:{" "}
                  {Object.entries(p.orderCountBySupplier)
                    .map(([sid, n]) => `${supplierLabel(suppliers, sid)} ${n}×`)
                    .join(" · ") || "-"}
                </p>
              </div>
              <Select
                value={draft[p.subiektTwId] ?? ""}
                onChange={(e) => {
                  setSaved(false);
                  setDraft((d) => ({ ...d, [p.subiektTwId]: e.target.value }));
                }}
                className="h-9 sm:w-56"
                aria-label={`Dostawca dla ${p.twSymbol ?? p.twNazwa}`}
              >
                <option value="">Wszyscy (bez przypisania)</option>
                {scope.supplierIds.map((sid) => (
                  <option key={sid} value={sid}>
                    {supplierLabel(suppliers, sid)}
                    {sid === p.suggestedSupplierId ? " - wg ZD" : ""}
                  </option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || !products?.some((p) => p.suggestedSupplierId)}
          onClick={applyHistory}
        >
          Ustaw wg historii ZD
        </Button>
        <Button type="button" size="sm" disabled={pending || changed.length === 0} onClick={save}>
          {pending ? <Spinner size="sm" className="mr-1.5" /> : null}
          Zapisz ({changed.length})
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onClose}>
          Zamknij
        </Button>
        {saved && changed.length === 0 ? (
          <span className="text-xs text-emerald-700">Zapisano - działa przy kolejnym Policz.</span>
        ) : null}
      </div>
    </div>
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
    indexSyncRunning: boolean;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ScopeDraft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<ScopeDraft>(emptyDraft);
  const [splitKey, setSplitKey] = useState<string | null>(null);

  const reloadOrder = () => {
    start(async () => {
      const res = await actionLoadZdScopeOrder();
      if (!res.ok) {
        onError(res.message);
        return;
      }
      setOrder({
        indexSyncedAt: res.indexSyncedAt,
        insights: new Map(res.insights.map((i) => [i.supplierId, i])),
        sharedScopes: res.sharedScopes,
        indexSyncRunning: res.indexSyncRunning,
      });
    });
  };

  const handleClose = () => {
    setQuery("");
    setEditingId(null);
    setEditDraft(emptyDraft());
    setAdding(false);
    setAddDraft(emptyDraft());
    setSplitKey(null);
    setLoading(false);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setQuery("");
      setEditingId(null);
      setEditDraft(emptyDraft());
      setAdding(false);
      setAddDraft(emptyDraft());
      setSplitKey(null);
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
          setOrder({
            indexSyncedAt: orderRes.indexSyncedAt,
            insights: new Map(orderRes.insights.map((i) => [i.supplierId, i])),
            sharedScopes: orderRes.sharedScopes,
            indexSyncRunning: orderRes.indexSyncRunning,
          });
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

  const unmappedSuppliers = useMemo(
    () => suppliers.filter((s) => !mappedIds.has(s.id)),
    [suppliers, mappedIds]
  );
  const mappedSuppliers = useMemo(
    () => suppliers.filter((s) => mappedIds.has(s.id)),
    [suppliers, mappedIds]
  );

  const supplierCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ids = [...scopesBySupplier.keys()];
    return ids
      .map((supplierId) => ({
        supplierId,
        name: supplierLabel(suppliers, supplierId),
        rows: scopesBySupplier.get(supplierId) ?? [],
      }))
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.rows.some(
            (s) =>
              s.label.toLowerCase().includes(q) ||
              String(s.grupaId ?? "").includes(q) ||
              String(s.cechaId ?? "").includes(q)
          )
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [scopesBySupplier, suppliers, query]);

  const liveCoverage = useMemo(
    () => (todayCoverage ? zdEstimateScopeCoverage(todayCoverage.today, mappedIds) : null),
    [todayCoverage, mappedIds]
  );

  const hasActiveFilter = query.trim().length > 0;
  // Filtr obejmuje wszystkie sekcje — inaczej „Dziś bez mapowania” zasłania wyniki.
  const filterText = query.trim().toLowerCase();
  const liveUnmapped = (liveCoverage?.unmapped ?? []).filter(
    (s) => !filterText || s.supplierName.toLowerCase().includes(filterText)
  );
  const sharedScopes = (order?.sharedScopes ?? []).filter(
    (sh) =>
      !filterText ||
      sh.label.toLowerCase().includes(filterText) ||
      sh.supplierIds.some((sid) => supplierLabel(suppliers, sid).toLowerCase().includes(filterText))
  );

  const insightFor = (supplierId: string) => order?.insights.get(supplierId);

  const beginEdit = (row: ZdEstimateSupplierScopeRow) => {
    setAdding(false);
    setAddDraft(emptyDraft());
    setEditingId(row.id);
    setEditDraft({
      ...emptyDraft(),
      supplierId: row.supplierId,
      mode: row.mode,
      query: row.label,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyDraft());
  };

  const beginAdd = (supplierId?: string) => {
    setEditingId(null);
    setEditDraft(emptyDraft());
    setAdding(true);
    setAddDraft({
      ...emptyDraft(),
      ...(supplierId ? { supplierId } : {}),
    });
  };

  const searchDraft = (
    draft: ScopeDraft,
    setDraft: (d: ScopeDraft | ((prev: ScopeDraft) => ScopeDraft)) => void
  ) => {
    const q = draft.query.trim();
    if (!q || !configured) return;
    start(async () => {
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
    input: {
      supplierId: string;
      scopeId?: string;
      mode: ZdEstimateRunMode;
      id: number;
      label: string;
    },
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
      commitScopes([
        ...scopesRef.current.filter((s) => s.supplierId !== row.supplierId),
        ...res.scopes,
      ]);
    });
  };

  const startIndexSync = () => {
    start(async () => {
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
      pickedGroup:
        s.mode === "grupa" ? ({ grt_Id: s.id, grt_Nazwa: s.name } as ZdEstimateGroupOption) : null,
      pickedCecha:
        s.mode === "cecha" ? ({ ctw_Id: s.id, ctw_Nazwa: s.name } as ZdEstimateCechaOption) : null,
    }));
  };

  const listLoading = loading && scopes.length === 0;
  const addSuggestions = addDraft.supplierId
    ? (insightFor(addDraft.supplierId)?.suggestions ?? [])
    : [];

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={ZD_ESTIMATE_UI.supplierScopesPanelTitle}
      titleHint={ZD_ESTIMATE_UI.supplierScopesPanelHint}
      titleHintAriaLabel="O zakresach dostawców"
      size="xl"
      bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending && !loading ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">
            {listLoading
              ? ZD_ESTIMATE_UI.supplierScopesLoading
              : hasActiveFilter
                ? `Widoczne ${supplierCards.length} z ${scopesBySupplier.size} dostawców`
                : scopes.length === 0
                  ? ZD_ESTIMATE_UI.supplierScopesEmptyTitle
                  : `${scopesBySupplier.size} dostawców · ${zdEstimateSupplierScopesFooterCount(scopes.length)}`}
          </p>
          <Button type="button" variant="secondary" onClick={handleClose} className="self-end sm:self-auto">
            {ZD_ESTIMATE_UI.supplierScopesCloseCta}
          </Button>
        </div>
      }
    >
      <div className="rounded-md border border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <div className="flex gap-3">
          <IconTruck size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{ZD_ESTIMATE_UI.supplierScopesIntroTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{ZD_ESTIMATE_UI.supplierScopesIntroBody}</p>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {order?.indexSyncRunning
                ? "Buduję indeks grup i cech z Subiekta (ok. 2 min)…"
                : order?.indexSyncedAt
                  ? `Podpowiedzi z indeksu Subiekta z ${formatPlDate(order.indexSyncedAt)}.`
                  : "Podpowiedzi wymagają indeksu grup i cech z Subiekta (odświeża się co noc)."}{" "}
              <button
                type="button"
                className="font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
                disabled={pending || !configured || order?.indexSyncRunning}
                onClick={order?.indexSyncRunning ? undefined : startIndexSync}
              >
                {order?.indexSyncRunning ? "" : order?.indexSyncedAt ? "Odśwież teraz" : "Zbuduj teraz"}
              </button>
              {order?.indexSyncRunning ? (
                <button
                  type="button"
                  className="ml-1 font-medium text-indigo-700 hover:text-indigo-900"
                  onClick={reloadOrder}
                >
                  Sprawdź
                </button>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={searchId} className="min-w-0 flex-1 text-xs font-medium text-slate-600">
          <span className="sr-only">Filtruj mapowania</span>
          <div className="relative">
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
              placeholder={ZD_ESTIMATE_UI.supplierScopesSearchPlaceholder}
              className="h-10 pl-8 pr-9"
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
                <IconX size={14} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        </label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || suppliers.length === 0}
          title={suppliers.length === 0 ? ZD_ESTIMATE_UI.supplierScopesAllMappedTitle : undefined}
          onClick={() => beginAdd()}
          className="h-10 shrink-0"
        >
          {ZD_ESTIMATE_UI.supplierScopesAddCta}
        </Button>
      </div>

      {!loading && todayCoverage && liveUnmapped.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-amber-200/80 bg-amber-50/50">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-200/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950">{ZD_ESTIMATE_UI.todayScopeCoverageTitle}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/75">
                {ZD_ESTIMATE_UI.todayScopeCoverageHint}
              </p>
            </div>
            <Badge variant="warning" className="tabular-nums">
              {liveUnmapped.length}/{liveCoverage?.todayCount ?? todayCoverage.todayCount}
            </Badge>
          </div>
          <ul className="max-h-60 divide-y divide-amber-100/80 overflow-y-auto">
            {liveUnmapped.map((s) => {
              const top = insightFor(s.supplierId)?.suggestions[0];
              return (
                <li key={s.supplierId} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{s.supplierName}</p>
                    {s.isOverduePlan ? (
                      <Badge variant="danger" className="mt-1 px-1.5 py-0 text-[10px]">
                        {ZD_ESTIMATE_UI.supplierScopesOverdueSuffix}
                      </Badge>
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
                      variant="secondary"
                      disabled={pending}
                      onClick={() => beginAdd(s.supplierId)}
                    >
                      {top ? "Inny zakres" : ZD_ESTIMATE_UI.supplierScopesAssignCta}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : !loading && !hasActiveFilter && liveCoverage && liveCoverage.todayCount > 0 ? (
        <div className="rounded-md border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-2.5">
          <p className="text-xs font-medium text-emerald-900">{ZD_ESTIMATE_UI.todayScopeCoverageEmpty}</p>
        </div>
      ) : null}

      {adding ? (
        <div className="space-y-3 rounded-md border border-indigo-200/80 bg-indigo-50/35 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">{ZD_ESTIMATE_UI.supplierScopesAddCta}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{ZD_ESTIMATE_UI.supplierScopesAddHint}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Dostawca</label>
            <Select
              value={addDraft.supplierId}
              onChange={(e) => setAddDraft({ ...emptyDraft(), supplierId: e.target.value })}
              className="h-10"
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
          </div>
          {addDraft.supplierId ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-600">Podpowiedzi z historii ZD</p>
                <CoverageLine insight={insightFor(addDraft.supplierId)} />
              </div>
              {addSuggestions.length ? (
                <div className="flex flex-wrap gap-1.5">
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
                <p className="text-[11px] text-slate-500">
                  {order?.indexSyncedAt
                    ? "Brak podpowiedzi - wyszukaj grupę lub cechę ręcznie."
                    : "Indeks nie jest zbudowany - wyszukaj ręcznie albo zbuduj indeks."}
                </p>
              )}
            </div>
          ) : null}
          <ScopeEditorForm
            draft={addDraft}
            configured={configured}
            pending={pending}
            onChange={(patch) => setAddDraft((d) => ({ ...d, ...patch }))}
            onSearch={() => searchDraft(addDraft, setAddDraft)}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={
                pending ||
                !addDraft.supplierId ||
                (addDraft.mode === "grupa" ? !addDraft.pickedGroup : !addDraft.pickedCecha)
              }
              onClick={() =>
                saveDraft(addDraft, undefined, () => {
                  setAdding(false);
                  setAddDraft(emptyDraft());
                })
              }
            >
              {ZD_ESTIMATE_UI.supplierScopesSaveCta}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setAdding(false);
                setAddDraft(emptyDraft());
              }}
            >
              {ZD_ESTIMATE_UI.supplierScopesCancelCta}
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && sharedScopes.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-sky-200/80 bg-sky-50/30">
          <div className="border-b border-sky-200/60 px-4 py-3">
            <p className="text-sm font-semibold text-sky-950">Wspólne zakresy</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-sky-900/75">
              Ten sam zakres ma kilku dostawców - jego towary pokazują się u każdego z nich.
              Wskaż, u kogo zamawiasz dany towar.
            </p>
          </div>
          <ul className="divide-y divide-sky-100">
            {sharedScopes.map((sh) => {
              const key = `${sh.mode}:${sh.scopeId}`;
              const isOpen = splitKey === key;
              return (
                <li key={key}>
                  <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ModeBadge mode={sh.mode} />
                        <span className="truncate text-sm font-medium text-slate-900">{sh.label || `#${sh.scopeId}`}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {sh.supplierIds.map((sid) => supplierLabel(suppliers, sid)).join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending && !isOpen}
                      onClick={() => setSplitKey(isOpen ? null : key)}
                    >
                      {isOpen ? "Zwiń" : "Rozdziel towary"}
                    </Button>
                  </div>
                  {isOpen ? (
                    <SharedScopeSplitter
                      scope={sh}
                      suppliers={suppliers}
                      onError={onError}
                      onClose={() => setSplitKey(null)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {listLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite" aria-busy="true">
          <Spinner />
          <p className="text-sm text-slate-500">{ZD_ESTIMATE_UI.supplierScopesLoading}</p>
        </div>
      ) : supplierCards.length === 0 && !adding ? (
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
              <Button type="button" size="sm" onClick={() => beginAdd()}>
                {ZD_ESTIMATE_UI.supplierScopesAddCta}
              </Button>
            )
          }
        />
      ) : supplierCards.length > 0 ? (
        <ul className="max-h-[min(32rem,60vh)] space-y-2 overflow-y-auto pr-0.5">
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
              <li key={card.supplierId} className="overflow-hidden rounded-md border border-slate-200/90 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight text-slate-900">{card.name}</p>
                    <CoverageLine insight={insight} />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => beginAdd(card.supplierId)}
                  >
                    + Zakres
                  </Button>
                </div>
                <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                  {card.rows.map((row, idx) => {
                    const editing = editingId === row.id;
                    const scopeNumId = row.mode === "cecha" ? row.cechaId : row.grupaId;
                    return (
                      <li key={row.id} className={cn(editing && "bg-indigo-50/25")}>
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <ModeBadge mode={row.mode} />
                            <span className="max-w-full truncate text-[13px] font-medium text-slate-800">
                              {row.label || "-"}
                            </span>
                            {scopeNumId != null ? (
                              <span className="text-[11px] tabular-nums text-slate-400">#{scopeNumId}</span>
                            ) : null}
                            {card.rows.length > 1 && idx === 0 ? (
                              <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">
                                główny
                              </span>
                            ) : null}
                            <span className="text-[11px] text-slate-500">
                              {ZD_ESTIMATE_UI.supplierScopesUpdatedPrefix} {formatPlDate(row.updatedAt)}
                            </span>
                            {hasHistory && hitsFor(row) != null ? (
                              hitsFor(row) === 0 ? (
                                <span
                                  className="rounded bg-red-50 px-1.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200"
                                  title="Żaden towar zamawiany u tego dostawcy (historia ZD) nie należy do tego zakresu - sprawdź, czy to właściwa grupa/cecha."
                                >
                                  0 towarów z ZD - sprawdź mapowanie
                                </span>
                              ) : (
                                <span className="text-[10px] tabular-nums text-slate-500">
                                  {hitsFor(row)} z ZD
                                </span>
                              )
                            ) : null}
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            {card.rows.length > 1 && idx > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
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
                              variant="secondary"
                              disabled={pending}
                              onClick={() => (editing ? cancelEdit() : beginEdit(row))}
                            >
                              {editing ? ZD_ESTIMATE_UI.supplierScopesCancelCta : ZD_ESTIMATE_UI.supplierScopesEditCta}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={pending}
                              onClick={() => removeScope(row, card.name)}
                              aria-label={`Usuń zakres ${row.label}`}
                            >
                              <IconX size={14} strokeWidth={1.75} />
                            </Button>
                          </div>
                        </div>
                        {hasHistory && hitsFor(row) === 0 && topSuggestion && !editing ? (
                          <div className="flex flex-wrap items-center gap-2 border-t border-red-100 bg-red-50/40 px-4 py-2">
                            <span className="text-[11px] text-red-900">Zamień na (z historii ZD):</span>
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
                          <div className="space-y-3 border-t border-indigo-100/80 px-4 py-3">
                            <p className="text-xs text-slate-600">
                              Wyszukaj i wybierz nową {editDraft.mode === "grupa" ? "grupę" : "cechę"} - obecna:{" "}
                              <span className="font-medium text-slate-800">{row.label || "-"}</span>
                            </p>
                            <ScopeEditorForm
                              draft={editDraft}
                              configured={configured}
                              pending={pending}
                              onChange={(patch) => setEditDraft((d) => ({ ...d, ...patch }))}
                              onSearch={() => searchDraft(editDraft, setEditDraft)}
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={pending || (editDraft.mode === "grupa" ? !editDraft.pickedGroup : !editDraft.pickedCecha)}
                              onClick={() => saveDraft(editDraft, row.id, () => cancelEdit())}
                            >
                              {ZD_ESTIMATE_UI.supplierScopesSaveCta}
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {missingSuggestion ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-amber-50/40 px-4 py-2">
                    <span className="text-[11px] text-amber-900">
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
      ) : null}
    </ModalShell>
  );
}
