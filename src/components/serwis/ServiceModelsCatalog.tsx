"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { askConfirm } from "@/components/ui/ConfirmHost";
import { actionAddServiceModelPart, actionRemoveServiceModelPart, actionSetServiceModelWarranty } from "@/app/actions/service-orders";
import { SERVICE_WARRANTY_DEFAULT_MONTHS } from "@/lib/orders/service-warranty";
import { pickerInputClass, ProductPicker, type PickedProduct } from "@/components/serwis/SubiektPickers";

export type CatalogModelPart = {
  modelTwId: number;
  modelSymbol: string | null;
  modelName: string;
  partTwId: number;
  partSymbol: string | null;
  partName: string;
  defaultQty: number;
  note: string;
};

/** Model, który był w naprawie, a nie ma jeszcze katalogu — podpowiedź „od czego zacząć”. */
export type CatalogRepairedModel = { twId: number; symbol: string | null; name: string; orders: number };

/** Okres gwarancji modelu inny niż domyślny. */
export type CatalogModelWarranty = { modelTwId: number; modelSymbol: string | null; modelName: string; months: number };

const WARRANTY_OPTIONS = [6, 12, 18, 24, 36, 48, 60];

/** Lista okresów gwarancji; domyślny opisany wprost, nietypowy okres z bazy zostaje na liście. */
function WarrantySelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: number;
  disabled: boolean;
  onChange: (months: number) => void;
}) {
  const options = WARRANTY_OPTIONS.includes(value) ? WARRANTY_OPTIONS : [...WARRANTY_OPTIONS, value].sort((a, b) => a - b);
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${pickerInputClass} w-auto pr-8`}
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {m} mies.{m === SERVICE_WARRANTY_DEFAULT_MONTHS ? " (domyślna)" : ""}
        </option>
      ))}
    </select>
  );
}

export function ServiceModelsCatalog({
  parts,
  repaired,
  warranties,
}: {
  parts: CatalogModelPart[];
  repaired: CatalogRepairedModel[];
  warranties: CatalogModelWarranty[];
}) {
  const router = useRouter();
  const formId = useId();
  const [, startRefresh] = useTransition();
  const [pending, start] = useTransition();
  const [model, setModel] = useState<PickedProduct | null>(null);
  const [part, setPart] = useState<PickedProduct | null>(null);
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Klucz pickerów: po zapisie część się czyści, model zostaje (zwykle dodaje się kilka części do jednego modelu).
  const [partKey, setPartKey] = useState(0);
  const [modelKey, setModelKey] = useState(0);
  const [warrantyModel, setWarrantyModel] = useState<PickedProduct | null>(null);
  const [warrantyModelKey, setWarrantyModelKey] = useState(0);
  const [warrantyMonths, setWarrantyMonths] = useState(SERVICE_WARRANTY_DEFAULT_MONTHS);

  const models = useMemo(() => {
    const m = new Map<number, { twId: number; symbol: string | null; name: string; parts: CatalogModelPart[]; months: number }>();
    for (const p of parts) {
      const cur = m.get(p.modelTwId) ?? { twId: p.modelTwId, symbol: p.modelSymbol, name: p.modelName, parts: [], months: SERVICE_WARRANTY_DEFAULT_MONTHS };
      cur.parts.push(p);
      m.set(p.modelTwId, cur);
    }
    // Model z samą gwarancją (bez części) też ma kartę — inaczej jego okresu nie dałoby się zobaczyć ani zmienić.
    for (const w of warranties) {
      const cur = m.get(w.modelTwId) ?? { twId: w.modelTwId, symbol: w.modelSymbol, name: w.modelName, parts: [], months: w.months };
      cur.months = w.months;
      m.set(w.modelTwId, cur);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [parts, warranties]);

  const saveWarranty = (modelTwId: number, months: number, after?: () => void) => {
    setError(null);
    start(async () => {
      const res = await actionSetServiceModelWarranty({ modelTwId, months });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      after?.();
      done(res.message);
    });
  };
  const withoutCatalog = repaired.filter((r) => !models.some((m) => m.twId === r.twId));

  const done = (message: string) => {
    setToast(message);
    startRefresh(() => router.refresh());
  };

  return (
    <div className="space-y-6">
      <form
        id={formId}
        className="space-y-4 rounded-xl border border-slate-200 bg-card p-4 shadow-sm sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!model?.twId || !part?.twId) {
            setError(!model?.twId ? "Wybierz model z podpowiedzi Subiekta." : "Wybierz część z podpowiedzi Subiekta.");
            return;
          }
          setError(null);
          start(async () => {
            const res = await actionAddServiceModelPart({ modelTwId: model.twId!, partTwId: part.twId!, defaultQty: Number(qty) || 1 });
            if (!res.ok) {
              setError(res.message);
              return;
            }
            setPart(null);
            setQty("1");
            setPartKey((k) => k + 1);
            done(res.message);
          });
        }}
      >
        <h2 className="font-display text-lg font-bold text-slate-900">Dodaj część do modelu</h2>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_auto] lg:items-end">
          <ProductPicker key={`m${modelKey}`} value={model} onChange={setModel} label="Model sprzętu" placeholder="Np. Forte 200" />
          <ProductPicker key={`p${partKey}`} value={part} onChange={setPart} label="Część" placeholder="Symbol albo nazwa części" />
          <div>
            <label htmlFor={`${formId}-qty`} className="mb-1.5 block text-xs font-semibold text-slate-600">
              Zwykle szt.
            </label>
            <input
              id={`${formId}-qty`}
              value={qty}
              inputMode="numeric"
              onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              className={`${pickerInputClass} tabular-nums`}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Zapisuję…" : "Dodaj do katalogu"}
          </Button>
        </div>
        {withoutCatalog.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
            <span className="text-slate-600">Były w naprawie, bez katalogu:</span>
            {withoutCatalog.map((r) => (
              <button
                key={r.twId}
                type="button"
                onClick={() => {
                  setModel({ twId: r.twId, symbol: r.symbol, name: r.name });
                  setModelKey((k) => k + 1);
                }}
                className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 bg-card px-3 py-1 text-left text-slate-700 transition-colors duration-150 hover:bg-slate-100"
              >
                {r.symbol ?? r.name} · {r.orders} zl.
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </form>

      <form
        className="space-y-3 rounded-xl border border-slate-200 bg-card p-4 shadow-sm sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!warrantyModel?.twId) {
            setError("Wybierz model z podpowiedzi Subiekta.");
            return;
          }
          saveWarranty(warrantyModel.twId, warrantyMonths, () => {
            setWarrantyModel(null);
            setWarrantyModelKey((k) => k + 1);
            setWarrantyMonths(SERVICE_WARRANTY_DEFAULT_MONTHS);
          });
        }}
      >
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">Gwarancja modelu</h2>
          <p className="text-[0.8125rem] text-slate-600">
            Domyślnie {SERVICE_WARRANTY_DEFAULT_MONTHS} mies. od daty zakupu. Ustaw inny okres tylko dla modeli, które go mają.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <ProductPicker key={`w${warrantyModelKey}`} value={warrantyModel} onChange={setWarrantyModel} label="Model sprzętu" placeholder="Np. Forte 200" />
          <div>
            <label htmlFor={`${formId}-warranty`} className="mb-1.5 block text-xs font-semibold text-slate-600">
              Gwarancja
            </label>
            <WarrantySelect id={`${formId}-warranty`} value={warrantyMonths} disabled={pending} onChange={setWarrantyMonths} />
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>
            Zapisz gwarancję
          </Button>
        </div>
      </form>

      {models.length === 0 ? (
        <EmptyState
          title="Katalog jest pusty"
          description="Dodaj części, które zwykle idą do naprawy danego modelu. Albo pobieraj części w zleceniach z zaznaczonym „Zapamiętaj w katalogu modelu” — katalog zbuduje się sam."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {models.map((m) => (
            <section key={m.twId} aria-labelledby={`model-${m.twId}`} className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 id={`model-${m.twId}`} className="text-[0.9375rem] font-semibold text-slate-900">
                  {m.name}
                </h2>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{m.symbol ?? "—"}</span> ·{" "}
                    {m.parts.length ? `${m.parts.length} ${m.parts.length === 1 ? "część" : "części"}` : "bez części w katalogu"}
                  </p>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    Gwarancja
                    <WarrantySelect
                      id={`${formId}-w-${m.twId}`}
                      value={m.months}
                      disabled={pending}
                      onChange={(months) => saveWarranty(m.twId, months)}
                    />
                  </label>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {m.parts.map((p) => (
                  <li key={p.partTwId} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <span className="w-12 flex-none text-right text-sm font-semibold tabular-nums text-slate-900">{p.defaultQty} szt.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-900">{p.partName}</span>
                      <span className="block font-mono text-xs text-slate-500">{p.partSymbol ?? "—"}</span>
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={async () => {
                        const ok = await askConfirm({
                          title: "Usunąć część z katalogu?",
                          message: `${p.partSymbol ?? p.partName} zniknie z podpowiedzi dla ${m.symbol ?? m.name}. Pobrane już części i zlecenia zostają bez zmian.`,
                          confirmLabel: "Usuń z katalogu",
                          danger: true,
                        });
                        if (!ok) return;
                        start(async () => {
                          const res = await actionRemoveServiceModelPart({ modelTwId: m.twId, partTwId: p.partTwId });
                          if (!res.ok) setError(res.message);
                          else done(res.message);
                        });
                      }}
                    >
                      Usuń
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
