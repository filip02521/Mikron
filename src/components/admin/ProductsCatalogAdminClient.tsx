"use client";

import { useMemo, useState, useTransition } from "react";
import type { ProductCatalogRow } from "@/lib/data/product-catalog-queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { actionRebuildProductCatalogFromOrders, actionUpdateSubiektProductNote } from "@/app/actions/product-catalog";

export function ProductsCatalogAdminClient({
  initial,
}: {
  initial: ProductCatalogRow[];
}) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [rows, setRows] = useState<ProductCatalogRow[]>(initial);
  const [filter, setFilter] = useState("");

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
            <Button variant="secondary" onClick={rebuild} disabled={pending}>
              Odbuduj z historii
            </Button>
          </div>
        }
      />

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

