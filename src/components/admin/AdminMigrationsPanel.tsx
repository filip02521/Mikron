"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { NoticeToast } from "@/components/ui/NoticeToast";
import type { ToastNotice } from "@/lib/ui/notice-copy";
import { adminPanelNotice } from "@/lib/ui/notice-copy";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import {
  actionGetMigrationStatus,
  actionApplyMigration,
  actionApplyAllPendingMigrations,
  actionMarkMigrationApplied,
  actionMarkMigrationsAppliedUpTo,
} from "@/app/actions/admin-migrations";
import type {
  MigrationStatus,
  MigrationApplyResult,
} from "@/lib/db/migrations";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Alert } from "@/components/ui/Alert";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";

export function AdminMigrationsPanel() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, MigrationApplyResult>>({});
  const [pending, startTransition] = useTransition();
  const [, startRefresh] = useTransition();

  const dismiss = useCallback(() => setToast(null), []);
  const notify = (text: string, tone: "success" | "error" = "success") =>
    setToast(adminPanelNotice(text, tone, "Migracje bazy"));

  const refresh = useCallback(() => {
    startRefresh(async () => {
      setError(null);
      try {
        const s = await actionGetMigrationStatus();
        setStatus(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nie udało się pobrać statusu");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  // Początkowe ładowanie — w effect, nie w renderze.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpand = (filename: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const handleApplyOne = (filename: string) => {
    startTransition(async () => {
      try {
        const r = await actionApplyMigration(filename);
        setResults((prev) => ({ ...prev, [filename]: r }));
        if (r.success) {
          notify(`Zastosowano: ${filename} (${r.statementsApplied} instrukcji)`);
        } else {
          notify(`Błąd migracji ${filename}: ${r.error ?? "nieznany"}`, "error");
        }
        await refresh();
      } catch (err) {
        notify(
          `Błąd migracji ${filename}: ${err instanceof Error ? err.message : "nieznany"}`,
          "error",
        );
      }
    });
  };

  const handleApplyAll = () => {
    startTransition(async () => {
      try {
        const rs = await actionApplyAllPendingMigrations();
        const newResults: Record<string, MigrationApplyResult> = {};
        for (const r of rs) newResults[r.filename] = r;
        setResults((prev) => ({ ...prev, ...newResults }));
        const ok = rs.filter((r) => r.success).length;
        const fail = rs.filter((r) => !r.success).length;
        if (fail === 0) {
          notify(`Zastosowano ${ok} migracji`);
        } else {
          notify(`Zastosowano ${ok}, błędy: ${fail}`, "error");
        }
        await refresh();
      } catch (err) {
        notify(
          `Błąd: ${err instanceof Error ? err.message : "nieznany"}`,
          "error",
        );
      }
    });
  };

  const handleMarkOne = (filename: string) => {
    startTransition(async () => {
      try {
        await actionMarkMigrationApplied(filename);
        notify(`Oznaczono jako wykonaną: ${filename}`);
        await refresh();
      } catch (err) {
        notify(
          `Błąd: ${err instanceof Error ? err.message : "nieznany"}`,
          "error",
        );
      }
    });
  };

  const handleMarkUpTo = (maxPrefix: number) => {
    startTransition(async () => {
      try {
        const { marked } = await actionMarkMigrationsAppliedUpTo(maxPrefix);
        if (marked.length > 0) {
          notify(`Oznaczono ${marked.length} migracji (do ${maxPrefix}) jako wykonane`);
        } else {
          notify(`Wszystkie migracje do ${maxPrefix} już były oznaczone`);
        }
        await refresh();
      } catch (err) {
        notify(
          `Błąd: ${err instanceof Error ? err.message : "nieznany"}`,
          "error",
        );
      }
    });
  };

  const pendingCount = status?.pending.length ?? 0;
  const hasPending = pendingCount > 0;

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Migracje bazy danych"
          description="Wykrywanie i stosowanie oczekujących migracji z supabase/migrations/."
          action={
            <Badge variant={hasPending ? "warning" : "success"}>
              {hasPending ? `${pendingCount} oczekuje` : "Aktualna"}
            </Badge>
          }
        />

        <div className="space-y-4 px-3 py-4 sm:px-4 lg:px-5">
          <AdminMetrics
            items={[
              { label: "Zastosowane", value: status?.appliedCount ?? "-" },
              { label: "Oczekujące", value: pendingCount, tone: hasPending ? "warning" : "default" },
              { label: "Pliki w repo", value: status?.totalFiles ?? "-" },
            ]}
          />

          {/* Inicjalizacja — oznacz migracje do 150 jako wykonane */}
          {!loading && !error && (status?.appliedCount ?? 0) === 0 && hasPending ? (
            <Alert tone="warning" title="Pierwsza konfiguracja na tej bazie">
              <p>
                Jeśli baza została założona ręcznie (migracje 1-150 już są w schemacie),
                oznacz je jako wykonane bez wykonywania SQL. Potem tylko nowe migracje
                będą faktycznie aplikowane.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleMarkUpTo(150)}
                >
                  Oznacz 1-150 jako wykonane
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleMarkUpTo(152)}
                >
                  Oznacz 1-152 jako wykonane
                </Button>
              </div>
            </Alert>
          ) : null}

          {/* Ładowanie / błąd */}
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-500" role="status">
              <BrandLoader size="sm" tile={false} />
              Sprawdzanie statusu migracji…
            </div>
          ) : null}

          {error ? (
            <Alert tone="error" title="Nie udało się pobrać statusu migracji">
              <p>{userFacingErrorTextFromMessage(error)}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => void refresh()}
              >
                Spróbuj ponownie
              </Button>
            </Alert>
          ) : null}

          {/* Brak oczekujących */}
          {!loading && !error && !hasPending ? (
            <p className="text-sm text-slate-600">
              Wszystkie migracje z repo są zastosowane. Po nowym pull z GitHub sprawdź
              ponownie - nowe pliki pojawią się tutaj.
            </p>
          ) : null}

          {/* Lista oczekujących */}
          {!loading && !error && hasPending ? (
            <div className="space-y-2">
              {/* Przycisk Zastosuj wszystkie */}
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={pending}
                  onClick={handleApplyAll}
                >
                  {pending ? (
                    <>
                      <Spinner size="sm" />
                      Stosowanie…
                    </>
                  ) : (
                    `Zastosuj wszystkie (${pendingCount})`
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => void refresh()}
                >
                  Odśwież
                </Button>
              </div>

              {/* Lista migracji */}
              <ul className="divide-y divide-slate-100 border-y border-slate-100">
                {(status?.pending ?? []).map((m) => {
                  const isExpanded = expanded.has(m.filename);
                  const result = results[m.filename];
                  return (
                    <li key={m.filename} className="py-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 break-all font-mono text-xs font-medium text-slate-900">
                              {m.filename}
                            </p>
                            {result ? (
                              result.success ? (
                                <Badge variant="success">OK</Badge>
                              ) : (
                                <Badge variant="danger">Błąd</Badge>
                              )
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {Math.ceil(m.size / 1024)} kB
                          </p>
                          {result && !result.success && result.error ? (
                            <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-red-50/60 px-2 py-1.5 text-xs text-red-800 whitespace-pre-wrap break-words">
                              {result.error}
                            </pre>
                          ) : null}
                          {result && result.success && result.statementsApplied > 0 ? (
                            <p className="mt-1 text-xs text-emerald-700">
                              Zastosowano {result.statementsApplied} instrukcji SQL
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={pending}
                            onClick={() => toggleExpand(m.filename)}
                          >
                            {isExpanded ? "Ukryj" : "Podgląd"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={pending}
                            onClick={() => handleMarkOne(m.filename)}
                          >
                            Oznacz wykonaną
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => handleApplyOne(m.filename)}
                          >
                            {pending ? (
                              <>
                                <Spinner size="sm" />
                                …
                              </>
                            ) : (
                              "Zastosuj"
                            )}
                          </Button>
                        </div>
                      </div>
                      {isExpanded ? (
                        <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-50/80 px-2 py-1.5 text-xs text-slate-700 whitespace-pre-wrap break-words">
                          {m.preview}
                          {m.size > 500 ? "\n… (obcięto)" : ""}
                        </pre>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <p className={cn(panelTypography.caption, "text-slate-500")}>
                Migracje stosowane są w transakcji - błąd wycofuje zmiany. Plik oznaczony
                jako błąd można poprawić i zastosować ponownie po usunięciu z
                schema_migrations.
              </p>
            </div>
          ) : null}
        </div>
      </Card>
    </>
  );
}
