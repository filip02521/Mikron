"use client";

// Paleta „Ustawienia towaru” — wzorzec 21st.dev „Command Palette” (adobe/tailwind-commandpalette: skrót ⌘/Ctrl,
// pole wyszukiwania z fokusem, wyniki strzałkami, Enter wybiera, Esc zamyka) na komponentach OnTime.

import { useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
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
import { useOlderPurchases, useProductHistory } from "@/components/zakupy/ZdEstimateProductCard";
import {
  ZdHistoryRangeBar,
  ZdProductMovementSection,
  ZdProductPurchasesSection,
  ZdProductSalesSections,
} from "@/components/zakupy/ZdProductHistorySections";
import { ZdProductNote } from "@/components/zakupy/ZdProductNote";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { panelTypography } from "@/lib/ui/ontime-theme";
import {
  detectOnRequestPattern,
  isOnRequestDeliveryArrived,
  onRequestCustomerKey,
  onRequestDeliveryDate,
  onRequestPatternSummary,
} from "@/lib/orders/zd-on-request-detect";
import { warsawDateKeyDaysAgo } from "@/lib/time/warsaw";
import type { ZdProductPurchaseRow } from "@/lib/orders/zd-product-history";
import { resolveZdHistoryRange, type ZdHistoryRangeState } from "@/lib/orders/zd-product-range";
import type { ZdPackagingDocumentUnitMode } from "@/lib/orders/zd-estimate-units";
import {
  formatSubiektProductOption,
  mergeSubiektProductSearchResults,
  rankSubiektProductsForLookupQuery,
  subiektFieldText,
  type ProductSearchField,
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

/** Wiersz ustawienia: etykieta, wartość (pusta przygaszona), akcje zawsze po prawej, edytor pod spodem. */
function SettingRow({
  title,
  value,
  detail,
  empty = false,
  actions,
  children,
}: {
  title: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  empty?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">{title}</p>
          <p className={cn("mt-0.5 text-sm tabular-nums", empty ? "text-slate-500" : "font-medium text-slate-900")}>{value}</p>
          {detail ? <p className="mt-0.5 text-xs text-slate-500">{detail}</p> : null}
        </div>
        {actions ? <div className="-mr-1.5 flex shrink-0 gap-0.5">{actions}</div> : null}
      </div>
      {children ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}

type HistoryTab = "buy" | "sales" | "movement";
const HISTORY_TABS = [
  { value: "buy", label: "Zakupy" },
  { value: "sales", label: "Sprzedaż" },
  { value: "movement", label: "Ruch towaru" },
] as const;

/** Nagłówek okna: nazwa towaru, a pod nią symbol, kod Mikran, grupa i stan z Subiekta. */
function productHeading(p: SubiektProduct): { title: string; meta: string } {
  const symbol = subiektFieldText(p.tw_Symbol);
  const name = subiektFieldText(p.tw_Nazwa);
  const plu = subiektFieldText(p.tw_PLU);
  const group = subiektFieldText(p.grt_Nazwa);
  const stock = typeof p.tw_Stan === "number" && Number.isFinite(p.tw_Stan) ? p.tw_Stan : null;
  const meta = [
    symbol && name ? `Symbol ${symbol}` : null,
    plu ? `kod Mikran ${plu}` : null,
    group || null,
    stock == null ? null : stock > 0 ? `na stanie ${formatQty(stock)} szt` : "brak na stanie",
  ].filter(Boolean);
  return { title: name || symbol || "Towar", meta: meta.join(" · ") };
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
  const [historyTab, setHistoryTab] = useState<HistoryTab>("buy");
  const [rangeState, setRangeState] = useState<ZdHistoryRangeState>({ preset: "12m" });
  const range = useMemo(() => resolveZdHistoryRange(rangeState, null, warsawDateKeyDaysAgo(0)), [rangeState]);
  const baseHistory = useProductHistory(twId, null);
  const { history, older, loadOlder } = useOlderPurchases(twId, null, baseHistory);
  // Zakres sprzed 12 miesięcy nocnego odczytu ZD: starsze zakupy z kopii ZD, jak w karcie towaru w Kreatorze.
  const wantsOlder = range.from == null || range.from < warsawDateKeyDaysAgo(365);
  useEffect(() => {
    if (wantsOlder && history.status === "ok") loadOlder();
  }, [wantsOlder, history.status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Akcja wiersza w Petrolu jak „Edytuj” w notatce, żeby nie wyglądała na zwykły tekst obok wartości.
  const rowButton = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-8 items-center rounded-md px-2 text-xs font-medium text-indigo-700 transition-colors duration-150 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-10"
    >
      {label}
    </button>
  );
  const editing = pkgDraft != null || minDraft != null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0 space-y-5">
        <section aria-labelledby={`${titleId}-order`}>
          <h3 id={`${titleId}-order`} className={panelTypography.sectionTitle}>
            Zamawianie
          </h3>
          {loadError ? (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {loadError}
            </p>
          ) : !s ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600" role="status">
              <BrandLoader size="sm" tile={false} /> Wczytuję ustawienia towaru…
            </p>
          ) : (
            <>
              <SegmentedControl
                className="mt-2"
                value={s.mode}
                onChange={setMode}
                ariaLabel="Jak zamawiać towar"
                disabled={!canEdit || pending}
                options={[
                  { value: "normal", label: "Normalnie" },
                  { value: "onRequest", label: "Tylko na prośbę" },
                  { value: "excluded", label: "Wykluczony" },
                ]}
              />
              <p className="mt-1.5 text-xs text-slate-600">{MODE_HINT[s.mode]}</p>

              {pattern?.likely && s.mode === "normal" ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-3" role="note">
                  <p className="text-sm font-medium text-slate-900">Wygląda na towar na prośbę</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{onRequestPatternSummary(pattern)}</p>
                  {canEdit ? (
                    <Button type="button" size="sm" variant="outline" className="mt-2 max-sm:min-h-10" disabled={pending} onClick={() => setMode("onRequest")}>
                      Oznacz „tylko na prośbę”
                    </Button>
                  ) : null}
                </div>
              ) : pattern?.stockLike && !pattern.likely && s.mode === "onRequest" ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-3" role="note">
                  <p className="text-sm font-medium text-slate-900">Sprzedaje się jak magazynowy</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    Kupuje go {pattern.customers} {polishPluralWord(pattern.customers, "klient", "klientów", "klientów")} w roku, dostaw nie
                    bierze w całości jeden klient.
                  </p>
                  {canEdit ? (
                    <Button type="button" size="sm" variant="ghost" className="mt-2 max-sm:min-h-10" disabled={pending} onClick={() => setMode("normal")}>
                      Zamawiaj normalnie
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
                <SettingRow
                  title="Opakowanie"
                  empty={!s.packaging}
                  value={s.packaging ? `1 ${s.packaging.packageLabel || "op."} = ${formatQty(s.packaging.unitsPerPackage)} szt` : "Brak, zamawiane w sztukach"}
                  detail={
                    s.packaging
                      ? s.packaging.documentUnitMode === "pieces_multiple"
                        ? "Na ZD w sztukach, wielokrotność opakowania"
                        : "Na ZD w opakowaniach"
                      : null
                  }
                  actions={
                    canEdit && !pkgDraft ? (
                      <>
                        {rowButton(s.packaging ? "Zmień" : "Ustaw", () =>
                          setPkgDraft({
                            units: String(s.packaging?.unitsPerPackage ?? ""),
                            label: s.packaging?.packageLabel ?? "op.",
                            mode: s.packaging?.documentUnitMode ?? "packages",
                          })
                        )}
                        {s.packaging ? rowButton("Usuń", () => run(() => actionDeleteZdEstimatePackaging(twId)), pending) : null}
                      </>
                    ) : null
                  }
                >
                  {pkgDraft ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col text-xs font-semibold text-slate-600">
                          Sztuk w opakowaniu
                          <Input
                            type="number"
                            min={2}
                            inputMode="numeric"
                            value={pkgDraft.units}
                            onChange={(e) => setPkgDraft({ ...pkgDraft, units: e.target.value })}
                            className="mt-1"
                            autoFocus
                          />
                        </label>
                        <label className="flex flex-col text-xs font-semibold text-slate-600">
                          Nazwa
                          <Input
                            value={pkgDraft.label}
                            maxLength={20}
                            onChange={(e) => setPkgDraft({ ...pkgDraft, label: e.target.value })}
                            className="mt-1"
                          />
                        </label>
                        <label className="col-span-2 flex flex-col text-xs font-semibold text-slate-600">
                          Na ZD
                          <Select
                            value={pkgDraft.mode}
                            onChange={(e) => setPkgDraft({ ...pkgDraft, mode: e.target.value as ZdPackagingDocumentUnitMode })}
                            className="mt-1"
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
                  ) : null}
                </SettingRow>

                <SettingRow
                  title="Minimalny stan"
                  empty={s.minStockSzt == null}
                  value={s.minStockSzt != null ? `co najmniej ${formatQty(s.minStockSzt)} szt` : "Brak"}
                  actions={
                    canEdit && minDraft == null ? (
                      <>
                        {rowButton(s.minStockSzt != null ? "Zmień" : "Ustaw", () => setMinDraft(String(s.minStockSzt ?? "")))}
                        {s.minStockSzt != null ? rowButton("Usuń", () => run(() => actionDeleteZdEstimateMinStock(twId)), pending) : null}
                      </>
                    ) : null
                  }
                >
                  {minDraft != null ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex flex-col text-xs font-semibold text-slate-600">
                        Sztuk na stanie co najmniej
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={minDraft}
                          onChange={(e) => setMinDraft(e.target.value)}
                          className="mt-1 w-32"
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
                  ) : null}
                </SettingRow>

                <SettingRow
                  title="Para"
                  empty={!s.pair}
                  value={
                    s.pair
                      ? `${s.pair.role === "pack" ? "Opakowanie" : "Sztuka"} z pary · 1 op. = ${formatQty(s.pair.unitsPerPack)} szt`
                      : "Brak"
                  }
                  detail={
                    s.pair
                      ? `${s.pair.twinSymbol ? `${s.pair.twinSymbol} - ` : ""}${s.pair.twinNazwa}`
                      : "Pary ustawiasz w Kreatorze ZD → Reguły → Pary."
                  }
                />
              </div>

              {error ? (
                <p className="mt-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : pending && !editing ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-slate-600" role="status">
                  <BrandLoader size="sm" tile={false} /> Zapisuję…
                </p>
              ) : null}
            </>
          )}
        </section>

        <ZdProductNote twId={twId} symbol={ref.twSymbol} name={ref.twNazwa} canEdit={canEdit} titleId={titleId} />
      </div>

      <section aria-labelledby={`${titleId}-history`} className="min-w-0 border-t border-slate-100 pt-5 lg:border-t-0 lg:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${titleId}-history`} className={panelTypography.sectionTitle}>
            Historia
          </h3>
          <SegmentedControl value={historyTab} onChange={setHistoryTab} ariaLabel="Historia towaru" density="compact" options={[...HISTORY_TABS]} />
        </div>
        <ZdHistoryRangeBar className="mt-3" value={rangeState} onChange={setRangeState} range={range} />
        <div className="mt-4 space-y-5">
          {historyTab === "buy" ? (
            <ZdProductPurchasesSection state={history} titleId={titleId} unitFor={unitFor} range={range} older={older} onLoadOlder={loadOlder} />
          ) : historyTab === "sales" ? (
            <ZdProductSalesSections state={history} titleId={titleId} range={range} />
          ) : (
            <ZdProductMovementSection state={history} titleId={titleId} unitFor={unitFor} range={range} />
          )}
        </div>
      </section>
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
  const numeric = /^\d{1,12}$/.test(debounced);
  const active = debounced.length >= (numeric ? 1 : 2);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      setStatus("loading");
      // Zawsze symbol i nazwa naraz: pole nazwy w Subiekcie nie przeszukuje symboli, a symbol bywa z samych cyfr
      // („200224”) albo wpisany małymi literami. Same cyfry dodatkowo jako kod Mikran.
      const fields: ProductSearchField[] = [...(numeric ? (["plu"] as const) : []), ...(debounced.length >= 2 ? (["combined"] as const) : [])];
      const results = await Promise.all(fields.map((f) => actionSubiektSuggestProducts(debounced, f).catch(() => null)));
      if (cancelled) return;
      const found = results.flatMap((r) => (r?.ok ? [r.items] : []));
      if (!found.length) {
        const failed = results.find((r) => r && !r.ok);
        setItems([]);
        setStatus("error");
        setMessage(
          failed && !failed.ok
            ? (failed.feedback?.message ?? "Nie udało się wyszukać towaru.")
            : "Nie udało się połączyć z serwerem. Spróbuj ponownie."
        );
        return;
      }
      setItems(rankSubiektProductsForLookupQuery(mergeSubiektProductSearchResults(found, 12), debounced));
      setHighlight(0);
      setStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [active, debounced, numeric]);

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

  const heading = picked ? productHeading(picked) : null;

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={heading ? heading.title : "Ustawienia towaru"}
      description={
        heading
          ? heading.meta || undefined
          : "Znajdź towar w Subiekcie i ustaw, jak go zamawiać - bez liczenia listy w Kreatorze."
      }
      // Po wybraniu towaru szerzej: ustawienia i historia obok siebie.
      size={picked ? "xl" : "lg"}
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
            <p className="text-sm text-slate-500">Wpisz symbol, nazwę albo kod Mikran. Strzałki wybierają, Enter otwiera, Esc zamyka.</p>
          ) : null}
          {shown.length ? (
            <ul id={listId} role="listbox" aria-label="Towary z Subiekta" className="max-h-[min(55vh,26rem)] overflow-y-auto rounded-lg border border-slate-200">
              {shown.map((p, i) => {
                const opt = formatSubiektProductOption(p);
                const stock = typeof p.tw_Stan === "number" && Number.isFinite(p.tw_Stan) ? p.tw_Stan : null;
                return (
                  <li key={p.tw_Id} id={`${listId}-${p.tw_Id}`} role="option" aria-selected={i === highlight}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => setPicked(p)}
                      className={cn(
                        "flex w-full cursor-pointer items-start justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0",
                        i === highlight ? "bg-indigo-50" : "hover:bg-slate-50"
                      )}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-900">{opt.title}</span>
                        <span className="text-xs text-slate-600">{opt.subtitle}</span>
                      </span>
                      {stock != null ? (
                        <span className={cn("shrink-0 text-xs tabular-nums", stock > 0 ? "text-slate-700" : "text-slate-500")}>
                          {stock > 0 ? `na stanie ${formatQty(stock)} szt` : "brak na stanie"}
                        </span>
                      ) : null}
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
