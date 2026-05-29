"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  ProductCatalogCoverageStats,
  ProductCatalogPage,
  ProductCatalogRow,
} from "@/lib/data/product-catalog-queries";
import { CatalogZdSyncStatusPanel } from "@/components/admin/CatalogZdSyncStatusPanel";
import { ZdUnmappedKhPanel } from "@/components/admin/ZdUnmappedKhPanel";
import type { ZdUnmappedKhReport } from "@/lib/subiekt/zd-unmapped-kh";
import { ProductCatalogSupplierAssign } from "@/components/admin/ProductCatalogSupplierAssign";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  actionBackfillOrdersSubiektTwIdFromSymbol,
  actionRebuildProductCatalogFromOrders,
  actionAssignProductSupplier,
  actionCountProductCatalogCoverage,
  actionFetchProductCatalogPage,
  actionContinueCatalogZdSync,
  actionFetchProductsWithoutSupplierPage,
  actionSearchProductCatalogPage,
  actionSearchProductsWithoutSupplierPage,
  actionSupplierProductLinkStats,
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
  actionListZdUnmappedKh,
  actionReadZdImportAllSuppliersJob,
  actionStartZdImportAllSuppliersJob,
  actionStopZdImportAllSuppliersJob,
  actionTickZdImportAllSuppliersJob,
  actionReadCatalogZdSyncStatus,
  actionRunCatalogZdSyncNow,
} from "@/app/actions/product-catalog";

type CatalogListMode = "all" | "noSupplier";

