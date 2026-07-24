"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import type { CarrierPhoneRow } from "@/lib/data/carrier-phones";
import { actionFetchCarrierPhonesForOperations } from "@/app/actions/carrier-phones";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import {
  IconPhone,
  IconChevronRight,
  IconSearch,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export function CarrierPhonesPageClient({
  carriers,
}: {
  carriers: WarehouseCarrierRow[];
}) {
  const [pending, start] = useTransition();
  const [phones, setPhones] = useState<CarrierPhoneRow[]>([]);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPhones = useCallback(() => {
    start(async () => {
      try {
        const data = await actionFetchCarrierPhonesForOperations();
        setPhones(data);
        setExpandedSlugs(new Set(data.map((p) => p.carrierSlug)));
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Błąd ładowania numerów");
      }
    });
  }, []);

  useEffect(() => {
    loadPhones();
  }, [loadPhones]);

  const phonesBySlug = useMemo(() => {
    const map = new Map<string, CarrierPhoneRow[]>();
    for (const p of phones) {
      const list = map.get(p.carrierSlug) ?? [];
      list.push(p);
      map.set(p.carrierSlug, list);
    }
    return map;
  }, [phones]);

  const filteredCarriers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return carriers;
    return carriers.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (phonesBySlug.get(c.slug) ?? []).some(
          (p) => p.phone.includes(q) || p.label.toLowerCase().includes(q),
        ),
    );
  }, [carriers, phonesBySlug, search]);

  const toggleExpand = (slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const expandAll = () => setExpandedSlugs(new Set(carriers.map((c) => c.slug)));
  const collapseAll = () => setExpandedSlugs(new Set());

  const totalPhones = phones.length;
  const activeCarriers = carriers.filter((c) => c.isActive).length;
  const allExpanded = filteredCarriers.length > 0 && filteredCarriers.every((c) => expandedSlugs.has(c.slug));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
            <IconTruck size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-slate-900">Kurierzy</h1>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {totalPhones}{" "}
              {totalPhones === 1
                ? "numer"
                : totalPhones >= 2 && totalPhones <= 4
                  ? "numery"
                  : "numerów"}{" "}
              · {activeCarriers} aktywnych
            </p>
          </div>
        </div>
        {filteredCarriers.length > 1 ? (
          <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          >
            {allExpanded ? "Zwiń wszystkie" : "Rozwiń wszystkie"}
          </button>
        ) : null}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300">
          <IconSearch size={16} aria-hidden />
        </span>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj kuriera lub numeru telefonu…"
          className="h-10 pl-10 text-[13px]"
        />
      </div>

      {loadError ? (
        <Alert tone="warning">{loadError}. Spróbuj odświeżyć stronę.</Alert>
      ) : null}

      {/* Loading */}
      {pending && phones.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      ) : filteredCarriers.length === 0 ? (
        <EmptyState
          title="Brak kurierów"
          description={search ? "Brak wyników dla tej frazy." : "Brak zdefiniowanych kurierów."}
        />
      ) : (
        <div className="space-y-1.5">
          {filteredCarriers.map((carrier) => {
            const isExpanded = expandedSlugs.has(carrier.slug);
            const carrierPhones = phonesBySlug.get(carrier.slug) ?? [];
            const hasPhones = carrierPhones.length > 0;

            return (
              <div
                key={carrier.slug}
                className={cn(
                  "overflow-hidden rounded-xl border transition-all duration-200",
                  isExpanded
                    ? "border-slate-300 bg-white shadow-sm"
                    : "border-slate-200/80 bg-white hover:border-slate-300",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(carrier.slug)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/40"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                      isExpanded
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400 group-hover:text-slate-500",
                    )}
                  >
                    <span className={cn("transition-transform duration-200", isExpanded ? "rotate-90" : "rotate-0")}>
                      <IconChevronRight size={16} aria-hidden />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">
                      {carrier.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {hasPhones
                        ? `${carrierPhones.length} ${carrierPhones.length === 1 ? "numer" : carrierPhones.length >= 2 && carrierPhones.length <= 4 ? "numery" : "numerów"}`
                        : "Brak numerów"}
                    </p>
                  </div>
                  {!carrier.isActive ? (
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                      Nieaktywny
                    </span>
                  ) : hasPhones ? (
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-500">
                      <IconPhone size={12} aria-hidden />
                    </span>
                  ) : null}
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-100">
                    {hasPhones ? (
                      <ul className="divide-y divide-slate-50">
                        {carrierPhones.map((phone) => (
                          <li key={phone.id}>
                            <div className="group/phone flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/50">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                <IconPhone size={14} aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold tabular-nums tracking-wide text-slate-800">
                                  {phone.phone}
                                </p>
                                {phone.label ? (
                                  <p className="mt-0.5 text-[11px] text-slate-400">{phone.label}</p>
                                ) : null}
                              </div>
                              <a
                                href={`tel:${phone.phone.replace(/\s+/g, "")}`}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-50 px-3.5 py-2 text-[12px] font-bold text-indigo-600 transition-all hover:bg-indigo-100 hover:text-indigo-700 active:scale-[0.97]"
                              >
                                <IconPhone size={13} aria-hidden />
                                Zadzwoń
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-3.5 text-[12px] text-slate-400">
                        Brak zapisanych numerów dla tego kuriera.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
