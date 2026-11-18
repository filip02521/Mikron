"use client";

import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { askConfirm } from "@/components/ui/ConfirmHost";
import { IconChevronDown, IconMinus, IconPlus, IconSearch, IconTrash2 } from "@/components/icons/StrokeIcons";
import {
  actionAddServiceModelPart,
  actionRemoveServiceModelPart,
  actionSetServiceModelPartQty,
  actionSetServiceModelWarranty,
} from "@/app/actions/service-orders";
import { SERVICE_WARRANTY_DEFAULT_MONTHS, warrantyUntil } from "@/lib/orders/service-warranty";
import { toDateOnly } from "@/lib/orders/service-loaners";
import {
  buildModelCatalog,
  catalogGroup,
  catalogMatches,
  clampCatalogQty,
  sortCatalog,
  type CatalogGroup,
  type CatalogKnownModel,
  type CatalogModel,
  type CatalogPart,
  type CatalogWarranty,
} from "@/lib/orders/service-model-catalog";
import { pickerInputClass, ProductPicker, type PickedProduct } from "@/components/serwis/SubiektPickers";
import { cn } from "@/lib/cn";
import { polishPlural } from "@/lib/email/polish-plural";
import { fieldLabelClass, rubricBoxClass, rubricLabelClass, serwisFilterActiveClass, serwisFilterIdleClass } from "@/lib/ui/serwis-theme";

const WARRANTY_OPTIONS = [6, 12, 18, 24, 36, 48, 60];
const GROUP_LABEL: Record<CatalogGroup, string> = { bez_czesci: "Bez części", z_czesciami: "Z częściami" };
const GROUP_ORDER: CatalogGroup[] = ["bez_czesci", "z_czesciami"];

const todayYmd = () => toDateOnly(new Date());
const dmy = (ymd: string) => ymd.split("-").reverse().join(".");
const modelLabel = (m: { symbol: string | null; name: string }) => m.symbol ?? m.name;

type ActionRes = { ok: true; message: string } | { ok: false; message: string };

/** Zdanie stanu: te same słowa i liczby co nagłówki grup pod nim. */
function catalogStateSentence(counts: Record<CatalogGroup, number>): string {
  if (!counts.bez_czesci && !counts.z_czesciami) return "Katalog jest pusty";
  return GROUP_ORDER.filter((g) => counts[g])
    .map((g) => `${polishPlural(counts[g], "model", "modele", "modeli")} ${GROUP_LABEL[g].toLocaleLowerCase("pl")}`)
    .join(" · ");
}

