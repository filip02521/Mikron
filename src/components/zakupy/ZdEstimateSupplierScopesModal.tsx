"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  actionDeleteZdEstimateSupplierScope,
  actionListZdEstimateSupplierScopes,
  actionSearchZdEstimateCechy,
  actionSearchZdEstimateGroups,
  actionUpsertZdEstimateSupplierScope,
  type ZdEstimateCechaOption,
  type ZdEstimateGroupOption,
  type ZdEstimateSupplierOption,
} from "@/app/actions/zd-estimate";
import type { ZdEstimateSupplierScopeRow } from "@/lib/data/zd-estimate-supplier-scopes";
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/80">
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
          className="max-h-40 overflow-y-auto rounded-lg border border-slate-200/90 bg-white divide-y divide-slate-100"
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
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ScopeDraft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<ScopeDraft>(emptyDraft);

  const handleClose = () => {
    setQuery("");
    setEditingId(null);
    setEditDraft(emptyDraft());
    setAdding(false);
    setAddDraft(emptyDraft());
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
      setLoading(true);
      start(async () => {
        const res = await actionListZdEstimateSupplierScopes();
        if (cancelled) return;
        setLoading(false);
        if (!res.ok) {
          onError(res.message);
          return;
        }
        setScopes(res.scopes);
        onScopesChange?.(res.scopes, { reason: "load" });
        onMappedSupplierIdsChange?.(res.scopes.map((s) => s.supplierId));
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only
  }, [open]);

  const mappedIds = useMemo(
    () => new Set(scopes.map((s) => s.supplierId)),
    [scopes]
  );

  const unmappedSuppliers = useMemo(
    () => suppliers.filter((s) => !mappedIds.has(s.id)),
    [suppliers, mappedIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scopes;
    return scopes.filter((s) => {
      const name = supplierLabel(suppliers, s.supplierId).toLowerCase();
      return (
        name.includes(q) ||
        s.label.toLowerCase().includes(q) ||
        s.supplierId.toLowerCase().includes(q) ||
        String(s.grupaId ?? "").includes(q) ||
        String(s.cechaId ?? "").includes(q)
      );
    });
  }, [scopes, query, suppliers]);

  const liveCoverage = useMemo(
    () =>
      todayCoverage
        ? zdEstimateScopeCoverage(todayCoverage.today, mappedIds)
        : null,
    [todayCoverage, mappedIds]
  );

  const liveUnmapped = liveCoverage?.unmapped ?? [];
  const hasActiveFilter = query.trim().length > 0;

  const beginEdit = (row: ZdEstimateSupplierScopeRow) => {
    setAdding(false);
    setAddDraft(emptyDraft());
    setEditingId(row.supplierId);
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
        setDraft((prev) => ({
          ...prev,
          groupHits: res.groups,
          cechaHits: [],
        }));
      } else {
        const res = await actionSearchZdEstimateCechy(q);
        if (!res.ok) {
          onError(res.message);
          return;
        }
        setDraft((prev) => ({
          ...prev,
          cechaHits: res.cechy,
          groupHits: [],
        }));
      }
    });
  };

  const saveScope = (draft: ScopeDraft, onDone: () => void) => {
    const supplierId = draft.supplierId.trim();
    if (!supplierId) {
      onError("Wybierz dostawcę.");
      return;
    }
    if (draft.mode === "grupa" && !draft.pickedGroup) {
      onError("Wybierz grupę z wyników wyszukiwania.");
      return;
    }
    if (draft.mode === "cecha" && !draft.pickedCecha) {
      onError("Wybierz cechę z wyników wyszukiwania.");
      return;
    }
    start(async () => {
      const res = await actionUpsertZdEstimateSupplierScope({
        supplierId,
        mode: draft.mode,
        ...(draft.mode === "grupa"
          ? {
              grupaId: draft.pickedGroup!.grt_Id,
              label: draft.pickedGroup!.grt_Nazwa,
            }
          : {
              cechaId: draft.pickedCecha!.ctw_Id,
              label: draft.pickedCecha!.ctw_Nazwa,
            }),
      });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      setScopes((prev) => {
        const next = prev.filter((s) => s.supplierId !== supplierId);
        const merged = [res.scope, ...next];
        onScopesChange?.(merged, { reason: "mutate" });
        onMappedSupplierIdsChange?.(merged.map((s) => s.supplierId));
        return merged;
      });
      onDone();
    });
  };

  const removeScope = (supplierId: string, label: string) => {
    if (
      !window.confirm(
        `Usunąć mapowanie dla „${label}”? Przy kolejnym wejściu z Dziś trzeba będzie przypisać zakres ponownie.`
      )
    ) {
      return;
    }
    start(async () => {
      const res = await actionDeleteZdEstimateSupplierScope({ supplierId });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      setScopes((prev) => {
        const next = prev.filter((s) => s.supplierId !== supplierId);
        onScopesChange?.(next, { reason: "mutate" });
        onMappedSupplierIdsChange?.(next.map((s) => s.supplierId));
        return next;
      });
      if (editingId === supplierId) cancelEdit();
    });
  };

  const listLoading = loading && scopes.length === 0;

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={ZD_ESTIMATE_UI.supplierScopesPanelTitle}
      titleHint={ZD_ESTIMATE_UI.supplierScopesPanelHint}
      titleHintAriaLabel="O zakresach dostawców"
      size="xl"
      bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zapisuję…" : null}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">
            {listLoading
              ? ZD_ESTIMATE_UI.supplierScopesLoading
              : hasActiveFilter
                ? `Widoczne ${filtered.length} z ${scopes.length}`
                : scopes.length === 0
                  ? ZD_ESTIMATE_UI.supplierScopesEmptyTitle
                  : zdEstimateSupplierScopesFooterCount(scopes.length)}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="self-end sm:self-auto"
          >
            {ZD_ESTIMATE_UI.supplierScopesCloseCta}
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-3">
        <div className="flex gap-3">
          <IconTruck
            size={18}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-slate-500"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {ZD_ESTIMATE_UI.supplierScopesIntroTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {ZD_ESTIMATE_UI.supplierScopesIntroBody}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={searchId} className="min-w-0 flex-1 text-xs font-medium text-slate-600">
          <span className="sr-only">Filtruj mapowania</span>
          <div className="relative mt-0 sm:mt-0">
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
          disabled={pending || unmappedSuppliers.length === 0}
          title={
            unmappedSuppliers.length === 0
              ? ZD_ESTIMATE_UI.supplierScopesAllMappedTitle
              : undefined
          }
          onClick={() => beginAdd()}
          className="h-10 shrink-0"
        >
          {ZD_ESTIMATE_UI.supplierScopesAddCta}
        </Button>
      </div>

      {!loading && todayCoverage && liveUnmapped.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-amber-200/80 bg-amber-50/50">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-200/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950">
                {ZD_ESTIMATE_UI.todayScopeCoverageTitle}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/75">
                {ZD_ESTIMATE_UI.todayScopeCoverageHint}
              </p>
            </div>
            <Badge variant="warning" className="tabular-nums">
              {liveUnmapped.length}/{liveCoverage?.todayCount ?? todayCoverage.todayCount}
            </Badge>
          </div>
          <ul className="max-h-44 divide-y divide-amber-100/80 overflow-y-auto">
            {liveUnmapped.map((s) => (
              <li
                key={s.supplierId}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {s.supplierName}
                  </p>
                  {s.isOverduePlan ? (
                    <Badge
                      variant="danger"
                      className="mt-1 px-1.5 py-0 text-[10px]"
                    >
                      {ZD_ESTIMATE_UI.supplierScopesOverdueSuffix}
                    </Badge>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => beginAdd(s.supplierId)}
                  className="shrink-0"
                >
                  {ZD_ESTIMATE_UI.supplierScopesAssignCta}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : !loading && liveCoverage && liveCoverage.todayCount > 0 ? (
        <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-2.5">
          <p className="text-xs font-medium text-emerald-900">
            {ZD_ESTIMATE_UI.todayScopeCoverageEmpty}
          </p>
        </div>
      ) : null}

      {adding ? (
        <div className="space-y-3 rounded-lg border border-indigo-200/80 bg-indigo-50/35 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {ZD_ESTIMATE_UI.supplierScopesAddCta}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {ZD_ESTIMATE_UI.supplierScopesAddHint}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Dostawca
            </label>
            <Select
              value={addDraft.supplierId}
              onChange={(e) =>
                setAddDraft((d) => ({ ...d, supplierId: e.target.value }))
              }
              className="h-10"
            >
              <option value="">
                {ZD_ESTIMATE_UI.supplierScopesPickSupplier}
              </option>
              {unmappedSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
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
                (addDraft.mode === "grupa"
                  ? !addDraft.pickedGroup
                  : !addDraft.pickedCecha)
              }
              onClick={() =>
                saveScope(addDraft, () => {
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

      {listLoading ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-12"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner />
          <p className="text-sm text-slate-500">
            {ZD_ESTIMATE_UI.supplierScopesLoading}
          </p>
        </div>
      ) : filtered.length === 0 && !adding ? (
        <EmptyState
          title={
            hasActiveFilter
              ? ZD_ESTIMATE_UI.supplierScopesFilterEmptyTitle
              : ZD_ESTIMATE_UI.supplierScopesEmptyTitle
          }
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
            ) : unmappedSuppliers.length > 0 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => beginAdd()}
              >
                {ZD_ESTIMATE_UI.supplierScopesAddCta}
              </Button>
            ) : null
          }
        />
      ) : filtered.length > 0 ? (
        <ul className="max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto pr-0.5">
          {filtered.map((row) => {
            const name = supplierLabel(suppliers, row.supplierId);
            const editing = editingId === row.supplierId;
            const scopeId =
              row.mode === "cecha" ? row.cechaId : row.grupaId;
            return (
              <li
                key={row.supplierId}
                className={cn(
                  "overflow-hidden rounded-lg border bg-white transition",
                  editing
                    ? "border-indigo-200/90 shadow-sm shadow-indigo-900/[0.04]"
                    : "border-slate-200/90"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-4">
                  <div className="min-w-0 space-y-2">
                    <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
                      {name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ModeBadge mode={row.mode} />
                      {row.label ? (
                        <span className="max-w-full truncate rounded-md bg-slate-50 px-2 py-0.5 text-[12px] font-medium text-slate-800 ring-1 ring-slate-200/90">
                          {row.label}
                        </span>
                      ) : null}
                      {scopeId != null ? (
                        <span className="text-[11px] tabular-nums text-slate-400">
                          #{scopeId}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] tabular-nums text-slate-400">
                      {ZD_ESTIMATE_UI.supplierScopesUpdatedPrefix}{" "}
                      {formatPlDate(row.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        editing ? cancelEdit() : beginEdit(row)
                      }
                    >
                      {editing
                        ? ZD_ESTIMATE_UI.supplierScopesCancelCta
                        : ZD_ESTIMATE_UI.supplierScopesEditCta}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => removeScope(row.supplierId, name)}
                    >
                      <IconX size={14} strokeWidth={1.75} />
                      {ZD_ESTIMATE_UI.supplierScopesRemoveCta}
                    </Button>
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-3 border-t border-indigo-100/80 bg-indigo-50/25 px-4 py-3.5 sm:px-4">
                    <p className="text-xs text-slate-600">
                      Wyszukaj i wybierz nową{" "}
                      {editDraft.mode === "grupa" ? "grupę" : "cechę"} —
                      obecna:{" "}
                      <span className="font-medium text-slate-800">
                        {row.label || "—"}
                      </span>
                    </p>
                    <ScopeEditorForm
                      draft={editDraft}
                      configured={configured}
                      pending={pending}
                      onChange={(patch) =>
                        setEditDraft((d) => ({ ...d, ...patch }))
                      }
                      onSearch={() => searchDraft(editDraft, setEditDraft)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        pending ||
                        (editDraft.mode === "grupa"
                          ? !editDraft.pickedGroup
                          : !editDraft.pickedCecha)
                      }
                      onClick={() => saveScope(editDraft, () => cancelEdit())}
                    >
                      {ZD_ESTIMATE_UI.supplierScopesSaveCta}
                    </Button>
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
