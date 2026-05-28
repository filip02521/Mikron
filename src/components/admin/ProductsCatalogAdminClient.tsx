"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ProductCatalogRow } from "@/lib/data/product-catalog-queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  actionBackfillOrdersSubiektTwIdFromSymbol,
  actionRebuildProductCatalogFromOrders,
  actionUpdateSubiektProductNote,
  actionReadZdImportSupplierJob,
  actionStartZdImportSupplierJob,
  actionStopZdImportSupplierJob,
  actionTickZdImportSupplierJob,
  actionCleanupZdImportForSupplier,
  actionReadZdIndexJob,
  actionStartZdIndexJob,
  actionStopZdIndexJob,
  actionTickZdIndexJob,
  actionReadZdImportAllSuppliersJob,
  actionStartZdImportAllSuppliersJob,
  actionStopZdImportAllSuppliersJob,
  actionTickZdImportAllSuppliersJob,
} from "@/app/actions/product-catalog";

export function ProductsCatalogAdminClient({
  initial,
  suppliers,
}: {
  initial: ProductCatalogRow[];
  suppliers: Array<{ id: string; name: string; subiekt_kh_id: number }>;
}) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [rows, setRows] = useState<ProductCatalogRow[]>(initial);
  const [filter, setFilter] = useState("");
  const [importSupplierId, setImportSupplierId] = useState<string>(suppliers[0]?.id ?? "");
  const [importState, setImportState] = useState<any | null>(null);
  const [importRunning, setImportRunning] = useState(false);
  const tickTimer = useRef<number | null>(null);
  const [indexState, setIndexState] = useState<any | null>(null);
  const [indexRunning, setIndexRunning] = useState(false);
  const indexTimer = useRef<number | null>(null);
  const [allState, setAllState] = useState<any | null>(null);
  const [allRunning, setAllRunning] = useState(false);
  const allTimer = useRef<number | null>(null);

  const stopTickLoop = () => {
    if (tickTimer.current != null) {
      window.clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
    setImportRunning(false);
  };

  const stopIndexLoop = () => {
    if (indexTimer.current != null) {
      window.clearInterval(indexTimer.current);
      indexTimer.current = null;
    }
    setIndexRunning(false);
  };

  const stopAllLoop = () => {
    if (allTimer.current != null) {
      window.clearInterval(allTimer.current);
      allTimer.current = null;
    }
    setAllRunning(false);
  };

  const refreshImportState = () => {
    if (!importSupplierId) return;
    start(async () => {
      try {
        const state = await actionReadZdImportSupplierJob(importSupplierId);
        setImportState(state);
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd odczytu joba", tone: "error" });
      }
    });
  };

  const refreshIndexState = () => {
    start(async () => {
      try {
        const state = await actionReadZdIndexJob();
        setIndexState(state);
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd odczytu indeksu ZD", tone: "error" });
      }
    });
  };

  const refreshAllState = () => {
    start(async () => {
      try {
        const state = await actionReadZdImportAllSuppliersJob();
        setAllState(state);
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd odczytu autopilota", tone: "error" });
      }
    });
  };

  useEffect(() => {
    refreshImportState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importSupplierId]);

  useEffect(() => {
    refreshIndexState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshAllState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const parts = [
        String(r.subiektTwId),
        r.symbol ?? "",
        r.name ?? "",
        r.plu ?? "",
        r.topSupplier?.name ?? "",
        r.note ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return parts.includes(q);
    });
  }, [rows, filter]);

  const startImport = () => {
    if (!importSupplierId) return;
    start(async () => {
      try {
        const s = await actionStartZdImportSupplierJob({ supplierId: importSupplierId, monthsBack: 18 });
        setImportState(s);
        setToast({ text: "Start importu z ZD — uruchamiam przetwarzanie…", tone: "success" });
        setImportRunning(true);
        if (tickTimer.current == null) {
          tickTimer.current = window.setInterval(() => {
            void tickImport();
          }, 1500);
        }
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd startu importu", tone: "error" });
      }
    });
  };

  const stopImport = () => {
    if (!importSupplierId) return;
    stopTickLoop();
    start(async () => {
      try {
        const s = await actionStopZdImportSupplierJob(importSupplierId);
        setImportState(s);
        setToast({ text: "Import zatrzymany.", tone: "success" });
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd zatrzymania importu", tone: "error" });
      }
    });
  };

  const cleanupImport = () => {
    if (!importSupplierId) return;
    if (
      !confirm(
        "Usunąć mapowania dodane przez import ZD dla tego dostawcy? (Naprawa po błędnym imporcie; potem uruchom Start jeszcze raz.)"
      )
    ) {
      return;
    }
    stopTickLoop();
    start(async () => {
      try {
        const res = await actionCleanupZdImportForSupplier(importSupplierId);
        setToast({
          text: `Usunięto ${res.removedLinks} mapowań z importu ZD dla wybranego dostawcy.`,
          tone: "success",
        });
        window.location.reload();
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd czyszczenia", tone: "error" });
      }
    });
  };

  const tickImport = async () => {
    if (!importSupplierId) return;
    try {
      const s = await actionTickZdImportSupplierJob({ supplierId: importSupplierId, maxDocs: 3 });
      setImportState(s);
      if (s?.status === "done" || s?.status === "failed" || s?.status === "idle") {
        stopTickLoop();
      }
    } catch (e) {
      stopTickLoop();
      setToast({ text: e instanceof Error ? e.message : "Błąd tick", tone: "error" });
    }
  };

  const startIndex = () => {
    start(async () => {
      try {
        const s = await actionStartZdIndexJob({ monthsBack: 18 });
        setIndexState(s);
        setToast({ text: "Start indeksowania ZD — uruchamiam…", tone: "success" });
        setIndexRunning(true);
        if (indexTimer.current == null) {
          indexTimer.current = window.setInterval(() => {
            void tickIndex();
          }, 1500);
        }
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd startu indeksowania", tone: "error" });
      }
    });
  };

  const stopIndex = () => {
    stopIndexLoop();
    start(async () => {
      try {
        const s = await actionStopZdIndexJob();
        setIndexState(s);
        setToast({ text: "Indeksowanie zatrzymane.", tone: "success" });
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd stop indeksowania", tone: "error" });
      }
    });
  };

  const tickIndex = async () => {
    try {
      const s = await actionTickZdIndexJob({ maxDocs: 3 });
      setIndexState(s);
      if (s?.status === "done" || s?.status === "failed" || s?.status === "idle") {
        stopIndexLoop();
      }
    } catch (e) {
      stopIndexLoop();
      setToast({ text: e instanceof Error ? e.message : "Błąd tick indeksu", tone: "error" });
    }
  };

  const startAll = () => {
    start(async () => {
      try {
        const s = await actionStartZdImportAllSuppliersJob();
        setAllState(s);
        setToast({ text: "Autopilot: start importu po dostawcach…", tone: "success" });
        setAllRunning(true);
        if (allTimer.current == null) {
          allTimer.current = window.setInterval(() => {
            void tickAll();
          }, 1500);
        }
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd startu autopilota", tone: "error" });
      }
    });
  };

  const stopAll = () => {
    stopAllLoop();
    start(async () => {
      try {
        const s = await actionStopZdImportAllSuppliersJob();
        setAllState(s);
        setToast({ text: "Autopilot zatrzymany.", tone: "success" });
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd stop autopilota", tone: "error" });
      }
    });
  };

  const tickAll = async () => {
    try {
      const s = await actionTickZdImportAllSuppliersJob();
      setAllState(s);
      if (s?.status === "done" || s?.status === "failed" || s?.status === "idle") {
        stopAllLoop();
      }
    } catch (e) {
      stopAllLoop();
      setToast({ text: e instanceof Error ? e.message : "Błąd tick autopilota", tone: "error" });
    }
  };

  const rebuild = () => {
    if (!confirm("Odbudować bazę produktów z historii individual_orders?")) return;
    start(async () => {
      try {
        const res = await actionRebuildProductCatalogFromOrders({ limit: 5000 });
        setToast({
          text: `Odbudowano: ${res.products} produktów, ${res.links} powiązań (zeskanowano ${res.scanned}). Odświeżam widok…`,
          tone: "success",
        });
        // Najprościej: pełny reload danych po stronie serwera (user może odświeżyć),
        // ale dla UX robimy szybki refresh w przeglądarce przez reload.
        window.location.reload();
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd odbudowy", tone: "error" });
      }
    });
  };

  const backfillFromSymbol = () => {
    if (
      !confirm(
        "Uzupełnić tw_Id w individual_orders po symbolu z Subiekta i dopisać mapowania? (Wymaga dostępu do Subiekta w LAN)"
      )
    ) {
      return;
    }
    start(async () => {
      try {
        const res = await actionBackfillOrdersSubiektTwIdFromSymbol({ limit: 250 });
        if (res.skippedOffline) {
          setToast({
            text: "Subiekt offline / poza LAN — nie da się teraz uzupełnić po symbolu.",
            tone: "error",
          });
          return;
        }
        setToast({
          text: `Uzupełniono: zeskanowano ${res.scanned}, zapisano tw_Id w ${res.updated}, zindeksowano ${res.indexed}. Odświeżam…`,
          tone: "success",
        });
        window.location.reload();
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd uzupełniania", tone: "error" });
      }
    });
  };

  const saveNote = (subiektTwId: number, note: string) => {
    start(async () => {
      try {
        await actionUpdateSubiektProductNote(subiektTwId, note);
        setRows((prev) =>
          prev.map((r) => (r.subiektTwId === subiektTwId ? { ...r, note } : r))
        );
        setToast({ text: "Zapisano notatkę.", tone: "success" });
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd zapisu notatki", tone: "error" });
      }
    });
  };

  return (
    <Card padding={false}>
      <CardHeader
        inset
        title="Produkty (baza własna)"
        description="Źródło: historia prośb + weryfikacja zakupów + (docelowo) import z ZD. Każdy produkt to Subiekt tw_Id."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={backfillFromSymbol} disabled={pending}>
              Uzupełnij z symbolu (Subiekt)
            </Button>
            <Button variant="secondary" onClick={rebuild} disabled={pending}>
              Odbuduj z historii
            </Button>
          </div>
        }
      />

      <div className="px-6 pb-5">
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Indeks ZD → dostawca</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Jednorazowo przechodzi po wszystkich ZD i przypisuje numer dokumentu do dostawcy w aplikacji (po `subiekt_kh_id`).
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={startIndex} disabled={pending}>
              Start indeksowania
            </Button>
            <Button variant="secondary" onClick={() => void tickIndex()} disabled={pending}>
              Tick
            </Button>
            <Button variant="secondary" onClick={stopIndex} disabled={pending}>
              Stop
            </Button>
            <Button variant="secondary" onClick={refreshIndexState} disabled={pending}>
              Odśwież status
            </Button>
          </div>

          <div className="mt-3 text-xs text-slate-700">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Status: <span className="font-semibold">{indexState?.status ?? "—"}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Strona:{" "}
                <span className="font-semibold tabular-nums">
                  {indexState?.page ?? "—"}/{indexState?.totalPages ?? "?"}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Przetw.: <span className="font-semibold tabular-nums">{indexState?.processed ?? 0}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Dopas.: <span className="font-semibold tabular-nums">{indexState?.mapped ?? 0}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Brak dost.: <span className="font-semibold tabular-nums">{indexState?.unmapped ?? 0}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Niezweryf.: <span className="font-semibold tabular-nums">{indexState?.unverifiable ?? 0}</span>
              </span>
              <span className={cn("rounded-full px-2 py-0.5", indexRunning ? "bg-indigo-50 text-indigo-900" : "bg-slate-100")}>
                Pętla: <span className="font-semibold">{indexRunning ? "ON" : "OFF"}</span>
              </span>
            </div>
            {indexState?.lastDocNumber ? (
              <p className="mt-2 text-[11px] text-slate-600">
                Ostatni dokument: <span className="font-medium">{indexState.lastDocNumber}</span> ·{" "}
                {String(indexState.lastUpdatedAt ?? "").slice(0, 19).replace("T", " ")}
              </p>
            ) : null}
            {indexState?.lastError ? (
              <p className="mt-2 text-[11px] text-red-700">Błąd: {indexState.lastError}</p>
            ) : null}
          </div>

          <hr className="my-4 border-slate-200" />

          <p className="text-sm font-semibold text-slate-900">Autopilot: import po dostawcach</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Sam przechodzi po wszystkich dostawcach z Subiektem i importuje produkty na podstawie `subiekt_zd_index`.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={startAll} disabled={pending}>
              Start autopilota
            </Button>
            <Button variant="secondary" onClick={() => void tickAll()} disabled={pending}>
              Tick
            </Button>
            <Button variant="secondary" onClick={stopAll} disabled={pending}>
              Stop
            </Button>
            <Button variant="secondary" onClick={refreshAllState} disabled={pending}>
              Odśwież status
            </Button>
          </div>
          <div className="mt-3 text-xs text-slate-700">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Status: <span className="font-semibold">{allState?.status ?? "—"}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Dostawca:{" "}
                <span className="font-semibold">
                  {allState?.supplierName ?? "—"}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Dostawcy:{" "}
                <span className="font-semibold tabular-nums">
                  {allState?.processedSuppliers ?? 0}/{allState?.supplierIds?.length ?? "?"}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Offset:{" "}
                <span className="font-semibold tabular-nums">
                  {allState?.indexOffset ?? 0}/{allState?.indexTotalDocs ?? "?"}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                ZD: <span className="font-semibold tabular-nums">{allState?.processedDocs ?? 0}</span>
              </span>
              <span className={cn("rounded-full px-2 py-0.5", allRunning ? "bg-indigo-50 text-indigo-900" : "bg-slate-100")}>
                Pętla: <span className="font-semibold">{allRunning ? "ON" : "OFF"}</span>
              </span>
            </div>
            {allState?.lastDocNumber ? (
              <p className="mt-2 text-[11px] text-slate-600">
                Ostatni dokument: <span className="font-medium">{allState.lastDocNumber}</span> ·{" "}
                {String(allState.lastUpdatedAt ?? "").slice(0, 19).replace("T", " ")}
              </p>
            ) : null}
            {allState?.lastError ? (
              <p className="mt-2 text-[11px] text-red-700">Błąd: {allState.lastError}</p>
            ) : null}
          </div>

          <hr className="my-4 border-slate-200" />

          <p className="text-sm font-semibold text-slate-900">Import z ZD (per dostawca)</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Przetwarza dokumenty ZD w Subiekcie dla wybranego dostawcy (po `kh_Id`) i zapisuje mapowania do bazy produktów.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={importSupplierId}
              onChange={(e) => {
                stopTickLoop();
                setImportSupplierId(e.target.value);
              }}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100/90 sm:max-w-[26rem]"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (kh_Id {s.subiekt_kh_id})
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={startImport} disabled={pending || !importSupplierId}>
                Start
              </Button>
              <Button variant="secondary" onClick={() => void tickImport()} disabled={pending || !importSupplierId}>
                Tick
              </Button>
              <Button variant="secondary" onClick={stopImport} disabled={pending || !importSupplierId}>
                Stop
              </Button>
              <Button variant="secondary" onClick={cleanupImport} disabled={pending || !importSupplierId}>
                Wyczyść błędny import
              </Button>
              <Button variant="secondary" onClick={refreshImportState} disabled={pending || !importSupplierId}>
                Odśwież status
              </Button>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-700">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Status: <span className="font-semibold">{importState?.status ?? "—"}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Strona:{" "}
                <span className="font-semibold tabular-nums">
                  {importState?.page ?? "—"}/{importState?.totalPages ?? "?"}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                ZD: <span className="font-semibold tabular-nums">{importState?.processedDocs ?? 0}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Offset:{" "}
                <span className="font-semibold tabular-nums">
                  {importState?.indexOffset ?? 0}/{importState?.indexTotalDocs ?? "?"}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Linie: <span className="font-semibold tabular-nums">{importState?.processedLines ?? 0}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Produkty (unikalne):{" "}
                <span className="font-semibold tabular-nums">{importState?.uniqueProductsSeen ?? 0}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Linki: <span className="font-semibold tabular-nums">{importState?.linksUpserted ?? 0}</span>
              </span>
              <span className={cn("rounded-full px-2 py-0.5", importRunning ? "bg-indigo-50 text-indigo-900" : "bg-slate-100")}>
                Pętla: <span className="font-semibold">{importRunning ? "ON" : "OFF"}</span>
              </span>
            </div>
            {importState?.lastDocNumber ? (
              <p className="mt-2 text-[11px] text-slate-600">
                Ostatni dokument: <span className="font-medium">{importState.lastDocNumber}</span> ·{" "}
                {String(importState.lastUpdatedAt ?? "").slice(0, 19).replace("T", " ")}
              </p>
            ) : null}
            {importState?.lastError ? (
              <p className="mt-2 text-[11px] text-red-700">Błąd: {importState.lastError}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-6 pb-3">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Szukaj: tw_Id / symbol / nazwa / kod / dostawca / notatka…"
        />
        <p className="mt-2 text-xs text-slate-500">
          Pokazuję {filtered.length} z {rows.length}.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {filtered.map((r) => (
          <div key={r.subiektTwId} className="px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {r.symbol ? `${r.symbol} · ` : ""}tw_Id {r.subiektTwId}
                </p>
                <p className="mt-0.5 text-sm text-slate-700">{r.name || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    Zleceń: <span className="font-semibold tabular-nums">{r.totalOrders}</span>
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    Ostatnia akcja:{" "}
                    <span className="font-semibold tabular-nums">
                      {r.lastActionAt?.slice(0, 10) ?? "—"}
                    </span>
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    PLU: <span className="font-semibold">{r.plu || "—"}</span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5",
                      r.topSupplier ? "bg-indigo-50 text-indigo-900" : "bg-slate-100"
                    )}
                  >
                    Dostawca:{" "}
                    <span className="font-semibold">
                      {r.topSupplier ? `${r.topSupplier.name} (${r.topSupplier.orderCount})` : "—"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="w-full sm:w-[22rem]">
                <label className="text-xs font-medium text-slate-600">Notatka</label>
                <textarea
                  defaultValue={r.note}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100/90"
                  rows={2}
                  onBlur={(e) => {
                    const next = e.target.value ?? "";
                    if (next !== r.note) saveNote(r.subiektTwId, next);
                  }}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Zapis automatyczny po wyjściu z pola.
                </p>
              </div>
            </div>
          </div>
        ))}
        {!filtered.length ? (
          <div className="px-6 py-8 text-sm text-slate-600">Brak wyników.</div>
        ) : null}
      </div>

      {toast ? (
        <Toast
          tone={toast.tone}
          message={toast.text}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </Card>
  );
}