export function ProductsCatalogAdminClient({
  initial,
  coverage: initialCoverage,
  suppliers,
  assignSuppliers,
}: {
  initial: ProductCatalogPage;
  coverage: ProductCatalogCoverageStats;
  suppliers: Array<{ id: string; name: string; subiekt_kh_id: number }>;
  assignSuppliers: Array<{ id: string; name: string; subiektKhId: number | null }>;
}) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [rows, setRows] = useState<ProductCatalogRow[]>(initial.rows);
  const [total, setTotal] = useState<number>(initial.total);
  const [loaded, setLoaded] = useState<number>(initial.rows.length);
  const pageSize = initial.limit;
  const [filter, setFilter] = useState("");
  const [listMode, setListMode] = useState<CatalogListMode>("all");
  const [coverage, setCoverage] = useState<ProductCatalogCoverageStats>(initialCoverage);
  const [importSupplierId, setImportSupplierId] = useState<string>(suppliers[0]?.id ?? "");
  const [importState, setImportState] = useState<any | null>(null);
  const [importRunning, setImportRunning] = useState(false);
  const tickTimer = useRef<number | null>(null);
  const [catalogSync, setCatalogSync] = useState<{
    state: import("@/lib/subiekt/catalog-zd-sync").CatalogZdSyncState | null;
    lastCron: import("@/lib/services/cron-run-log").CronRunPayload | null;
  } | null>(null);
  const [indexState, setIndexState] = useState<any | null>(null);
  const [zdUnmapped, setZdUnmapped] = useState<ZdUnmappedKhReport | null>(null);
  const zdUnmappedFetchRef = useRef(false);
  const [indexRunning, setIndexRunning] = useState(false);
  const indexTimer = useRef<number | null>(null);
  const [allState, setAllState] = useState<any | null>(null);
  const [allRunning, setAllRunning] = useState(false);
  const allTimer = useRef<number | null>(null);
  const [zdMonthsBack, setZdMonthsBack] = useState<number>(60);
  const [indexMonthsBack, setIndexMonthsBack] = useState<number>(60);
  const MONTHS_OPTIONS = [30, 60, 120, 240] as const;
  const [supplierStats, setSupplierStats] = useState<Array<{
    id: string;
    name: string;
    subiekt_kh_id: number;
    linksTotal: number;
    linksZdImport: number;
  }> | null>(null);

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

  const refreshCatalogSync = () => {
    start(async () => {
      try {
        const data = await actionReadCatalogZdSyncStatus();
        setCatalogSync(data);
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd odczytu synchronizacji nocnej",
          tone: "error",
        });
      }
    });
  };

  const refreshCoverage = () => {
    start(async () => {
      try {
        const next = await actionCountProductCatalogCoverage();
        setCoverage(next);
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd liczenia produktów bez dostawcy",
          tone: "error",
        });
      }
    });
  };

  const runCatalogSync = (mode: "continue" | "test" | "reset") => {
    start(async () => {
      try {
        const result =
          mode === "continue"
            ? await actionContinueCatalogZdSync()
            : await actionRunCatalogZdSyncNow({ reset: mode === "reset" });
        refreshCatalogSync();
        const s = result.state;
        const label =
          mode === "continue" ? "Kontynuacja" : mode === "reset" ? "Restart" : "Przebieg";
        setToast({
          text: result.skipped
            ? "Synchronizacja na dziś już zakończona (użyj restartu, aby zacząć od nowa)."
            : result.timedOut
              ? `${label} (limit czasu) — indeks: ${s.indexProcessed}, import ZD: ${s.importProcessedDocs}, auto-przypisanie: ${s.autoAssignUpdated}`
              : `${label}: ${s.status} — indeks: ${s.indexProcessed}, import: ${s.importProcessedDocs}, auto-przypisanie: ${s.autoAssignUpdated}`,
          tone: result.ok || result.skipped ? "success" : "error",
        });
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd synchronizacji",
          tone: "error",
        });
      }
    });
  };

  const refreshZdUnmapped = () => {
    if (zdUnmappedFetchRef.current) return;
    zdUnmappedFetchRef.current = true;
    start(async () => {
      try {
        const report = await actionListZdUnmappedKh();
        setZdUnmapped(report);
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd listy kontrahentów bez dostawcy",
          tone: "error",
        });
      } finally {
        zdUnmappedFetchRef.current = false;
      }
    });
  };

  const refreshIndexState = () => {
    start(async () => {
      try {
        const state = await actionReadZdIndexJob();
        setIndexState(state);
        if (state?.status !== "running") {
          stopIndexLoop();
        }
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
    refreshCatalogSync();
    refreshImportState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importSupplierId]);

  useEffect(() => {
    refreshIndexState();
    refreshAllState();
    return () => {
      stopIndexLoop();
      stopTickLoop();
      stopAllLoop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSupplierStats = () => {
    start(async () => {
      try {
        const stats = await actionSupplierProductLinkStats();
        setSupplierStats(stats);
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd odczytu statystyk dostawców", tone: "error" });
      }
    });
  };

  // Uwaga: statystyki per-dostawca mogą być kosztowne (wiele zapytań),
  // więc odpalamy je wyłącznie ręcznie po kliknięciu.

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = rows;
    if (listMode === "noSupplier") {
      list = list.filter((r) => !r.topSupplier);
    }
    if (!q) return list;
    return list.filter((r) => {
      const parts = [
        String(r.subiektTwId),
        r.symbol ?? "",
        r.name ?? "",
        r.plu ?? "",
        r.note ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return parts.includes(q);
    });
  }, [rows, filter, listMode]);

  const canLoadMore = loaded < total;

  const switchListMode = (mode: CatalogListMode) => {
    setListMode(mode);
    setRows([]);
    setLoaded(0);
    setTotal(0);
  };

  // Server-side search po całej bazie (nie tylko po wczytanych 250).
  useEffect(() => {
    const q = filter.trim();

    const loadNoSupplier = async () => {
      if (!q) {
        const page = await actionFetchProductsWithoutSupplierPage({ limit: pageSize, offset: 0 });
        setRows(page.rows);
        setTotal(page.total);
        setLoaded(page.rows.length);
        return;
      }
      const page = await actionSearchProductsWithoutSupplierPage({
        query: q,
        limit: pageSize,
        offset: 0,
      });
      setRows(page.rows);
      setTotal(page.total);
      setLoaded(page.rows.length);
    };

    const loadAll = async () => {
      if (!q) {
        const page = await actionFetchProductCatalogPage({ limit: pageSize, offset: 0 });
        setRows(page.rows);
        setTotal(page.total);
        setLoaded(page.rows.length);
        return;
      }
      const page = await actionSearchProductCatalogPage({ query: q, limit: pageSize, offset: 0 });
      setRows(page.rows);
      setTotal(page.total);
      setLoaded(page.rows.length);
    };

    const run = () => {
      start(async () => {
        try {
          if (listMode === "noSupplier") await loadNoSupplier();
          else await loadAll();
        } catch (e) {
          setToast({
            text: e instanceof Error ? e.message : "Błąd pobierania listy",
            tone: "error",
          });
        }
      });
    };

    if (!q) {
      run();
      return;
    }

    const t = window.setTimeout(run, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, listMode]);

  const loadMore = () => {
    if (!canLoadMore) return;
    start(async () => {
      try {
        const q = filter.trim();
        let next: ProductCatalogPage;
        if (listMode === "noSupplier") {
          next = q
            ? await actionSearchProductsWithoutSupplierPage({
                query: q,
                limit: pageSize,
                offset: loaded,
              })
            : await actionFetchProductsWithoutSupplierPage({
                limit: pageSize,
                offset: loaded,
              });
        } else {
          next = q
            ? await actionSearchProductCatalogPage({ query: q, limit: pageSize, offset: loaded })
            : await actionFetchProductCatalogPage({ limit: pageSize, offset: loaded });
        }
        setRows((prev) => [...prev, ...next.rows]);
        setTotal(next.total);
        setLoaded((prev) => prev + next.rows.length);
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd pobierania", tone: "error" });
      }
    });
  };

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

  // ...rest of component continues...
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
        const s = await actionStartZdIndexJob({ monthsBack: indexMonthsBack });
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
      const indexFinished =
        s?.status === "done" || s?.status === "failed" || s?.status === "idle";
      if (indexFinished) {
        stopIndexLoop();
        if (zdUnmapped != null) {
          refreshZdUnmapped();
        }
      }
    } catch (e) {
      stopIndexLoop();
      setToast({ text: e instanceof Error ? e.message : "Błąd tick indeksu", tone: "error" });
    }
  };

  const startAll = () => {
    start(async () => {
      try {
        const s = await actionStartZdImportAllSuppliersJob({ monthsBack: zdMonthsBack, batchDocs: 3 });
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

  const assignSupplier = (subiektTwId: number, supplierId: string) => {
    start(async () => {
      try {
        const { row, autoAssign } = await actionAssignProductSupplier(subiektTwId, supplierId);
        setRows((prev) => {
          if (listMode === "noSupplier") {
            return prev.filter((r) => r.subiektTwId !== subiektTwId);
          }
          return prev.map((r) => (r.subiektTwId === subiektTwId ? row : r));
        });
        if (listMode === "noSupplier") {
          setTotal((t) => Math.max(0, t - 1));
          setLoaded((n) => Math.max(0, n - 1));
        }
        refreshCoverage();
        const extra =
          autoAssign.updated > 0
            ? ` · uzupełniono ${autoAssign.updated} prośb w weryfikacji`
            : "";
        setToast({
          text: `Przypisano dostawcę: ${row.topSupplier?.name ?? "—"}${extra}.`,
          tone: "success",
        });
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd przypisania dostawcy",
          tone: "error",
        });
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
        description="Źródło: historia prośb + weryfikacja zakupów + import z ZD (nocny cron na serwerze w firmie). Każdy produkt to Subiekt tw_Id."
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
        <CatalogZdSyncStatusPanel
          catalogSync={catalogSync}
          pending={pending}
          onRefresh={refreshCatalogSync}
          onRunNow={() => runCatalogSync("test")}
          onContinue={() => runCatalogSync("continue")}
          onReset={() => runCatalogSync("reset")}
          syncRunning={catalogSync?.state?.status === "running"}
        />

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Indeks ZD → dostawca</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Jednorazowo przechodzi po wszystkich ZD i przypisuje numer dokumentu do dostawcy (główne i dodatkowe `kh_Id` w kartotece dostawcy).
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem]">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Zakres (mies. wstecz)
              </label>
              <Select
                value={String(indexMonthsBack)}
                onChange={(e) => setIndexMonthsBack(Number(e.target.value))}
              >
                {MONTHS_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} miesięcy
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-[11px] text-slate-500">
              Większy zakres = więcej ZD do przypisania do dostawców.
            </p>
          </div>

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

          <ZdUnmappedKhPanel
            report={zdUnmapped}
            loading={pending}
            onRefresh={refreshZdUnmapped}
          />

          <hr className="my-4 border-slate-200" />

          <p className="text-sm font-semibold text-slate-900">Dostawcy bez mapowań produktów</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Lista dostawców z `subiekt_kh_id`, którzy mają 0 wpisów w `product_supplier_links`.
            Użyj tego, żeby szybko ponowić import dla konkretnego dostawcy.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={refreshSupplierStats} disabled={pending}>
              Sprawdź teraz
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {supplierStats == null ? (
              <p className="text-xs text-slate-600">
                Kliknij <span className="font-medium">Sprawdź teraz</span>, żeby policzyć dostawców bez mapowań.
              </p>
            ) : (supplierStats ?? []).filter((s) => (s.linksTotal ?? 0) === 0).length === 0 ? (
              <p className="text-xs text-slate-600">Brak — każdy dostawca ma już jakieś mapowania.</p>
            ) : (
              (supplierStats ?? [])
                .filter((s) => (s.linksTotal ?? 0) === 0)
                .map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        kh_Id {s.subiekt_kh_id} · linki: 0 · z ZD: {s.linksZdImport}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setImportSupplierId(s.id);
                          start(async () => {
                            try {
                              const st = await actionStartZdImportSupplierJob({ supplierId: s.id, monthsBack: 60 });
                              setImportState(st);
                              setToast({ text: `Start importu ZD dla: ${s.name}`, tone: "success" });
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
                        }}
                      >
                        Start importu (ZD)
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </div>

          <hr className="my-4 border-slate-200" />

          <p className="text-sm font-semibold text-slate-900">Autopilot: import po dostawcach</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Sam przechodzi po wszystkich dostawcach z Subiektem i importuje produkty na podstawie `subiekt_zd_index`.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem]">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Zakres (mies. wstecz)
              </label>
              <Select
                value={String(zdMonthsBack)}
                onChange={(e) => setZdMonthsBack(Number(e.target.value))}
              >
                {MONTHS_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} miesięcy
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-[11px] text-slate-500">
              Im większy zakres, tym więcej ZD i więcej unikalnych produktów (np. Ivoclar ~1000).
            </p>
          </div>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchListMode("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                listMode === "all"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Wszystkie ({coverage.totalProducts})
            </button>
            <button
              type="button"
              onClick={() => switchListMode("noSupplier")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                listMode === "noSupplier"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Bez dostawcy ({coverage.withoutSupplier})
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={refreshCoverage} disabled={pending}>
            Odśwież liczniki
          </Button>
        </div>
        {listMode === "noSupplier" ? (
          <p className="mb-2 text-xs text-amber-900/90">
            Produkty w katalogu bez wpisu w{" "}
            <span className="font-mono">product_supplier_links</span> — uzupełnij importem ZD lub
            przypisaniem przy weryfikacji prośby lub ręcznie poniżej (lista dostawców).
          </p>
        ) : null}
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Szukaj: tw_Id / symbol / nazwa / kod / dostawca / notatka…"
        />
        <p className="mt-2 text-xs text-slate-500">
          {listMode === "noSupplier" ? "Raport: bez dostawcy · " : ""}
          Pokazuję {filtered.length} z {rows.length} (wczytane: {loaded}/{total}
          {listMode === "all" ? ` · z mapą: ${coverage.withSupplier}` : ""}).
        </p>
        {canLoadMore ? (
          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={loadMore}>
              Załaduj więcej
            </Button>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100">
        <div
          className="hidden border-b border-slate-100 bg-slate-50/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_minmax(140px,180px)] lg:gap-3"
          aria-hidden
        >
          <span>Produkt</span>
          <span>Dostawca</span>
          <span>Notatka</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {filtered.map((r) => (
            <li
              key={r.subiektTwId}
              className="px-4 py-2.5 transition-colors hover:bg-slate-50/60 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_minmax(140px,180px)] lg:items-center lg:gap-3"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-2">
                  <p
                    className="min-w-0 truncate text-sm font-medium text-slate-900"
                    title={r.name ?? undefined}
                  >
                    {r.name || "—"}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500">
                    {r.subiektTwId}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500">
                  {[
                    r.symbol || null,
                    `${r.totalOrders} zlec.`,
                    r.lastActionAt ? r.lastActionAt.slice(0, 10) : null,
                    r.plu ? `PLU ${r.plu}` : null,
                    r.topSupplier
                      ? `${r.topSupplier.name} (${r.topSupplier.orderCount})`
                      : "bez dostawcy",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="mt-2 min-w-0 lg:mt-0">
                <ProductCatalogSupplierAssign
                  row={r}
                  suppliers={assignSuppliers}
                  disabled={pending}
                  onAssign={assignSupplier}
                  compact
                />
              </div>

              <div className="mt-2 min-w-0 lg:mt-0">
                <label className="sr-only" htmlFor={`note-${r.subiektTwId}`}>
                  Notatka
                </label>
                <Input
                  id={`note-${r.subiektTwId}`}
                  defaultValue={r.note}
                  placeholder="Notatka…"
                  className="h-8 text-xs"
                  onBlur={(e) => {
                    const next = e.target.value ?? "";
                    if (next !== r.note) saveNote(r.subiektTwId, next);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
        {!filtered.length ? (
          <div className="px-4 py-8 text-sm text-slate-600">Brak wyników.</div>
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

