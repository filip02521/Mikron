"use client";
import { toastFromError, ToastNotice, TEETH_CATALOG_TOAST } from "@/lib/ui/notice-copy";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TeethProductRow } from "@/lib/data/teeth-products";
import {
  actionAddTeethProduct,
  actionListTeethProducts,
  actionRemoveTeethProduct,
  actionSearchSubiektProductsForTeethAdmin,
  actionUpdateTeethProductNote,
  actionUpdateTeethProductManufacturer,
  actionUpdateTeethProductProductLine,
  actionUpdateTeethProductKind,
} from "@/app/actions/teeth-products";
import {
  TEETH_MANUFACTURERS,
  TEETH_KIND_LABELS,
  teethManufacturerLabel,
  teethProductLineLabel,
  detectTeethKind,
  teethLinesForManufacturer,
  type TeethManufacturer,
} from "@/lib/teeth/teeth-catalog";
import { Button } from "@/components/ui/Button";
import { Field, Input, fieldControlClass } from "@/components/ui/Field";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { prosbaLineStockShellClass } from "@/lib/orders/prosba-line-stock-ui";

type SearchHit = {
  subiektTwId: number;
  symbol: string | null;
  name: string;
  plu: string | null;
};

function productLabel(row: Pick<TeethProductRow, "name" | "symbol" | "subiektTwId">): string {
  const symbol = row.symbol?.trim();
  return symbol ? `${symbol} · ${row.name}` : row.name || `Towar ${row.subiektTwId}`;
}

