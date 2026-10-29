"use client";

// Paleta „Ustawienia towaru” — wzorzec 21st.dev „Command Palette” (adobe/tailwind-commandpalette: skrót ⌘/Ctrl,
// pole wyszukiwania z fokusem, wyniki strzałkami, Enter wybiera, Esc zamyka) na komponentach OnTime.

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import {
  actionClearZdEstimateOnRequest,
  actionDeleteZdEstimateMinStock,
  actionDeleteZdEstimatePackaging,
  actionExcludeZdEstimateProduct,
  actionGetZdProductSettings,
  actionMarkZdEstimateOnRequest,
  actionRestoreZdEstimateProduct,
  actionUpsertZdEstimateMinStock,
  actionUpsertZdEstimatePackaging,
  type ZdProductSettings,
} from "@/app/actions/zd-estimate";
import { actionSubiektSuggestProducts } from "@/app/actions/subiekt";
import { IconChevronLeft, IconSearch } from "@/components/icons/StrokeIcons";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { useProductHistory } from "@/components/zakupy/ZdEstimateProductCard";
import { ZdProductPurchasesSection, ZdProductSalesSections } from "@/components/zakupy/ZdProductHistorySections";
import { ZdProductNote } from "@/components/zakupy/ZdProductNote";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import {
  detectOnRequestPattern,
  isOnRequestDeliveryArrived,
  onRequestCustomerKey,
  onRequestDeliveryDate,
  onRequestPatternSummary,
} from "@/lib/orders/zd-on-request-detect";
import { warsawDateKeyDaysAgo } from "@/lib/time/warsaw";
import type { ZdProductPurchaseRow } from "@/lib/orders/zd-product-history";
import type { ZdPackagingDocumentUnitMode } from "@/lib/orders/zd-estimate-units";
import {
  formatSubiektProductOption,
  inferProductZdLookupSearchField,
  minProductSearchLength,
  subiektFieldText,
} from "@/lib/subiekt/product-pick";
import type { SubiektProduct } from "@/lib/subiekt/types";

type Mode = ZdProductSettings["mode"];

const MODE_HINT: Record<Mode, string> = {
  normal: "Kreator liczy zapas z tempa sprzedaży, jak zwykle.",
  onRequest: "Bez prośby poza Do ZD; z prośbą - tylko ilość z prośby.",
  excluded: "Nigdy na ZD, także z prośbą (np. wycofany, zamawiany gdzie indziej).",
};

/** Towar z Subiekta → pola, których wymagają akcje ustawień (symbol, nazwa, grupa). */
function productRef(p: SubiektProduct) {
  return {
    subiektTwId: Math.trunc(Number(p.tw_Id)),
    twSymbol: subiektFieldText(p.tw_Symbol) || null,
    twNazwa: subiektFieldText(p.tw_Nazwa) || "",
    grtId: p.tw_IdGrupa ?? null,
    grtNazwa: subiektFieldText(p.grt_Nazwa) || null,
  };
}

function SettingRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Ustawienia zamawiania jednego towaru — bez liczenia listy Kreatora. */
export function ZdProductSettingsView({ product, canEdit }: { product: SubiektProduct; canEdit: boolean }) {
  const ref = productRef(product);
  const twId = ref.subiektTwId;
  const titleId = useId();
  const [settings, setSettings] = useState<{ key: number; value: ZdProductSettings } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pkgDraft, setPkgDraft] = useState<{ units: string; label: string; mode: ZdPackagingDocumentUnitMode } | null>(null);
  const [minDraft, setMinDraft] = useState<string | null>(null);
  const history = useProductHistory(twId, null);

  const reload = () =>
    actionGetZdProductSettings({ twId }).then(
      (r) => (r.ok ? (setSettings({ key: twId, value: r.settings }), setLoadError(null)) : setLoadError(r.message)),
      () => setLoadError("Nie udało się wczytać ustawień towaru.")
    );
  useEffect(() => {
    void reload();
  }, [twId]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = settings?.key === twId ? settings.value : null;

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    start(async () => {
      // Błąd sieci nie może trafić do granicy błędów — zostaje komunikatem przy ustawieniach.
      const r = await fn().catch(() => ({ ok: false, message: "Nie udało się połączyć z serwerem. Spróbuj ponownie." }));
      if (!r.ok) return setError(r.message ?? "Nie udało się zapisać.");
      await reload();
      setPkgDraft(null);
      setMinDraft(null);
    });
  };

  const setMode = (next: Mode) => {
    if (!s || next === s.mode) return;
    run(async () => {
      if (next === "onRequest") return actionMarkZdEstimateOnRequest(ref);
      if (next === "excluded") return actionExcludeZdEstimateProduct(ref);
      return s.mode === "excluded" ? actionRestoreZdEstimateProduct(twId) : actionClearZdEstimateOnRequest(twId);
    });
  };

  const piecesPerUnit =
    s?.packaging && s.packaging.documentUnitMode !== "pieces_multiple" ? s.packaging.unitsPerPackage : null;
  const unitFor = (): { label: string; piecesPerUnit: number | null } =>
    piecesPerUnit ? { label: s?.packaging?.packageLabel || "op.", piecesPerUnit } : { label: "szt", piecesPerUnit: null };
  const pattern =
    history.status === "ok" && history.purchases.ok && history.sales.ok && history.purchases.rows.length > 0
      ? detectOnRequestPattern(
          history.purchases.rows.filter(isOnRequestDeliveryArrived).map((r: ZdProductPurchaseRow) => ({
            date: onRequestDeliveryDate({ fzDate: r.fzDate, zdDate: r.date }) ?? "",
            pieces: r.qty * (piecesPerUnit ?? 1),
          })),
          history.sales.rows.map((x, i) => ({
            date: x.date,
            khKey: onRequestCustomerKey(x, x.dokNr || i),
            khName: x.khName || x.khSymbol || null,
            pieces: x.pieces,
          })),
          warsawDateKeyDaysAgo(0)
        )
      : null;

  return (
    <div className="space-y-5">
      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : !s ? (
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
          <BrandLoader size="sm" tile={false} /> Wczytuję ustawienia towaru…
        </p>
      ) : (
        <section aria-label="Ustawienia zamawiania" className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-4">
          <SettingRow title="Jak zamawiać">
            <SegmentedControl
              value={s.mode}
              onChange={setMode}
              ariaLabel="Jak zamawiać towar"
              density="compact"
              disabled={!canEdit || pending}
              options={[
                { value: "normal", label: "Normalnie" },
                { value: "onRequest", label: "Tylko na prośbę" },
                { value: "excluded", label: "Wykluczony" },
              ]}
            />
            <p className="mt-1.5 text-xs text-slate-600">{MODE_HINT[s.mode]}</p>
            {pattern?.likely && s.mode === "normal" ? (
              <p className="mt-1.5 text-xs text-slate-700">
                <span className="font-medium">Wygląda na towar na prośbę:</span> {onRequestPatternSummary(pattern)}
              </p>
            ) : pattern?.stockLike && !pattern.likely && s.mode === "onRequest" ? (
              <p className="mt-1.5 text-xs text-slate-700">
                <span className="font-medium">Sprzedaje się jak magazynowy:</span> kupuje go {pattern.customers} klientów w roku.
              </p>
            ) : null}
          </SettingRow>

          <SettingRow title="Opakowanie">
            {pkgDraft ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[6rem_6rem_minmax(0,1fr)]">
                  <label className="text-xs text-slate-600">
                    Sztuk w op.
                    <Input
                      type="number"
                      min={2}
                      inputMode="numeric"
                      value={pkgDraft.units}
                      onChange={(e) => setPkgDraft({ ...pkgDraft, units: e.target.value })}
                      autoFocus
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Nazwa
                    <Input value={pkgDraft.label} maxLength={20} onChange={(e) => setPkgDraft({ ...pkgDraft, label: e.target.value })} />
                  </label>
                  <label className="text-xs text-slate-600">
                    Na ZD
                    <Select
                      value={pkgDraft.mode}
                      onChange={(e) => setPkgDraft({ ...pkgDraft, mode: e.target.value as ZdPackagingDocumentUnitMode })}
                    >
                      <option value="packages">w opakowaniach (1 = op.)</option>
                      <option value="pieces_multiple">w sztukach, wielokrotność op.</option>
                    </Select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    className="max-sm:min-h-10"
                    onClick={() => {
                      const units = Math.trunc(Number(pkgDraft.units));
                      if (!pkgDraft.units.trim() || !(units >= 2)) return setError("Podaj, ile sztuk jest w opakowaniu (co najmniej 2).");
                      run(() =>
                        actionUpsertZdEstimatePackaging({
                          ...ref,
                          unitsPerPackage: units,
                          packageLabel: pkgDraft.label.trim() || "op.",
                          documentUnitMode: pkgDraft.mode,
                        })
                      );
                    }}
                  >
                    {pending ? <Spinner size="sm" /> : null}
                    Zapisz opakowanie
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="max-sm:min-h-10" onClick={() => (setPkgDraft(null), setError(null))}>
                    Anuluj
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-sm text-slate-800">
                  {s.packaging
                    ? `1 ${s.packaging.packageLabel || "op."} = ${s.packaging.unitsPerPackage} szt · na ZD ${
                        s.packaging.documentUnitMode === "pieces_multiple" ? "w sztukach (wielokrotność)" : "w opakowaniach"
                      }`
                    : "Brak - zamawiane w sztukach"}
                </span>
                {canEdit ? (
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="max-sm:min-h-10"
                      onClick={() =>
                        setPkgDraft({
                          units: String(s.packaging?.unitsPerPackage ?? ""),
                          label: s.packaging?.packageLabel ?? "op.",
                          mode: s.packaging?.documentUnitMode ?? "packages",
                        })
                      }
                    >
                      {s.packaging ? "Zmień" : "Ustaw"}
                    </Button>
                    {s.packaging ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="max-sm:min-h-10"
                        disabled={pending}
                        onClick={() => run(() => actionDeleteZdEstimatePackaging(twId))}
                      >
                        Usuń
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </div>
            )}
          </SettingRow>

          <SettingRow title="Minimalny stan">
            {minDraft != null ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-600">
                  Sztuk na stanie co najmniej
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={minDraft}
                    onChange={(e) => setMinDraft(e.target.value)}
                    className="w-32"
                    autoFocus
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  className="max-sm:min-h-10"
                  onClick={() => {
                    const min = Math.trunc(Number(minDraft));
                    if (!minDraft.trim() || !(min >= 0)) return setError("Podaj minimalny stan w sztukach (0 lub więcej).");
                    run(() => actionUpsertZdEstimateMinStock({ ...ref, minStockSzt: min }));
                  }}
                >
                  {pending ? <Spinner size="sm" /> : null}
                  Zapisz
                </Button>
                <Button type="button" size="sm" variant="ghost" className="max-sm:min-h-10" onClick={() => (setMinDraft(null), setError(null))}>
                  Anuluj
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-sm text-slate-800">{s.minStockSzt != null ? `${s.minStockSzt} szt` : "Brak"}</span>
                {canEdit ? (
                  <span className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" className="max-sm:min-h-10" onClick={() => setMinDraft(String(s.minStockSzt ?? ""))}>
                      {s.minStockSzt != null ? "Zmień" : "Ustaw"}
                    </Button>
                    {s.minStockSzt != null ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="max-sm:min-h-10"
                        disabled={pending}
                        onClick={() => run(() => actionDeleteZdEstimateMinStock(twId))}
                      >
                        Usuń
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </div>
            )}
          </SettingRow>

          <SettingRow title="Para">
            <p className="text-sm text-slate-800">
              {s.pair
                ? `${s.pair.role === "pack" ? "Opakowanie" : "Sztuka"} z pary: ${s.pair.twinSymbol ?? ""} ${s.pair.twinNazwa} · 1 op. = ${s.pair.unitsPerPack} szt`
                : "Brak"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Pary ustawiasz w Kreatorze ZD → Reguły → Pary.</p>
          </SettingRow>

          {error ? (
            <p className="py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      )}

      <ZdProductNote twId={twId} symbol={ref.twSymbol} name={ref.twNazwa} canEdit={canEdit} titleId={titleId} />
      <ZdProductPurchasesSection state={history} titleId={titleId} unitFor={unitFor} />
      <ZdProductSalesSections state={history} titleId={titleId} />
    </div>
  );
}

/**
 * „Ustawienia towaru” z panelu dziennego (⌘/Ctrl+K): wyszukaj towar w Subiekcie i ustaw zamawianie bez liczenia
 * listy Kreatora — tryb (normalnie / na prośbę / wykluczony), opakowanie, minimalny stan, notatka, historia.
 */
export function ZdProductSettingsPalette({ open, onClose, canEdit }: { open: boolean; onClose: () => void; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SubiektProduct[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [picked, setPicked] = useState<SubiektProduct | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounced = useDebouncedValue(query.trim(), 250);
  const field = inferProductZdLookupSearchField(debounced);
  const active = debounced.length >= minProductSearchLength(field);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      setStatus("loading");
      const r = await actionSubiektSuggestProducts(debounced, field).catch(() => null);
      if (cancelled) return;
      if (!r) {
        setItems([]);
        setStatus("error");
        setMessage("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
        return;
      }
      if (!r.ok) {
        setItems([]);
        setStatus("error");
        setMessage(r.feedback?.message ?? "Nie udało się wyszukać towaru.");
        return;
      }
      setItems(r.items);
      setHighlight(0);
      setStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [active, debounced, field]);

  const close = () => {
    setPicked(null);
    setQuery("");
    setItems([]);
    onClose();
  };

  const shown = active ? items : [];
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!shown.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      setPicked(shown[highlight] ?? null);
    }
  };

  const pickedOpt = picked ? formatSubiektProductOption(picked) : null;

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={pickedOpt ? pickedOpt.title : "Ustawienia towaru"}
      description={
        pickedOpt
          ? pickedOpt.subtitle
          : "Znajdź towar w Subiekcie i ustaw, jak go zamawiać - bez liczenia listy w Kreatorze."
      }
      size="lg"
      // Jak paleta poleceń: przypięta u góry, żeby pole wyszukiwania nie skakało, gdy przychodzą wyniki.
      className="top-[max(1rem,10dvh)] translate-y-0 max-h-[min(calc(100dvh-max(1rem,10dvh)-1rem),880px)]"
      bodyClassName="space-y-4 px-5 py-4 sm:px-6"
    >
      {picked ? (
        <>
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <IconChevronLeft size={15} aria-hidden /> Inny towar
          </button>
          <ZdProductSettingsView key={picked.tw_Id} product={picked} canEdit={canEdit} />
        </>
      ) : (
        <>
          <div className="relative">
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Symbol, nazwa albo kod Mikran"
              aria-label="Szukaj towaru"
              aria-controls={listId}
              aria-activedescendant={shown[highlight] ? `${listId}-${shown[highlight]!.tw_Id}` : undefined}
              className="pl-9"
              autoFocus
              autoComplete="off"
            />
          </div>
          {status === "loading" && active ? (
            <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
              <BrandLoader size="sm" tile={false} /> Szukam w Subiekcie…
            </p>
          ) : status === "error" && active ? (
            <p className="text-sm text-red-700" role="alert">
              {message}
            </p>
          ) : active && shown.length === 0 ? (
            <p className="text-sm text-slate-600">Brak towaru „{debounced}” w Subiekcie.</p>
          ) : !active ? (
            <p className="text-sm text-slate-500">Wpisz co najmniej 2 znaki. Strzałki wybierają, Enter otwiera, Esc zamyka.</p>
          ) : null}
          {shown.length ? (
            <ul id={listId} role="listbox" aria-label="Towary z Subiekta" className="max-h-[min(55vh,26rem)] overflow-y-auto rounded-lg border border-slate-200">
              {shown.map((p, i) => {
                const opt = formatSubiektProductOption(p);
                return (
                  <li key={p.tw_Id} id={`${listId}-${p.tw_Id}`} role="option" aria-selected={i === highlight}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => setPicked(p)}
                      className={cn(
                        "flex w-full cursor-pointer flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0",
                        i === highlight ? "bg-indigo-50" : "hover:bg-slate-50"
                      )}
                    >
                      <span className="text-sm font-medium text-slate-900">{opt.title}</span>
                      <span className="text-xs text-slate-600">{opt.subtitle}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </ModalShell>
  );
}
