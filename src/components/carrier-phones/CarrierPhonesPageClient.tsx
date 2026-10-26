"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import type { CarrierPhoneRow } from "@/lib/data/carrier-phones";
import { actionFetchCarrierPhones } from "@/app/actions/carrier-phones";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { IconPhone, IconChevronRight, IconSearch } from "@/components/icons/StrokeIcons";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { userFacingErrorFromUnknown } from "@/lib/ui/user-facing-error";
import { redirectToLoginIfSessionError } from "@/lib/auth/session-login-redirect";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { matchesSearchWords } from "@/lib/search/keywords";

export function CarrierPhonesPageClient({
  carriers,
}: {
  carriers: WarehouseCarrierRow[];
}) {
  const [pending, start] = useTransition();
  const [phones, setPhones] = useState<CarrierPhoneRow[]>([]);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const loadPhones = useCallback(() => {
    start(async () => {
      try {
        const result = await actionFetchCarrierPhones();
        if (!result.ok) {
          setPhones([]);
          setLoadError({ title: result.title, message: result.message });
          redirectToLoginIfSessionError(result.message);
          return;
        }
        setPhones(result.phones);
        setExpandedSlugs(new Set(result.phones.map((p) => p.carrierSlug)));
        setLoadError(null);
      } catch (e) {
        const copy = userFacingErrorFromUnknown(
          e,
          "Nie udało się wczytać numerów telefonów kurierów."
        );
        setLoadError({ title: copy.title, message: copy.description });
        if (copy.kind === "session") {
          redirectToLoginIfSessionError(e);
        }
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
        matchesSearchWords(
          [c.label, ...(phonesBySlug.get(c.slug) ?? []).flatMap((p) => [p.phone, p.label])],
          q
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

  const countLine =
    pending && phones.length === 0
      ? "Wczytuję numery…"
      : `${totalPhones} ${polishPluralWord(totalPhones, "numer", "numery", "numerów")} · ${activeCarriers} ${polishPluralWord(activeCarriers, "aktywny kurier", "aktywni kurierzy", "aktywnych kurierów")}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kurierzy"
        description="Numery telefonów do kurierów. Dotknij numeru, żeby zadzwonić."
        className="mb-0"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <IconSearch size={16} aria-hidden />
          </span>
          <Input
            type="search"
            aria-label="Szukaj kuriera lub numeru"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kurier lub numer telefonu…"
            className="pl-9"
          />
        </div>
        <p className="text-[0.6875rem] tabular-nums text-slate-500 sm:ml-auto">{countLine}</p>
        {filteredCarriers.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 self-start sm:min-h-8 sm:self-auto"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? "Zwiń wszystkie" : "Rozwiń wszystkie"}
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <Alert tone="warning" title={loadError.title}>
          {loadError.message}
        </Alert>
      ) : null}

      {pending && phones.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-slate-600" role="status">
            <BrandLoader size="lg" tile={false} />
            Wczytuję kurierów i numery…
          </div>
        </Card>
      ) : filteredCarriers.length === 0 ? (
        <Card>
          <EmptyState
            title="Brak kurierów"
            description={search ? "Brak wyników dla tej frazy. Wyczyść wyszukiwanie albo wpisz inny numer." : "Brak zdefiniowanych kurierów."}
          />
        </Card>
      ) : (
        <Card padding={false} className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {filteredCarriers.map((carrier) => {
              const isExpanded = expandedSlugs.has(carrier.slug);
              const carrierPhones = phonesBySlug.get(carrier.slug) ?? [];
              const hasPhones = carrierPhones.length > 0;
              const panelId = `kurier-${carrier.slug}`;

              return (
                <li key={carrier.slug}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(carrier.slug)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    className={cn(
                      controlFocusClass,
                      "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50"
                    )}
                  >
                    <IconChevronRight
                      size={16}
                      aria-hidden
                      className={cn(
                        "shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{carrier.label}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-slate-500">
                        {hasPhones
                          ? `${carrierPhones.length} ${polishPluralWord(carrierPhones.length, "numer", "numery", "numerów")}`
                          : "Brak numerów"}
                      </p>
                    </div>
                    {!carrier.isActive ? <Badge>Nieaktywny</Badge> : null}
                  </button>

                  {isExpanded ? (
                    <div id={panelId} className="bg-slate-50/60">
                      {hasPhones ? (
                        <ul className="divide-y divide-slate-100">
                          {carrierPhones.map((phone) => (
                            <li key={phone.id} className="flex items-center gap-3 py-2.5 pl-11 pr-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold tabular-nums text-slate-900">{phone.phone}</p>
                                {phone.label ? (
                                  <p className="mt-0.5 text-[0.6875rem] text-slate-500">{phone.label}</p>
                                ) : null}
                              </div>
                              <a
                                href={`tel:${phone.phone.replace(/[\s()-]/g, "")}`}
                                aria-label={`Zadzwoń: ${phone.phone}`}
                                className={cn(
                                  controlFocusClass,
                                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-800 transition-colors hover:bg-indigo-100 sm:min-h-9"
                                )}
                              >
                                <IconPhone size={14} aria-hidden />
                                Zadzwoń
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="py-3 pl-11 pr-4 text-xs text-slate-600">
                          Brak zapisanych numerów dla tego kuriera.
                        </p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
