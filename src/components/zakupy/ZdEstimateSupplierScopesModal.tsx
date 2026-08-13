"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
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
import { IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";

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
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft.query}
          onChange={(e) => onChange({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch();
            }
          }}
          placeholder={
            draft.mode === "grupa" ? "Szukaj grupy…" : "Szukaj cechy…"
          }
          disabled={!configured || pending}
          className="h-10"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !configured || !draft.query.trim()}
          onClick={onSearch}
          className="h-10 shrink-0"
        >
          Szukaj
        </Button>
      </div>
      {draft.mode === "grupa" && draft.groupHits.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {draft.groupHits.map((g) => (
            <li key={g.grt_Id}>
              <button
                type="button"
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                  draft.pickedGroup?.grt_Id === g.grt_Id && "bg-indigo-50"
                )}
                onClick={() => onChange({ pickedGroup: g })}
              >
                {g.grt_Nazwa}
                <span className="ml-auto text-xs text-slate-400">
                  #{g.grt_Id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {draft.mode === "cecha" && draft.cechaHits.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {draft.cechaHits.map((c) => (
            <li key={c.ctw_Id}>
              <button
                type="button"
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                  draft.pickedCecha?.ctw_Id === c.ctw_Id && "bg-indigo-50"
                )}
                onClick={() => onChange({ pickedCecha: c })}
              >
                {c.ctw_Nazwa}
                <span className="ml-auto text-xs text-slate-400">
                  #{c.ctw_Id}
                </span>
              </button>
            </li>
          ))}
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
}: {
  open: boolean;
  onClose: () => void;
  suppliers: readonly ZdEstimateSupplierOption[];
  configured: boolean;
  onError: (message: string) => void;
}) {
  const searchId = useId();
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(false);
  const [scopes, setScopes] = useState<ZdEstimateSupplierScopeRow[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ScopeDraft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<ScopeDraft>(emptyDraft);

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

  const beginEdit = (row: ZdEstimateSupplierScopeRow) => {
    setAdding(false);
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
        return [res.scope, ...next];
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
      setScopes((prev) => prev.filter((s) => s.supplierId !== supplierId));
      if (editingId === supplierId) cancelEdit();
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={ZD_ESTIMATE_UI.supplierScopesPanelTitle}
      description={ZD_ESTIMATE_UI.supplierScopesPanelHint}
      size="lg"
      loadingMessage={pending ? "Zapisuję…" : null}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <IconSearch
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              id={searchId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtruj po dostawcy, etykiecie, id…"
              className="h-10 pl-9"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || unmappedSuppliers.length === 0}
            title={
              unmappedSuppliers.length === 0
                ? "Wszyscy dostawcy mają już mapowanie"
                : undefined
            }
            onClick={() => {
              setEditingId(null);
              setEditDraft(emptyDraft());
              setAdding(true);
              setAddDraft(emptyDraft());
            }}
            className="h-10 shrink-0"
          >
            {ZD_ESTIMATE_UI.supplierScopesAddCta}
          </Button>
        </div>

        {adding ? (
          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 px-4 py-3.5 space-y-3">
            <p className="text-sm font-medium text-slate-900">
              {ZD_ESTIMATE_UI.supplierScopesAddCta}
            </p>
            <p className="text-xs text-slate-600">
              {ZD_ESTIMATE_UI.supplierScopesAddHint}
            </p>
            <Select
              value={addDraft.supplierId}
              onChange={(e) =>
                setAddDraft((d) => ({ ...d, supplierId: e.target.value }))
              }
              className="h-10"
            >
              <option value="">— wybierz dostawcę —</option>
              {unmappedSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <ScopeEditorForm
              draft={addDraft}
              configured={configured}
              pending={pending}
              onChange={(patch) =>
                setAddDraft((d) => ({ ...d, ...patch }))
              }
              onSearch={() => searchDraft(addDraft, setAddDraft)}
            />
            <div className="flex flex-wrap gap-2">
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
                Zapisz mapowanie
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
                Anuluj
              </Button>
            </div>
          </div>
        ) : null}

        {loading && scopes.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-600">
            <Spinner className="size-4" /> Wczytuję mapowania…
          </div>
        ) : filtered.length === 0 && !adding ? (
          <EmptyState
            title="Brak mapowań"
            description="Dodaj mapowanie powyżej albo zapisz zakres przy pierwszym wejściu z Dziś."
          />
        ) : (
          <ul className="max-h-[min(28rem,60vh)] space-y-2 overflow-y-auto">
            {filtered.map((row) => {
              const name = supplierLabel(suppliers, row.supplierId);
              const editing = editingId === row.supplierId;
              return (
                <li
                  key={row.supplierId}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm shadow-slate-900/[0.02]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-slate-900">{name}</p>
                      <p className="text-xs text-slate-500">
                        {row.mode === "grupa" ? "Grupa" : "Cecha"}
                        {row.label ? ` · ${row.label}` : ""}
                        {row.mode === "grupa" && row.grupaId
                          ? ` · #${row.grupaId}`
                          : null}
                        {row.mode === "cecha" && row.cechaId
                          ? ` · #${row.cechaId}`
                          : null}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Aktualizacja {formatPlDate(row.updatedAt.slice(0, 10))}
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
                        {editing ? "Anuluj" : "Edytuj"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => removeScope(row.supplierId, name)}
                      >
                        <IconX size={14} strokeWidth={1.75} />
                        Usuń
                      </Button>
                    </div>
                  </div>

                  {editing ? (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
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
                        onClick={() =>
                          saveScope(editDraft, () => cancelEdit())
                        }
                      >
                        Zapisz mapowanie
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}