export function ServiceModelsCatalog({
  parts,
  warranties,
  known,
}: {
  parts: CatalogPart[];
  warranties: CatalogWarranty[];
  known: CatalogKnownModel[];
}) {
  const router = useRouter();
  const baseId = useId();
  const { readOnly } = useAdminPanelPreview();
  const [, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  // Otwarty model trzyma grupę z chwili otwarcia: pierwsza dodana część nie przerzuca wiersza pod palcem.
  const [open, setOpen] = useState<{ twId: number; group: CatalogGroup } | null>(null);
  const [draft, setDraft] = useState<CatalogModel | null>(null);
  // Wpis startowy pickera trzymany w stanie: nowy obiekt przy każdym renderze zapętlałby szukanie w Subiekcie.
  const [adding, setAdding] = useState<{ seed: PickedProduct | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const saved = useMemo(() => buildModelCatalog(parts, warranties, known), [parts, warranties, known]);
  // Model spoza listy żyje tylko na ekranie, dopóki nie zapisze się pierwsza część albo gwarancja.
  const draftOnly = draft && !saved.some((m) => m.twId === draft.twId) ? draft : null;
  const models = draftOnly ? [draftOnly, ...saved] : saved;
  const isDraft = (m: CatalogModel) => draftOnly?.twId === m.twId;

  const groupOf = (m: CatalogModel): CatalogGroup => (open?.twId === m.twId ? open.group : catalogGroup(m));
  const counts = { bez_czesci: 0, z_czesciami: 0 } satisfies Record<CatalogGroup, number>;
  for (const m of models) counts[catalogGroup(m)] += 1;
  const visible = models.filter((m) => catalogMatches(m, query));

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${baseId}-row-${open.twId}`)?.scrollIntoView({ block: "nearest" });
  }, [open, baseId]);

  const refresh = (message: string) => {
    setToast(message);
    startRefresh(() => router.refresh());
  };

  const pickModel = (p: PickedProduct | null) => {
    if (!p?.twId) return;
    const existing = models.find((m) => m.twId === p.twId);
    if (!existing) {
      setDraft({ twId: p.twId, symbol: p.symbol, name: p.name, parts: [], months: SERVICE_WARRANTY_DEFAULT_MONTHS, customMonths: false, orders: 0 });
    }
    setQuery("");
    setAdding(null);
    setOpen({ twId: p.twId, group: existing ? catalogGroup(existing) : "bez_czesci" });
  };

  return (
    <div className="space-y-5">
      <p className="font-display text-lg font-bold tracking-[-0.01em] text-slate-900" aria-live="polite">
        {catalogStateSentence(counts)}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Szukaj modelu</span>
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Szukaj: model, symbol, część"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-md border border-slate-200 bg-card pl-9 pr-3 text-base shadow-[var(--shadow-control)] transition-colors duration-150 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
          />
        </label>
        {readOnly ? null : (
          <Button type="button" variant="secondary" className="min-h-11" onClick={() => setAdding(adding ? null : { seed: null })} aria-expanded={!!adding}>
            <IconPlus size={16} aria-hidden />
            Model spoza listy
          </Button>
        )}
      </div>

      {adding ? (
        <div className={cn(rubricBoxClass, "space-y-2 px-3 py-3 sm:px-4")}>
          <ProductPicker
            key={adding.seed?.name ?? ""}
            value={adding.seed}
            onChange={pickModel}
            label="Model z Subiekta"
            placeholder="Np. Forte 200"
            autoFocus
          />
          <p className="text-[0.8125rem] text-slate-600">
            Wybrany model otworzy się poniżej. Do katalogu trafi z pierwszą częścią albo gwarancją inną niż {SERVICE_WARRANTY_DEFAULT_MONTHS} mies.
          </p>
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setAdding(null)}>
            Anuluj
          </Button>
        </div>
      ) : null}

      {models.length === 0 ? (
        <div className={cn(rubricBoxClass, "px-4 py-6 text-center")}>
          <p className="font-semibold text-slate-900">Katalog jest pusty</p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-slate-600">
            Modele pojawiają się tu same, gdy przyjmiesz sprzęt do naprawy albo potwierdzisz model w „Sprzęt klienta”. Inny model dodasz przyciskiem
            „Model spoza listy”.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className={cn(rubricBoxClass, "space-y-3 px-4 py-5")}>
          <p className="text-sm text-slate-700">Na liście nie ma modelu „{query.trim()}”.</p>
          {readOnly || adding ? null : (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => setAdding({ seed: { twId: null, symbol: null, name: query.trim() } })}>
              <IconSearch size={16} aria-hidden />
              Szukaj „{query.trim()}” w Subiekcie
            </Button>
          )}
        </div>
      ) : (
        GROUP_ORDER.map((g) => {
          const rows = sortCatalog(
            visible.filter((m) => groupOf(m) === g),
            g
          );
          // Nowy model (spoza listy) na górze swojej grupy — tam, gdzie serwisant patrzy po wyborze.
          rows.sort((a, b) => Number(isDraft(b)) - Number(isDraft(a)));
          if (!rows.length) return null;
          return (
            <section key={g} aria-labelledby={`${baseId}-${g}`} className="space-y-2">
              <h2 id={`${baseId}-${g}`} className="text-[0.9375rem] font-semibold text-slate-900">
                {GROUP_LABEL[g]} <span className="font-normal text-slate-500">· {rows.length}</span>
              </h2>
              {/* Bez overflow-hidden: lista podpowiedzi Subiekta w otwartym modelu wychodzi poza ostatni wiersz. */}
              <ul className={cn(rubricBoxClass, "divide-y divide-[var(--sv-rule)]")}>
                {rows.map((m) => (
                  <ModelRow
                    key={m.twId}
                    rowId={`${baseId}-row-${m.twId}`}
                    model={m}
                    isNew={isDraft(m)}
                    expanded={open?.twId === m.twId}
                    readOnly={readOnly}
                    onToggle={() => setOpen(open?.twId === m.twId ? null : { twId: m.twId, group: catalogGroup(m) })}
                    onDone={refresh}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}

function ModelRow({
  rowId,
  model,
  isNew,
  expanded,
  readOnly,
  onToggle,
  onDone,
}: {
  rowId: string;
  model: CatalogModel;
  isNew: boolean;
  expanded: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onDone: (message: string) => void;
}) {
  const panelId = `${rowId}-panel`;
  const meta = [
    model.symbol,
    // Okres domyślny opisuje nagłówek strony raz; w wierszu tylko inny niż domyślny.
    expanded || !model.customMonths ? null : `gwarancja ${model.months} mies.`,
    model.orders ? `${polishPlural(model.orders, "zlecenie", "zlecenia", "zleceń")} w serwisie` : null,
  ].filter(Boolean);
  return (
    <li id={rowId} className="scroll-mt-20 [&:first-child>button]:rounded-t-lg [&:last-child>*:last-child]:rounded-b-lg">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="group flex min-h-14 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--sv-box)] sm:px-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-slate-900">{model.name}</span>
          <span className="block text-xs text-slate-500">
            {meta.map((t, i) => (
              <span key={i}>
                {i ? " · " : ""}
                <span className={i === 0 && model.symbol ? "font-mono" : undefined}>{t}</span>
              </span>
            ))}
          </span>
        </span>
        {isNew ? (
          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">Nowy</span>
        ) : model.parts.length ? (
          <span className="shrink-0 text-sm tabular-nums text-slate-600">{polishPlural(model.parts.length, "część", "części", "części")}</span>
        ) : null}
        <IconChevronDown
          size={18}
          aria-hidden
          className={cn("shrink-0 text-slate-400 transition-transform duration-150", expanded && "rotate-180")}
        />
      </button>
      {expanded ? <ModelEditor id={panelId} model={model} isNew={isNew} readOnly={readOnly} onDone={onDone} /> : null}
    </li>
  );
}

function ModelEditor({
  id,
  model,
  isNew,
  readOnly,
  onDone,
}: {
  id: string;
  model: CatalogModel;
  isNew: boolean;
  readOnly: boolean;
  onDone: (message: string) => void;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Jedna akcja naraz; po sukcesie odświeżenie listy i komunikat, po błędzie zdanie przy przyciskach modelu. */
  const run = (key: string, call: () => Promise<ActionRes>, after?: () => void) => {
    setError(null);
    setBusy(key);
    start(async () => {
      const res = await call();
      setBusy(null);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      after?.();
      onDone(res.message);
    });
  };

  return (
    <div id={id} className="space-y-4 border-t border-[var(--sv-rule)] bg-[var(--sv-box)] px-3 py-4 sm:px-4">
      {isNew ? (
        <p className="text-[0.8125rem] text-slate-700">
          Nowy model — trafi do katalogu z pierwszą częścią albo gwarancją inną niż {SERVICE_WARRANTY_DEFAULT_MONTHS} mies.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <PartsBlock model={model} readOnly={readOnly} pending={pending} busy={busy} run={run} />
        <WarrantyBlock model={model} readOnly={readOnly} pending={pending} busy={busy} run={run} />
      </div>
    </div>
  );
}

type BlockProps = {
  model: CatalogModel;
  readOnly: boolean;
  pending: boolean;
  busy: string | null;
  run: (key: string, call: () => Promise<ActionRes>, after?: () => void) => void;
};

function PartsBlock({ model, readOnly, pending, busy, run }: BlockProps) {
  const formId = useId();
  const [part, setPart] = useState<PickedProduct | null>(null);
  const [qty, setQty] = useState("1");
  const [pickerKey, setPickerKey] = useState(0);
  const existing = part?.twId ? model.parts.find((p) => p.partTwId === part.twId) : undefined;
  const addQty = clampCatalogQty(Number(qty) || 1);

  return (
    <section aria-labelledby={`${formId}-h`} className="min-w-0 space-y-2">
      <h3 id={`${formId}-h`} className={rubricLabelClass}>
        Części do naprawy
      </h3>
      <p className="text-[0.8125rem] text-slate-600">
        W karcie zlecenia tego modelu podpowiadają się przy „Pobierz część”, z ilością wpisaną tutaj.
      </p>
      {model.parts.length ? (
        <ul className="divide-y divide-[var(--sv-rule)] rounded-md border border-[var(--sv-rule)] bg-card">
          {model.parts.map((p) => (
            <PartRow key={p.partTwId} model={model} part={p} readOnly={readOnly} pending={pending} busy={busy} run={run} />
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-[var(--sv-rule)] bg-card px-3 py-3 text-sm text-slate-600">
          Brak części. {readOnly ? "" : "Dodaj pierwszą poniżej — zwykle szczotki, łożyska, uszczelki."}
        </p>
      )}
      {readOnly ? null : (
        <form
          className="space-y-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!part?.twId) return;
            run(
              `add`,
              () => actionAddServiceModelPart({ modelTwId: model.twId, partTwId: part.twId!, defaultQty: addQty }),
              () => {
                setPart(null);
                setQty("1");
                setPickerKey((k) => k + 1);
              }
            );
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto] sm:items-end">
            <ProductPicker key={pickerKey} value={part} onChange={setPart} label="Dodaj część" placeholder="Symbol albo nazwa części" autoFocus={pickerKey > 0} />
            <div>
              <label htmlFor={`${formId}-qty`} className={fieldLabelClass}>
                Szt.
              </label>
              <input
                id={`${formId}-qty`}
                value={qty}
                inputMode="numeric"
                onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                className={`${pickerInputClass} tabular-nums`}
              />
            </div>
            <Button type="submit" className="min-h-11" disabled={pending || !part?.twId}>
              {busy === "add" ? "Zapisuję…" : existing ? `Zmień na ${addQty} szt.` : `Dodaj do ${modelLabel(model)}`}
            </Button>
          </div>
          <p className="text-[0.8125rem] text-slate-600">
            {existing
              ? `Ta część już jest w modelu (${existing.defaultQty} szt.) — zapis zmieni tylko ilość.`
              : part?.twId
                ? `${modelLabel(part)} dojdzie do podpowiedzi w karcie zlecenia ${modelLabel(model)}.`
                : "Wybierz część z podpowiedzi Subiekta — przycisk zapisze ją do tego modelu."}
          </p>
        </form>
      )}
    </section>
  );
}

function PartRow({ model, part, readOnly, pending, busy, run }: BlockProps & { part: CatalogPart }) {
  const [qty, setQty] = useState(part.defaultQty);
  const changed = qty !== part.defaultQty;
  const key = `qty-${part.partTwId}`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
      <span className="min-w-0 flex-1 basis-48">
        <span className="block text-sm text-slate-900">{part.partName}</span>
        <span className="block font-mono text-xs text-slate-500">{part.partSymbol ?? "—"}</span>
      </span>
      {readOnly ? (
        <span className="text-sm font-semibold tabular-nums text-slate-900">{part.defaultQty} szt.</span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-card" role="group" aria-label={`Ilość ${part.partSymbol ?? part.partName}`}>
            <button
              type="button"
              aria-label="Mniej"
              disabled={pending || qty <= 1}
              onClick={() => setQty((q) => clampCatalogQty(q - 1))}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconMinus size={16} aria-hidden />
            </button>
            <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-slate-900" aria-live="polite">
              {qty} szt.
            </span>
            <button
              type="button"
              aria-label="Więcej"
              disabled={pending || qty >= 999}
              onClick={() => setQty((q) => clampCatalogQty(q + 1))}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconPlus size={16} aria-hidden />
            </button>
          </span>
          {/* Stała szerokość: „Zapisz” w miejscu „Usuń” nie przesuwa stepera pod palcem. */}
          {changed ? (
            <Button
              type="button"
              className="min-h-11 w-[6.75rem]"
              disabled={pending}
              onClick={() => run(key, () => actionSetServiceModelPartQty({ modelTwId: model.twId, partTwId: part.partTwId, qty }))}
            >
              {busy === key ? "Zapisuję…" : "Zapisz"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-[6.75rem]"
              disabled={pending}
              onClick={async () => {
                const ok = await askConfirm({
                  title: "Usunąć część z modelu?",
                  message: `${part.partSymbol ?? part.partName} przestanie się podpowiadać przy „Pobierz część” dla ${modelLabel(model)}. Pobrane już części i zlecenia zostają bez zmian.`,
                  confirmLabel: "Usuń z modelu",
                  danger: true,
                });
                if (ok) run(`rm-${part.partTwId}`, () => actionRemoveServiceModelPart({ modelTwId: model.twId, partTwId: part.partTwId }));
              }}
            >
              <IconTrash2 size={16} aria-hidden />
              {busy === `rm-${part.partTwId}` ? "Usuwam…" : "Usuń"}
            </Button>
          )}
        </span>
      )}
    </li>
  );
}

function WarrantyBlock({ model, readOnly, pending, busy, run }: BlockProps) {
  const headId = useId();
  const [months, setMonths] = useState(model.months);
  const [today] = useState(todayYmd);
  const options = WARRANTY_OPTIONS.includes(model.months) ? WARRANTY_OPTIONS : [...WARRANTY_OPTIONS, model.months].sort((a, b) => a - b);
  const changed = months !== model.months;
  return (
    <section aria-labelledby={headId} className="min-w-0 space-y-2">
      <h3 id={headId} className={rubricLabelClass}>
        Gwarancja od daty zakupu
      </h3>
      {readOnly ? null : (
        <div role="radiogroup" aria-labelledby={headId} className="flex flex-wrap gap-1.5">
          {options.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={months === m}
              disabled={pending}
              onClick={() => setMonths(m)}
              className={cn(
                "inline-flex min-h-11 min-w-[4.25rem] cursor-pointer items-center justify-center rounded-md border px-2.5 text-sm font-medium tabular-nums transition-colors duration-150 disabled:cursor-not-allowed",
                months === m ? serwisFilterActiveClass : serwisFilterIdleClass
              )}
            >
              {m} mies.
            </button>
          ))}
        </div>
      )}
      {changed ? (
        <>
          <p className="text-[0.8125rem] text-slate-700">
            Po zapisie nowe przyjęcia i „Sprzęt klienta” liczą {months} mies. — zakup dziś ma gwarancję do {dmy(warrantyUntil(today, months))}. Przyjęte
            zlecenia zachowują swoją datę.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={pending}
              onClick={() => run("warranty", () => actionSetServiceModelWarranty({ modelTwId: model.twId, months }))}
            >
              {busy === "warranty" ? "Zapisuję…" : `Zapisz ${months} mies.`}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" disabled={pending} onClick={() => setMonths(model.months)}>
              Zostaw {model.months} mies.
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[0.8125rem] text-slate-600">
          Teraz {model.months} mies.{model.customMonths ? "" : " — okres domyślny"}: zakup dziś ma gwarancję do {dmy(warrantyUntil(today, model.months))}.
          {readOnly ? "" : " Wybierz inny okres, jeśli producent daje inny."}
        </p>
      )}
    </section>
  );
}