export function TeethProductsAdminClient({ initial }: { initial: TeethProductRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const [filter, setFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedHit, setSelectedHit] = useState<SearchHit | null>(null);
  const [addNote, setAddNote] = useState("");
  const [addManufacturer, setAddManufacturer] = useState<string>("");
  const [addKind, setAddKind] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<TeethProductRow | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [manufacturerDrafts, setManufacturerDrafts] = useState<Record<number, string>>({});
  const [productLineDrafts, setProductLineDrafts] = useState<Record<number, string>>({});
  const [kindDrafts, setKindDrafts] = useState<Record<number, string>>({});
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [resolvedSearchQuery, setResolvedSearchQuery] = useState("");
  const searchDebounceRef = useRef<number | null>(null);

  const initialKey = initial.map((row) => `${row.subiektTwId}\0${row.updatedAt}`).join("\n");
  const [appliedInitialKey, setAppliedInitialKey] = useState(initialKey);
  if (initialKey !== appliedInitialKey) {
    setAppliedInitialKey(initialKey);
    setRows(initial);
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [row.name, row.symbol ?? "", row.plu ?? "", String(row.subiektTwId), row.note]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [filter, rows]);

  useEffect(() => {
    if (!debouncedSearchQuery) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await actionSearchSubiektProductsForTeethAdmin(debouncedSearchQuery);
        if (cancelled) return;
        setResolvedSearchQuery(debouncedSearchQuery);
        if (!result.ok) {
          setSearchHits([]);
          setSearchError(result.error);
        } else {
          setSearchHits(result.items);
          setSearchError(null);
        }
      } catch {
        if (cancelled) return;
        setResolvedSearchQuery(debouncedSearchQuery);
        setSearchHits([]);
        setSearchError("Nie udało się wyszukać w Subiekcie.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery]);

  const trimmedSearchQuery = searchQuery.trim();
  const searchActive = trimmedSearchQuery.length >= 2;
  const visibleSearchLoading =
    searchActive &&
    (trimmedSearchQuery !== debouncedSearchQuery ||
      (debouncedSearchQuery !== resolvedSearchQuery && debouncedSearchQuery.length > 0));
  const visibleSearchHits = searchActive ? searchHits : [];
  const visibleSearchError = searchActive ? searchError : null;

  const saveProductLine = (row: TeethProductRow) => {
    const draft = productLineDrafts[row.subiektTwId] ?? row.productLine ?? "";
    const current = row.productLine ?? "";
    if (draft === current) return;
    start(async () => {
      const result = await actionUpdateTeethProductProductLine(row.subiektTwId, draft || null);
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      setToast(TEETH_CATALOG_TOAST.savedProductLine);
      refreshRows();
    });
  };

  const saveKind = (row: TeethProductRow) => {
    const draft = kindDrafts[row.subiektTwId] ?? row.kind ?? "";
    const current = row.kind ?? "";
    if (draft === current) return;
    start(async () => {
      const result = await actionUpdateTeethProductKind(row.subiektTwId, draft || null);
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      setToast(TEETH_CATALOG_TOAST.savedKind);
      refreshRows();
    });
  };

  const refreshRows = () => {
    start(async () => {
      try {
        const next = await actionListTeethProducts();
        setRows(next);
        router.refresh();
      } catch {
        setToast(TEETH_CATALOG_TOAST.refreshFailed);
      }
    });
  };

  const addProduct = () => {
    if (!selectedHit) return;
    start(async () => {
      const result = await actionAddTeethProduct({
        subiektTwId: selectedHit.subiektTwId,
        symbol: selectedHit.symbol,
        name: selectedHit.name,
        plu: selectedHit.plu,
        note: addNote,
        manufacturer: addManufacturer || null,
        kind: addKind || null,
      });
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      setToast(TEETH_CATALOG_TOAST.addedProduct);
      setSelectedHit(null);
      setAddNote("");
      setAddManufacturer("");
      setAddKind("");
      setSearchQuery("");
      setSearchHits([]);
      setDebouncedSearchQuery("");
      setResolvedSearchQuery("");
      refreshRows();
    });
  };

  const saveNote = (row: TeethProductRow) => {
    const draft = noteDrafts[row.subiektTwId] ?? row.note;
    if (draft === row.note) return;
    start(async () => {
      const result = await actionUpdateTeethProductNote(row.subiektTwId, draft);
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      setToast(TEETH_CATALOG_TOAST.savedNote);
      refreshRows();
    });
  };

  const saveManufacturer = (row: TeethProductRow) => {
    const draft = manufacturerDrafts[row.subiektTwId] ?? row.manufacturer ?? "";
    const current = row.manufacturer ?? "";
    if (draft === current) return;
    start(async () => {
      const result = await actionUpdateTeethProductManufacturer(row.subiektTwId, draft || null);
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      setToast(TEETH_CATALOG_TOAST.savedManufacturer);
      refreshRows();
    });
  };

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismissToast} /> : null}

      <ConfirmDialog
        open={!!deleteTarget}
        tier="stack"
        title="Usunąć z listy zębów?"
        message={
          deleteTarget
            ? `„${productLabel(deleteTarget)}” wróci pod zwykłą kontrolę stanu magazynowego przy prośbach.`
            : ""
        }
        confirmLabel="Usuń z listy"
        danger
        pending={pending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          start(async () => {
            const result = await actionRemoveTeethProduct(deleteTarget.subiektTwId);
            if ("error" in result) {
              setToast(toastFromError(result.error));
              return;
            }
            setDeleteTarget(null);
            setToast(TEETH_CATALOG_TOAST.removedFromList);
            refreshRows();
          });
        }}
      />

      <div className="space-y-5">
        <Alert tone="info">
          Produkty z tej listy <strong>nie przechodzą kontroli stanu magazynowego</strong> przy
          składaniu prośby o zamówienie — bez ostrzeżeń „towar na stanie” i bez blokady zapisu.
          Identyfikator <code className="text-xs">tw_Id</code> pochodzi z Subiekta.
          <p className="mt-2 text-sm leading-relaxed">
            Aby handlowiec mógł zamawiać przody i boki z jednego okna, zarejestruj oba towary
            Subiekta tej samej linii produktowej — jeden jako Przednie, drugi jako Boczne.
          </p>
        </Alert>

        <section className="rounded-md border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className={panelTypography.rowTitle}>Dodaj z Subiekta</h2>
              <p className={cn(panelTypography.rowMeta, "mt-1 max-w-2xl")}>
                Wyszukaj towar po symbolu, nazwie lub kodzie PLU / kreskowym — dane wczytują się
                bezpośrednio z kartoteki Subiekta.
              </p>
            </div>
            <Badge variant="purple" className="mt-1 w-fit shrink-0">
              {rows.length} na liście
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Field label="Szukaj w Subiekcie">
              <Input
                value={searchQuery}
                onChange={(event) => {
                  const next = event.target.value;
                  setSearchQuery(next);
                  setSelectedHit(null);
                  if (searchDebounceRef.current !== null) {
                    window.clearTimeout(searchDebounceRef.current);
                    searchDebounceRef.current = null;
                  }
                  const trimmed = next.trim();
                  if (trimmed.length < 2) {
                    setSearchHits([]);
                    setSearchError(null);
                    setDebouncedSearchQuery("");
                    setResolvedSearchQuery("");
                    return;
                  }
                  searchDebounceRef.current = window.setTimeout(() => {
                    searchDebounceRef.current = null;
                    setDebouncedSearchQuery(trimmed);
                  }, 350);
                }}
                placeholder="Symbol, nazwa, PLU…"
                autoComplete="off"
              />
            </Field>

            <div className="rounded-md border border-slate-200/80 bg-slate-50/60 p-3">
              {trimmedSearchQuery.length < 2 ? (
                <p className={cn(panelTypography.rowMeta, "text-slate-500")}>
                  Wpisz co najmniej 2 znaki, aby zobaczyć wyniki.
                </p>
              ) : visibleSearchLoading ? (
                <p className={cn(panelTypography.rowMeta, "text-slate-500")}>Szukam w Subiekcie…</p>
              ) : visibleSearchError ? (
                <p className="text-sm text-rose-700">{visibleSearchError}</p>
              ) : visibleSearchHits.length === 0 ? (
                <p className={cn(panelTypography.rowMeta, "text-slate-500")}>
                  Brak nowych wyników — sprawdź frazę lub czy towar nie jest już na liście.
                </p>
              ) : (
                <ul className="max-h-52 space-y-1 overflow-y-auto">
                  {visibleSearchHits.map((hit) => {
                    const active = selectedHit?.subiektTwId === hit.subiektTwId;
                    return (
                      <li key={hit.subiektTwId}>
                        <button
                          type="button"
                          onClick={() => setSelectedHit(hit)}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                            active
                              ? "border-violet-300 bg-violet-50/80 text-violet-950"
                              : "border-transparent bg-white hover:border-slate-200 hover:bg-white"
                          )}
                        >
                          <span className="font-medium">{productLabel(hit)}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            tw_Id {hit.subiektTwId}
                            {hit.plu ? ` · ${hit.plu}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {selectedHit ? (
            <div className="mt-4 rounded-md border border-violet-200/80 bg-violet-50/35 p-4">
              <p className="text-sm font-semibold text-violet-950">{productLabel(selectedHit)}</p>
              <p className="mt-1 text-xs text-violet-900/80">
                Zostanie dodany jako produkt z wyłączoną kontrolą stanu magazynowego.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Producent" hint="Określa paletę kolorów/wzorów w formularzu prośby.">
                  <select
                    value={addManufacturer}
                    onChange={(event) => setAddManufacturer(event.target.value)}
                    className={fieldControlClass()}
                  >
                    <option value="">— wybierz —</option>
                    {TEETH_MANUFACTURERS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Typ zęba" hint="Przednie czy boczne. Auto-wykrywane z nazwy.">
                  <select
                    value={addKind}
                    onChange={(event) => setAddKind(event.target.value)}
                    className={fieldControlClass()}
                  >
                    <option value="">— auto —</option>
                    <option value="anterior">{TEETH_KIND_LABELS.anterior}</option>
                    <option value="posterior">{TEETH_KIND_LABELS.posterior}</option>
                  </select>
                  {selectedHit && !addKind && detectTeethKind(selectedHit.name) ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Wykryto: {TEETH_KIND_LABELS[detectTeethKind(selectedHit.name)!]}
                    </p>
                  ) : null}
                </Field>
                <Field label="Notatka (opcjonalnie)" hint="Dla administratora — np. seria, uwagi.">
                  <textarea
                    value={addNote}
                    onChange={(event) => setAddNote(event.target.value)}
                    rows={2}
                    maxLength={500}
                    className={fieldControlClass()}
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={addProduct}>
                  Dodaj do listy zębów
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setSelectedHit(null);
                    setAddNote("");
                  }}
                >
                  Anuluj wybór
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-md border border-slate-200/90 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className={panelTypography.rowTitle}>Lista produktów zębnych</h2>
              <p className={cn(panelTypography.rowMeta, "mt-1")}>
                Zarządzaj pozycjami objętymi wyjątkiem od kontroli stanu.
              </p>
            </div>
            <Field label="Filtruj listę" className="w-full sm:w-64">
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Nazwa, symbol, tw_Id…"
                autoComplete="off"
              />
            </Field>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={rows.length ? "Brak wyników filtra" : "Lista jest pusta"}
              description={
                rows.length
                  ? "Zmień frazę wyszukiwania lub wyczyść filtr."
                  : "Dodaj pierwszy produkt wyszukując go w Subiekcie powyżej."
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const noteValue = noteDrafts[row.subiektTwId] ?? row.note;
                const noteDirty = noteValue !== row.note;
                return (
                  <li key={row.subiektTwId} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{productLabel(row)}</p>
                          <Badge variant="default">tw_Id {row.subiektTwId}</Badge>
                          {row.plu ? (
                            <span className="text-xs text-slate-500">{row.plu}</span>
                          ) : null}
                          {row.productLine ? (
                            <Badge variant="purple" className="text-[10px]">
                              {teethProductLineLabel(row.productLine)}
                            </Badge>
                          ) : null}
                          {row.manufacturer ? (
                            <Badge variant="default" className="text-[10px]">
                              {teethManufacturerLabel(row.manufacturer)}
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px]">
                              Producent nieustalony
                            </Badge>
                          )}
                          {row.kind ? (
                            <Badge variant="info" className="text-[10px]">
                              {TEETH_KIND_LABELS[row.kind]}
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-[10px]">
                              Typ nieustalony
                            </Badge>
                          )}
                        </div>
                        <div
                          className={cn(
                            "mt-2 inline-flex rounded-md border px-2.5 py-1 text-xs font-medium",
                            prosbaLineStockShellClass("slate")
                          )}
                        >
                          Bez kontroli stanu magazynowego w prośbach
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <Field label="Producent">
                            <select
                              value={manufacturerDrafts[row.subiektTwId] ?? row.manufacturer ?? ""}
                              onChange={(event) => {
                                const manufacturer = event.target.value;
                                setManufacturerDrafts((prev) => ({
                                  ...prev,
                                  [row.subiektTwId]: manufacturer,
                                }));
                                const lines = manufacturer
                                  ? teethLinesForManufacturer(manufacturer as TeethManufacturer)
                                  : [];
                                if (lines.length === 1) {
                                  setProductLineDrafts((prev) => ({
                                    ...prev,
                                    [row.subiektTwId]: lines[0]!.id,
                                  }));
                                }
                              }}
                              onBlur={() => saveManufacturer(row)}
                              className={fieldControlClass()}
                            >
                              <option value="">— brak —</option>
                              {TEETH_MANUFACTURERS.map((m) => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Linia produktowa">
                            <select
                              value={productLineDrafts[row.subiektTwId] ?? row.productLine ?? ""}
                              onChange={(event) =>
                                setProductLineDrafts((prev) => ({
                                  ...prev,
                                  [row.subiektTwId]: event.target.value,
                                }))
                              }
                              onBlur={() => saveProductLine(row)}
                              className={fieldControlClass()}
                              disabled={!((manufacturerDrafts[row.subiektTwId] ?? row.manufacturer) as string)}
                            >
                              <option value="">— auto z nazwy —</option>
                              {teethLinesForManufacturer(
                                (manufacturerDrafts[row.subiektTwId] ?? row.manufacturer ?? "ivoclar") as TeethManufacturer,
                              ).map((line) => (
                                <option key={line.id} value={line.id}>{line.label}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Typ zęba">
                            <select
                              value={kindDrafts[row.subiektTwId] ?? row.kind ?? ""}
                              onChange={(event) =>
                                setKindDrafts((prev) => ({
                                  ...prev,
                                  [row.subiektTwId]: event.target.value,
                                }))
                              }
                              onBlur={() => saveKind(row)}
                              className={fieldControlClass()}
                            >
                              <option value="">— brak —</option>
                              <option value="anterior">{TEETH_KIND_LABELS.anterior}</option>
                              <option value="posterior">{TEETH_KIND_LABELS.posterior}</option>
                            </select>
                          </Field>
                          <Field label="Notatka">
                            <textarea
                              value={noteValue}
                              onChange={(event) =>
                                setNoteDrafts((prev) => ({
                                  ...prev,
                                  [row.subiektTwId]: event.target.value,
                                }))
                              }
                              onBlur={() => saveNote(row)}
                              rows={2}
                              maxLength={500}
                              className={fieldControlClass()}
                            />
                          </Field>
                        </div>
                        {noteDirty ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            disabled={pending}
                            onClick={() => saveNote(row)}
                          >
                            Zapisz notatkę
                          </Button>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50"
                        disabled={pending}
                        onClick={() => setDeleteTarget(row)}
                      >
                        Usuń z listy
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
