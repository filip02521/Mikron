"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  actionApplyPriceListChunk,
  actionRestorePriceList,
  actionRetryFailedPriceItems,
  actionSetPriceItemsSelected,
} from "@/app/actions/price-lists";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { polishPlural, polishPluralWord } from "@/lib/email/polish-plural";
import type { PriceListImport, PriceListItem } from "@/lib/price-lists/data";
import {
  isWithdrawnName,
  marginPct,
  needsReview,
  pctChange,
  PRICE_FLAG_LABEL,
  priceBackupCsv,
  type PriceFlag,
} from "@/lib/price-lists/price-list";
import { formatDate, HostBadge } from "./PriceListsClient";

type Filter = "selected" | "review" | "problems" | "applied" | "restored" | "unchanged" | "not_in_list" | "withdrawn" | "all";

/** Kolejność = kolejność pracy: zapisz → zdecyduj → sprawdź wynik → reszta. */
const FILTERS: { key: Filter; label: string; empty: string }[] = [
  { key: "selected", label: "Do zapisu", empty: "Nic nie czeka na zapis. Zaznacz pozycje w zakładce Do przejrzenia albo Bez zmian." },
  { key: "review", label: "Do przejrzenia", empty: "Nic nie czeka na decyzję — każda zmiana ceny jest zaznaczona do zapisu albo już zapisana." },
  { key: "problems", label: "Problemy", empty: "Brak problemów — każda zapisana cena zgadza się z cennikiem." },
  { key: "applied", label: "Zapisane", empty: "Jeszcze nic nie zapisano w Subiekcie." },
  { key: "restored", label: "Przywrócone", empty: "Nic nie przywrócono z kopii." },
  { key: "unchanged", label: "Bez zmian", empty: "Każda pozycja cennika zmienia cenę." },
  { key: "not_in_list", label: "Brak w cenniku", empty: "Każdy towar cechy jest w cenniku." },
  { key: "withdrawn", label: "Wyprzedaż i wycofane", empty: "Brak towarów z wyprzedaży, outletu, wycofanych i nieaktywnych bez pozycji w cenniku." },
  { key: "all", label: "Wszystkie", empty: "Brak towarów." },
];

const PROBLEM_STATUS = new Set(["failed", "mismatch", "changed", "restore_failed"]);

function inFilter(item: PriceListItem, filter: Filter): boolean {
  switch (filter) {
    case "selected":
      return item.status === "pending" && item.selected;
    case "review":
      // Wszystko, co zmieniłoby cenę, a nie jest zaznaczone: flagi kontroli albo ręczne odznaczenie.
      return item.status === "pending" && !item.selected && !item.flags.includes("unchanged");
    case "unchanged":
      return item.status === "pending" && item.flags.includes("unchanged");
    case "applied":
      return item.status === "applied";
    case "restored":
      return item.status === "restored";
    case "problems":
      return PROBLEM_STATUS.has(item.status);
    case "not_in_list":
      // Wyprzedaże, outlet, wycofane i nieaktywne nie są w cenniku z założenia — widać je w „Wszystkie”.
      return item.status === "not_in_list" && !isWithdrawnName(item.name);
    case "withdrawn":
      return item.status === "not_in_list" && isWithdrawnName(item.name);
    case "all":
      return true;
  }
}

const money = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number | null) => (v == null ? "-" : money.format(v));
const pctText = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const cen = (n: number) => polishPlural(n, "cenę", "ceny", "cen");
const waiting = (n: number) => `${n} ${polishPluralWord(n, "pozycja czeka", "pozycje czekają", "pozycji czeka")}`;

const STATUS_BADGE: Record<PriceListItem["status"], { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  pending: { label: "Czeka", variant: "default" },
  applied: { label: "Zapisano", variant: "success" },
  mismatch: { label: "Detal ≠ cennik", variant: "warning" },
  changed: { label: "Zmieniona w Subiekcie", variant: "warning" },
  failed: { label: "Błąd zapisu", variant: "danger" },
  not_in_list: { label: "Brak w cenniku", variant: "default" },
  restored: { label: "Przywrócono z kopii", variant: "info" },
  restore_failed: { label: "Nie przywrócono", variant: "danger" },
};


function PriceCell({ oldValue, newValue, after, status }: { oldValue: number | null; newValue: number | null; after: number | null; status: PriceListItem["status"] }) {
  if (status === "not_in_list") return <span className="tabular-nums text-slate-600">{fmt(oldValue)}</span>;
  if (status === "restored") {
    return (
      <div className="whitespace-nowrap tabular-nums">
        <span className="text-slate-900">{fmt(after)}</span>
        <div className="text-xs text-slate-500">z kopii (cennik {fmt(newValue)})</div>
      </div>
    );
  }
  if (newValue == null) return <span className="text-slate-400">brak w cenniku</span>;
  const pct = pctChange(oldValue, newValue);
  const same = oldValue != null && Math.abs(newValue - oldValue) < 0.005;
  return (
    <div className="whitespace-nowrap tabular-nums">
      {same ? (
        <span className="text-slate-600">{fmt(newValue)}</span>
      ) : (
        <>
          <span className="text-slate-500 line-through decoration-slate-300">{fmt(oldValue)}</span>{" "}
          <span className="font-semibold text-slate-900">{fmt(newValue)}</span>
          {pct != null ? (
            <span className={cn("ml-1 text-xs", Math.abs(pct) > 5 ? "font-semibold text-amber-700" : "text-slate-500")}>
              {Math.abs(pct) < 0.05 ? "<0,1%" : `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`}
            </span>
          ) : null}
        </>
      )}
      {after != null && Math.abs(after - newValue) >= 0.005 ? (
        penny(after, newValue) ? (
          <div className="text-xs text-slate-500">w Subiekcie {fmt(after)} (1 gr)</div>
        ) : (
          <div className="text-xs font-semibold text-red-700">w Subiekcie {fmt(after)}</div>
        )
      ) : null}
    </div>
  );
}

/** Marża przed → po (po zapisie z cen odczytanych z Subiekta) i cel = upust z cennika. */
function MarginCell({ item }: { item: PriceListItem }) {
  const before = marginPct(item.oldPurchase, item.oldRetail);
  if (item.status === "not_in_list") return <span className="tabular-nums text-slate-600">{before == null ? "-" : pctText(before)}</span>;
  const applied = item.afterPurchase != null || item.afterRetail != null;
  const after = applied
    ? marginPct(item.afterPurchase ?? item.oldPurchase, item.afterRetail ?? item.oldRetail)
    : marginPct(item.newPurchase ?? item.oldPurchase, item.newRetail ?? item.oldRetail);
  if (after == null) return <span className="text-slate-400">-</span>;
  const diff = before == null ? null : after - before;
  const target = item.listDiscount;
  const offTarget = target != null && Math.abs(after - target) > 0.1;
  return (
    <div className="whitespace-nowrap tabular-nums">
      {diff != null && Math.abs(diff) < 0.05 ? (
        <span className="text-slate-600">{pctText(after)}</span>
      ) : (
        <>
          <span className="text-slate-500">{before == null ? "-" : pctText(before)}</span>{" "}
          <span className="font-semibold text-slate-900">{pctText(after)}</span>
          {diff != null ? (
            <span className={cn("ml-1 text-xs", diff < 0 ? "font-semibold text-red-700" : "text-emerald-700")}>
              {diff > 0 ? "+" : ""}
              {diff.toFixed(1).replace(".", ",")} pp
            </span>
          ) : null}
        </>
      )}
      {target != null ? (
        <div className={cn("text-xs", offTarget ? "font-semibold text-red-700" : "text-slate-500")}>
          upust {pctText(target)}
        </div>
      ) : null}
    </div>
  );
}

/** Różnica po zapisie do 1 gr — zaokrąglenie Subiekta, nie błąd cennika. */
function penny(after: number | null, target: number | null): boolean {
  return after != null && target != null && Math.abs(after - target) <= 0.011;
}

/** Wielkość rozbieżności po zapisie — do sortowania zakładki Problemy (największe na górze). */
function severity(it: PriceListItem): number {
  const d = (a: number | null, t: number | null) => (a == null || t == null || !t ? 0 : Math.abs(a - t) / t);
  return Math.max(d(it.afterPurchase, it.newPurchase), d(it.afterRetail, it.newRetail));
}

/** Komunikaty zapisane przez starszą wersję modułu mówiły językiem API — pokazujemy je po ludzku. */
function itemError(error: string): string {
  return error.replace(/\s*\(API przelicza narzutem[^)]*\)/, " (zapis z czasu, gdy Subiekt liczył detaliczną z narzutu)");
}

/** Wyszukiwanie bez ogonków i wielkości liter: „plyn” znajdzie „płyn”. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").toLowerCase();
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Pierwsza niepusta zakładka w kolejności pracy — po wejściu widać to, czym trzeba się zająć. */
function firstUsefulFilter(counts: Record<Filter, number>): Filter {
  return (["selected", "review", "problems", "applied"] as const).find((f) => counts[f] > 0) ?? "all";
}

const ROW_LIMIT = 300;

export function PriceListReviewClient({
  imp,
  items: initialItems,
  hostLabel,
  hostMatches,
  canApply,
  newerImportId,
  validInFuture,
  justUpdated = false,
  laterValidFrom = null,
}: {
  imp: PriceListImport;
  items: PriceListItem[];
  hostLabel: string | null;
  hostMatches: boolean;
  /** Zapis do Subiekta — tylko administrator. */
  canApply: boolean;
  /** Nowszy cennik tej cechy — ten jest nieaktualny, zapis zablokowany. */
  newerImportId: string | null;
  /** „Ważny od” jest w przyszłości — zapis zmieni ceny przed terminem. */
  validInFuture: boolean;
  /** Ten sam cennik wgrano ponownie — wpis zaktualizowany zamiast dodany. */
  justUpdated?: boolean;
  /** Ta cecha ma już cennik z późniejszą datą „ważny od” — ten jest starszy. */
  laterValidFrom?: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Pozycje, które serwer odznaczył (skala zmiany) — administrator może je zatwierdzić świadomie. */
  const [blocked, setBlocked] = useState<{ id: number; symbol: string; reason: string }[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<{ ids?: number[]; count: number; label: string } | null>(null);
  const [restoreNote, setRestoreNote] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; restoring?: boolean } | null>(null);
  /** Liczniki sprzed ostatniego zapisu — po odświeżeniu różnica to wynik tego zapisu. */
  const [runBaseline, setRunBaseline] = useState<Record<"applied" | "mismatch" | "changed" | "failed", number> | null>(null);
  const stopRef = useRef(false);
  const headerCheckRef = useRef<HTMLInputElement>(null);

  // Po router.refresh() serwer oddaje świeże pozycje.
  const [seen, setSeen] = useState(initialItems);
  if (seen !== initialItems) {
    setSeen(initialItems);
    setItems(initialItems);
  }

  const counts = useMemo(() => {
    const c = Object.fromEntries(FILTERS.map((f) => [f.key, 0])) as Record<Filter, number>;
    for (const it of items) for (const f of FILTERS) if (inFilter(it, f.key)) c[f.key]++;
    return c;
  }, [items]);
  const byStatus = useMemo(() => {
    const s = { mismatch: 0, changed: 0, failed: 0, restore_failed: 0 };
    for (const it of items) if (it.status in s) s[it.status as keyof typeof s]++;
    return s;
  }, [items]);
  /** Rozbieżności po zapisie, które są tylko zaokrągleniem o grosz. */
  const mismatchPenny = useMemo(
    () =>
      items.filter(
        (it) =>
          it.status === "mismatch" &&
          (it.newPurchase == null || it.afterPurchase == null || penny(it.afterPurchase, it.newPurchase)) &&
          (it.newRetail == null || it.afterRetail == null || penny(it.afterRetail, it.newRetail))
      ).length,
    [items]
  );

  const activeFilter = filter ?? firstUsefulFilter(counts);
  const visible = useMemo(() => {
    const q = fold(query.trim());
    return items.filter(
      (it) => inFilter(it, activeFilter) && (!q || fold(`${it.symbol} ${it.name} ${it.listName ?? ""}`).includes(q))
    );
  }, [items, activeFilter, query]);
  // Problemy: największe rozbieżności najpierw — różnice o grosz nie zasłaniają prawdziwych.
  const ordered = activeFilter === "problems" ? [...visible].sort((a, b) => severity(b) - severity(a)) : visible;
  const shown = showAll ? ordered : ordered.slice(0, ROW_LIMIT);
  const notInListAll = items.filter((i) => i.status === "not_in_list").length;
  const matched = items.length - notInListAll;
  const withdrawnHidden = counts.withdrawn;
  const running = progress != null;

  // Zaznaczanie nagłówkiem działa tylko na wierszach, które widać (limit 300), nie na ukrytych.
  const visiblePending = shown.filter((i) => i.status === "pending");
  const visibleSelected = visiblePending.filter((i) => i.selected).length;
  const allVisibleSelected = visiblePending.length > 0 && visibleSelected === visiblePending.length;

  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = visibleSelected > 0 && !allVisibleSelected;
    }
  }, [visibleSelected, allVisibleSelected]);

  // Zapis biegnie partiami z tej karty — zamknięcie jej zatrzymuje zapis.
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  async function setSelected(ids: number[], selected: boolean, override = false) {
    // Widok zostaje tam, gdzie użytkownik pracuje — bez przeskoku zakładki po zmianie liczników.
    setFilter(activeFilter);
    const editable = new Set(items.filter((i) => ids.includes(i.id) && i.status === "pending").map((i) => i.id));
    if (editable.size === 0) return;
    const before = items;
    setItems((prev) => prev.map((i) => (editable.has(i.id) ? { ...i, selected } : i)));
    try {
      const res = await actionSetPriceItemsSelected(imp.id, [...editable], selected, override);
      if (!res.ok) throw new Error(res.error);
      const skippedIds = new Set(res.skipped.map((s) => s.id));
      setItems((prev) =>
        prev.map((i) =>
          !editable.has(i.id)
            ? i
            : skippedIds.has(i.id)
              ? { ...i, selected: false }
              : override && !i.flags.includes("override")
                ? { ...i, flags: [...i.flags, "override"] }
                : i
        )
      );
      setBlocked(res.skipped);
    } catch (e) {
      setItems(before);
      setError(errorText(e, "Nie udało się zmienić zaznaczenia. Odśwież stronę i spróbuj ponownie."));
    }
  }

  async function apply() {
    setConfirming(false);
    setError(null);
    setRunBaseline({ applied: counts.applied, ...byStatus });
    setFilter(activeFilter);
    stopRef.current = false;
    const total = counts.selected;
    setProgress({ done: 0, total });
    let done = 0;
    try {
      while (!stopRef.current) {
        const res = await actionApplyPriceListChunk(imp.id);
        if (!res.ok) throw new Error(res.error);
        done += res.processed;
        setProgress({ done, total });
        if (res.remaining === 0 || res.processed === 0) break;
      }
    } catch (e) {
      setError(
        `Zapis zatrzymany po ${done} z ${total}: ${errorText(e, "brak połączenia z serwerem (sesja mogła wygasnąć)")}. Pozostałe pozycje czekają — zaloguj się ponownie, jeśli trzeba, i kliknij „Zapisz”, aby dokończyć.`
      );
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  /** Bez `ids` — wszystkie zapisane pozycje partiami; z `ids` — wskazane. */
  async function restore(ids?: number[]) {
    setConfirmRestore(null);
    setError(null);
    setRestoreNote(null);
    setFilter(activeFilter);
    stopRef.current = false;
    const total = ids?.length ?? restorable;
    setProgress({ done: 0, total, restoring: true });
    let done = 0;
    let ok = 0;
    try {
      while (!stopRef.current) {
        const res = await actionRestorePriceList(imp.id, ids);
        if (!res.ok) throw new Error(res.error);
        done += res.processed;
        ok += res.restored;
        setProgress({ done, total, restoring: true });
        if (ids || res.remaining === 0 || res.processed === 0) break;
      }
      setRestoreNote({
        tone: ok === done ? "success" : "warning",
        text:
          ok === done
            ? `Przywrócono ${cen(ok)} z kopii — Subiekt ma znowu ceny sprzed cennika.`
            : `Przywrócono ${ok} z ${done}. Pozostałe są w zakładce Problemy z powodem (np. ręczna zmiana w Subiekcie po zapisie).`,
      });
    } catch (e) {
      setError(`Przywracanie zatrzymane po ${done} z ${total}: ${errorText(e, "brak połączenia z serwerem")}. Kliknij ponownie, aby dokończyć.`);
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  async function retryFailed() {
    try {
      const res = await actionRetryFailedPriceItems(imp.id);
      if (!res.ok) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      setError(errorText(e, "Nie udało się przywrócić pozycji."));
    }
  }

  function chooseFilter(f: Filter) {
    setFilter(f);
    setShowAll(false);
  }

  const stamp = (iso: string) => new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
  const created = stamp(imp.createdAt);
  const backupRows = items.filter((i) => i.backupAt);
  const restorable = backupRows.filter((i) => i.status === "applied" || i.status === "mismatch").length;

  function downloadBackup() {
    const csv = priceBackupCsv(
      backupRows.map((i) => ({
        symbol: i.symbol,
        name: i.name,
        backupPurchase: i.backupPurchase,
        backupRetail: i.backupRetail,
        backupAt: i.backupAt,
        // Ostatni odczyt z Subiekta: po zapisie/przywróceniu after_*, inaczej z podglądu.
        nowPurchase: i.afterPurchase ?? i.oldPurchase,
        nowRetail: i.afterRetail ?? i.oldRetail,
      }))
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kopia-cen-${imp.cechaName}-${(imp.validFrom ?? imp.createdAt).slice(0, 10)}.csv`.replace(/[^\w.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }
  const activeEmpty = FILTERS.find((f) => f.key === activeFilter)!.empty;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/zakupy/cenniki" className="rounded text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45">
          ← Cenniki
        </Link>
      </div>
      <PageHeader
        title={`Cennik ${imp.cechaName}`}
        badge={<HostBadge isLive={imp.hostKind === "live"} />}
        actions={
          backupRows.length ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={downloadBackup} title="Ceny w Subiekcie sprzed pierwszego wgrania tego cennika">
                Pobierz kopię cen sprzed cennika
              </Button>

            </div>
          ) : null
        }
        description={`Ważny od ${formatDate(imp.validFrom)} · ${matched} z ${polishPlural(imp.pricelistRows, "pozycji", "pozycji", "pozycji")} cennika to nasze towary · ${polishPlural(counts.not_in_list, "towar cechy nie ma", "towary cechy nie mają", "towarów cechy nie ma")} w cenniku${withdrawnHidden ? ` (osobno ${withdrawnHidden} z wyprzedaży, outletu, wycofanych i nieaktywnych)` : ""}`}
      />
      {!hostMatches ? (
        <Alert tone="warning" title="Inny Subiekt niż przy wgraniu">
          {`Ten cennik porównano z ${imp.hostKind === "live" ? "LIVE :5080" : "testem :5082"}, a OnTime wskazuje teraz ${hostLabel ?? "brak hosta"}. Zapis jest zablokowany — wgraj cennik ponownie.`}
        </Alert>
      ) : null}
      {justUpdated ? (
        <Alert tone="info" title="Ten cennik był już wgrany — zaktualizowałem go">
          {`Nie dodałem nowego wpisu: porównanie jest odświeżone, zapisane wcześniej ceny, które dalej zgadzają się z cennikiem, liczą się jako zapisane (${counts.applied}). Kopia cen sprzed pierwszego wgrania zostaje bez zmian.`}
        </Alert>
      ) : null}
      {newerImportId ? (
        <Alert tone="warning" title="Ten cennik zastąpił nowszy">
          <p>Zapisywać i przywracać ceny możesz w nowszym cenniku. Tutaj zostaje historia i kopia cen.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/zakupy/cenniki/${newerImportId}`}
              className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 focus-visible:ring-offset-2"
            >
              Otwórz nowszy cennik
            </Link>
            {canApply && restorable > 0 && hostMatches ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={running}
                onClick={() => setConfirmRestore({ count: restorable, label: cen(restorable) })}
                title="Cofa ceny zapisane z tego cennika, których nowszy cennik nie zmienił"
              >
                Przywróć ceny sprzed tego cennika
              </Button>
            ) : null}
          </div>
        </Alert>
      ) : null}
      {laterValidFrom && !newerImportId ? (
        <Alert tone="warning" title={`To starszy cennik — jest już cennik ważny od ${formatDate(laterValidFrom)}`}>
          Zapis stąd przywróci ceny sprzed nowszego cennika. Upewnij się, że to zamierzone.
        </Alert>
      ) : null}
      {validInFuture && !newerImportId ? (
        <Alert tone="warning" title={`Cennik obowiązuje od ${formatDate(imp.validFrom)}`}>
          Zapis zmieni ceny w Subiekcie od razu, przed tą datą. Handlowcy zobaczą nowe ceny już dziś.
        </Alert>
      ) : null}

      {runBaseline && !running ? (
        <LastRun
          applied={counts.applied - runBaseline.applied}
          mismatch={byStatus.mismatch - runBaseline.mismatch}
          changed={byStatus.changed - runBaseline.changed}
          failed={byStatus.failed - runBaseline.failed}
          onShow={chooseFilter}
          onClose={() => setRunBaseline(null)}
        />
      ) : null}

      <StatusPanel
        counts={counts}
        byStatus={byStatus}
        activeFilter={activeFilter}
        progress={progress}
        hostMatches={hostMatches && !newerImportId}
        superseded={newerImportId != null}
        mismatchPenny={mismatchPenny}
        onRestoreAll={
          canApply && restorable > 0 && !newerImportId && hostMatches
            ? () => setConfirmRestore({ count: restorable, label: cen(restorable) })
            : null
        }
        canApply={canApply}
        isLive={imp.hostKind === "live"}
        onApply={() => setConfirming(true)}
        onStop={() => (stopRef.current = true)}
        onRetry={retryFailed}
        onShow={chooseFilter}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {restoreNote && !running ? (
        <Alert tone={restoreNote.tone} title="Przywracanie z kopii zakończone">
          {restoreNote.text}
        </Alert>
      ) : null}
      {blocked.length ? (
        <Alert tone="warning" title={`Nie zaznaczono ${polishPlural(blocked.length, "pozycji", "pozycji", "pozycji")} — zbyt duża zmiana ceny`}>
          <ul className="space-y-0.5">
            {blocked.slice(0, 5).map((b) => (
              <li key={b.id}>
                <strong className="font-semibold">{b.symbol}</strong> — {b.reason}
              </li>
            ))}
            {blocked.length > 5 ? <li>…i {blocked.length - 5} więcej</li> : null}
          </ul>
          {canApply ? (
            <>
              <p className="mt-2">Jeśli to stara cena w Subiekcie jest błędna, a cennik jest dobry — zatwierdź świadomie.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSelected(blocked.map((b) => b.id), true, true)}>
                  Zaznacz mimo to
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBlocked([])}>
                  Zostaw odznaczone
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-2">Zatwierdzić taką zmianę może administrator.</p>
          )}
        </Alert>
      ) : null}

      <Card padding={false}>
        <div className="flex flex-col gap-3 p-4 sm:px-6 xl:flex-row xl:items-center">
          <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1 xl:pb-0">
            <SegmentedControl
              ariaLabel="Widok pozycji"
              className="w-max max-w-none"
              value={activeFilter}
              onChange={chooseFilter}
              options={FILTERS.filter((f) => counts[f.key] > 0 || f.key === activeFilter || f.key === "all").map((f) => ({
                value: f.key,
                label: (
                  <span className="whitespace-nowrap">
                    {f.label}{" "}
                    <span className="tabular-nums text-slate-500">
                      {counts[f.key]}
                    </span>
                  </span>
                ),
              }))}
            />
          </div>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj numeru lub nazwy…"
            aria-label="Szukaj numeru lub nazwy"
            className="sm:max-w-xs xl:ml-auto xl:w-60 xl:shrink-0"
          />
        </div>

        <TableScroll className="max-h-[min(75dvh,60rem)] overflow-y-auto overscroll-y-contain">
          <DataTable className="[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[1]">
            <thead>
              <tr>
                <th className="w-8">
                  {visiblePending.length > 0 ? (
                    <input
                      ref={headerCheckRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={running}
                      onChange={(e) => setSelected(visiblePending.map((i) => i.id), e.target.checked)}
                      aria-label={allVisibleSelected ? "Odznacz widoczne" : `Zaznacz widoczne (${visiblePending.length})`}
                      title={allVisibleSelected ? "Odznacz widoczne" : `Zaznacz widoczne (${visiblePending.length})`}
                      className="h-5 w-5 cursor-pointer accent-indigo-600"
                    />
                  ) : null}
                </th>
                <th>Numer</th>
                <th>Towar w Subiekcie / w cenniku</th>
                <th>Kartotekowa netto</th>
                <th>Detaliczna netto</th>
                <th title="(detal − zakup) / detal; cel = upust z cennika">Marża</th>
                <th>VAT</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it) => (
                <tr key={it.id} className={cn(it.selected && it.status === "pending" && "bg-indigo-50/40")}>
                  <td>
                    {it.status === "pending" ? (
                      <input
                        type="checkbox"
                        checked={it.selected}
                        disabled={running}
                        onChange={(e) => setSelected([it.id], e.target.checked)}
                        aria-label={`Zapisz ${it.symbol}`}
                        className="h-5 w-5 cursor-pointer accent-indigo-600"
                      />
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">{it.symbol}</td>
                  <td className="min-w-[18rem] max-w-[30rem]">
                    <div className="text-slate-900">{it.name}</div>
                    {it.listName ? (
                      <div className="text-xs text-slate-500">
                        {it.listName}
                        {it.listRow ? <span> · wiersz {it.listRow}</span> : null}
                      </div>
                    ) : null}
                    <ItemNotes
                      item={it}
                      canRestore={canApply && hostMatches && !newerImportId && !running}
                      onRestore={() => setConfirmRestore({ ids: [it.id], count: 1, label: `cenę ${it.symbol}` })}
                    />
                  </td>
                  <td>
                    <PriceCell oldValue={it.oldPurchase} newValue={it.newPurchase} after={it.afterPurchase} status={it.status} />
                  </td>
                  <td>
                    <PriceCell oldValue={it.oldRetail} newValue={it.newRetail} after={it.afterRetail} status={it.status} />
                  </td>
                  <td>
                    <MarginCell item={it} />
                  </td>
                  <td className="whitespace-nowrap tabular-nums text-xs">
                    {it.vatSubiekt == null ? "-" : `${it.vatSubiekt}%`}
                    {it.vatList != null && it.vatList !== it.vatSubiekt ? (
                      <div className="font-semibold text-red-700">cennik {it.vatList}%</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableScroll>
        {visible.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-slate-500 sm:px-6">
            {query.trim() ? `Nic nie pasuje do „${query.trim()}” w tej zakładce.` : activeEmpty}
          </p>
        ) : null}
        {!showAll && visible.length > ROW_LIMIT ? (
          <div className="px-4 pb-6 sm:px-6">
            <Button variant="secondary" size="sm" onClick={() => setShowAll(true)}>
              Pokaż wszystkie {visible.length}
            </Button>
          </div>
        ) : null}
      </Card>

      <p className="break-words text-xs text-slate-500">
        Plik {imp.fileName} · wgrano {created}
        {imp.createdByName ? ` · ${imp.createdByName}` : ""}
        {imp.updatedAt ? ` · zaktualizowano ${stamp(imp.updatedAt)} (wgrany ${imp.uploadCount}×)` : ""}
      </p>

      <ConfirmDialog
        open={confirming}
        title={`Zapisać ${cen(counts.selected)} w Subiekcie?`}
        summary={imp.hostKind === "live" ? "LIVE :5080 — baza produkcyjna, zmiany od razu widzą handlowcy" : "Subiekt testowy :5082 — produkcja bez zmian"}
        message={`${laterValidFrom ? `Uwaga: to starszy cennik (jest nowszy, ważny od ${formatDate(laterValidFrom)}). ` : ""}${validInFuture ? `Cennik obowiązuje od ${formatDate(imp.validFrom)} — ceny zmienią się już teraz. ` : ""}Przed każdym zapisem sprawdzę, czy cena w Subiekcie nie zmieniła się od podglądu (wtedy pominę towar), a po zapisie odczytam ją ponownie i porównam z cennikiem. Ceny sprzed zmiany zostają w historii. Nie zamykaj tej karty do końca zapisu.`}
        confirmLabel={`Zapisz ${cen(counts.selected)}`}
        summaryTone={imp.hostKind === "live" ? "warning" : "neutral"}
        danger={imp.hostKind === "live"}
        onCancel={() => setConfirming(false)}
        onConfirm={apply}
      />
      <ConfirmDialog
        open={confirmRestore != null}
        title={`Przywrócić ${confirmRestore?.label ?? ""} z kopii${backupRows[0]?.backupAt ? ` z ${stamp(backupRows[0].backupAt)}` : ""}?`}
        summary={imp.hostKind === "live" ? "LIVE :5080 — baza produkcyjna" : "Subiekt testowy :5082"}
        message={`Wpiszę z powrotem kartotekową i detaliczną sprzed pierwszego wgrania tego cennika${backupRows[0]?.backupAt ? ` (kopia z ${stamp(backupRows[0].backupAt)})` : ""}. Dotyczy tylko cen zapisanych z tego cennika. Jeśli ktoś zmienił cenę w Subiekcie ręcznie po zapisie, tej pozycji nie ruszę. Po zapisie odczytam każdą cenę i porównam z kopią.${newerImportId ? " To starszy cennik: pozycje zmienione później przez nowszy cennik pominę — żeby cofnąć oba, najpierw przywróć nowszy." : ""}`}
        confirmLabel={confirmRestore?.ids ? "Przywróć cenę" : `Przywróć ${confirmRestore?.label ?? ""}`}
        summaryTone={imp.hostKind === "live" ? "warning" : "neutral"}
        danger
        onCancel={() => setConfirmRestore(null)}
        onConfirm={() => restore(confirmRestore?.ids)}
      />
    </div>
  );
}

/** Potwierdzenie zakończonego zapisu: ile weszło dokładnie, ile wymaga uwagi. */
function LastRun({
  applied,
  mismatch,
  changed,
  failed,
  onShow,
  onClose,
}: {
  applied: number;
  mismatch: number;
  changed: number;
  failed: number;
  onShow: (f: Filter) => void;
  onClose: () => void;
}) {
  const total = applied + mismatch + changed + failed;
  if (total <= 0) return null;
  const issues = mismatch + changed + failed;
  return (
    <Alert tone={issues ? "warning" : "success"} title={`Zapisano ${cen(total)} w Subiekcie`}>
      <p>
        {[
          applied ? `${polishPlural(applied, "zgodna", "zgodne", "zgodnych")} z cennikiem co do grosza` : null,
          mismatch ? `${mismatch} z inną detaliczną` : null,
          changed ? `${changed} pominięto (zmiana w Subiekcie)` : null,
          failed ? `${failed} z błędem` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        .
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {issues ? (
          <Button size="sm" variant="secondary" onClick={() => onShow("problems")}>
            Pokaż problemy
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onClose}>
          Zamknij
        </Button>
      </div>
    </Alert>
  );
}

/**
 * Jedno miejsce, które odpowiada na pytanie „co teraz?”: zapis, decyzja, wynik albo postęp.
 */
function StatusPanel({
  counts,
  byStatus,
  activeFilter,
  progress,
  hostMatches,
  superseded,
  mismatchPenny,
  onRestoreAll,
  canApply,
  isLive,
  onApply,
  onStop,
  onRetry,
  onShow,
}: {
  counts: Record<Filter, number>;
  byStatus: { mismatch: number; changed: number; failed: number; restore_failed: number };
  activeFilter: Filter;
  progress: { done: number; total: number; restoring?: boolean } | null;
  hostMatches: boolean;
  superseded: boolean;
  mismatchPenny: number;
  /** Cofnięcie zapisu z kopii — przy wyniku zapisu, którego dotyczy (null = niedostępne). */
  onRestoreAll: (() => void) | null;
  canApply: boolean;
  isLive: boolean;
  onApply: () => void;
  onStop: () => void;
  onRetry: () => void;
  onShow: (f: Filter) => void;
}) {
  if (progress) {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <Card className="space-y-3" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4 sm:px-6" role="status" aria-live="polite">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {progress.restoring ? "Przywracam z kopii" : "Zapisuję"} w Subiekcie {isLive ? "LIVE" : "testowym"}: {progress.done} z {progress.total}
            </p>
            <p className="text-xs text-slate-500">Nie zamykaj tej karty. Każdą cenę po zapisie sprawdzam ponownie.</p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
            >
              <div
                className="h-full origin-left rounded-full bg-indigo-600 transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${pct / 100})` }}
              />
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onStop}>
            Zatrzymaj po tej partii
          </Button>
        </div>
      </Card>
    );
  }

  const problems = byStatus.mismatch + byStatus.changed + byStatus.failed + byStatus.restore_failed;
  // Zastąpiony cennik: baner powyżej mówi, co dalej — drugi panel tylko by go powtarzał.
  if (superseded) return null;
  const lines: React.ReactNode[] = [];
  const realMismatch = byStatus.mismatch - mismatchPenny;
  if (realMismatch > 0) {
    lines.push(
      <li key="m">
        <strong className="font-semibold">{polishPlural(realMismatch, "cena różni", "ceny różnią", "cen różni")}</strong> się od cennika po zapisie
        (największe różnice są na górze zakładki Problemy). Wgraj cennik ponownie: te pozycje trafią do „Do zapisu”.
      </li>
    );
  }
  if (mismatchPenny > 0) {
    lines.push(
      <li key="p">
        {polishPlural(mismatchPenny, "cena różni", "ceny różnią", "cen różni")} się o 1 gr (zaokrąglenie Subiekta). Ponowne wgranie cennika wyrówna je dokładnie.
      </li>
    );
  }
  if (byStatus.changed) {
    lines.push(
      <li key="c">
        <strong className="font-semibold">{polishPlural(byStatus.changed, "cena zmieniła", "ceny zmieniły", "cen zmieniło")}</strong> się w Subiekcie po podglądzie — nie nadpisałem tych zmian. Sprawdź w Subiekcie i wgraj cennik ponownie, jeśli trzeba.
      </li>
    );
  }
  if (byStatus.restore_failed) {
    lines.push(
      <li key="r">
        <strong className="font-semibold">Nie przywrócono {polishPlural(byStatus.restore_failed, "ceny", "cen", "cen")}</strong> z kopii: ktoś zmienił je w Subiekcie po zapisie albo zapis się nie udał. Powód jest przy pozycji; ręcznej zmiany nie nadpisuję.
      </li>
    );
  }
  if (byStatus.failed) {
    lines.push(
      <li key="f">
        <strong className="font-semibold">{polishPlural(byStatus.failed, "zapis się nie udał", "zapisy się nie udały", "zapisów się nie udało")}</strong> — można je ponowić.
      </li>
    );
  }

  return (
    <Card padding={false}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-6">
        <div className="min-w-0 flex-1">
          {counts.selected > 0 ? (
            <>
              <p className="text-base font-semibold text-slate-900">{polishPlural(counts.selected, "cena", "ceny", "cen")} do zapisu</p>
              <p className="text-sm text-slate-600">
                {counts.review > 0 ? (
                  <>
                    Dodatkowo{" "}
                    <button type="button" className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600" onClick={() => onShow("review")}>
                      {waiting(counts.review)} na Twoją decyzję
                    </button>{" "}
                    (m.in. duża zmiana ceny, karton, VAT lub marża) — nie zapiszę ich bez zaznaczenia.
                  </>
                ) : (
                  "Kartotekowa i detaliczna według cennika, z kontrolą po zapisie."
                )}
              </p>
            </>
          ) : counts.review > 0 ? (
            <>
              <p className="text-base font-semibold text-slate-900">{waiting(counts.review)} na Twoją decyzję</p>
              <p className="text-sm text-slate-600">Zmiany odłożone do kontroli (duża zmiana ceny, karton, VAT, marża) albo odznaczone ręcznie. Zaznacz te, które mają trafić do Subiekta.</p>
            </>
          ) : counts.applied + problems > 0 ? (
            <>
              <p className={cn("text-base font-semibold", problems ? "text-amber-900" : "text-slate-900")}>
                {problems === 0
                  ? `Cennik zapisany: ${polishPlural(counts.applied, "cena zgodna", "ceny zgodne", "cen zgodnych")} z cennikiem co do grosza`
                  : counts.applied === 0
                    ? `${polishPlural(problems, "pozycja wymaga", "pozycje wymagają", "pozycji wymaga")} uwagi`
                    : `Zapisano ${polishPlural(counts.applied, "cenę zgodną", "ceny zgodne", "cen zgodnych")} z cennikiem, ${polishPlural(problems, "pozycja wymaga", "pozycje wymagają", "pozycji wymaga")} uwagi`}
              </p>
              {lines.length ? <ul className="mt-1 space-y-1 text-sm text-slate-700">{lines}</ul> : null}
            </>
          ) : counts.restored > 0 ? (
            <>
              <p className="text-base font-semibold text-slate-900">{polishPlural(counts.restored, "cena przywrócona", "ceny przywrócone", "cen przywróconych")} z kopii</p>
              <p className="text-sm text-slate-600">Subiekt ma ceny sprzed tego cennika. Żeby zapisać cennik jeszcze raz, wgraj go ponownie.</p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-900">Nic do zapisania</p>
              <p className="text-sm text-slate-600">Ceny w Subiekcie zgadzają się z cennikiem.</p>
            </>
          )}
          {counts.selected > 0 && lines.length ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">{lines}</ul>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onRestoreAll && counts.selected === 0 ? (
            <Button variant="ghost" onClick={onRestoreAll}>
              Przywróć ceny sprzed cennika
            </Button>
          ) : null}
          {byStatus.failed > 0 ? (
            <Button variant="secondary" onClick={onRetry}>
              Ponów błędne
            </Button>
          ) : null}
          {counts.selected === 0 && counts.review > 0 && activeFilter !== "review" ? (
            <Button variant="secondary" onClick={() => onShow("review")}>
              Przejrzyj
            </Button>
          ) : null}
          {counts.selected === 0 && counts.review === 0 && problems > 0 && activeFilter !== "problems" ? (
            <Button variant="secondary" onClick={() => onShow("problems")}>
              Pokaż problemy
            </Button>
          ) : null}
          {counts.selected > 0 && canApply ? (
            <Button variant={isLive ? "danger" : "primary"} onClick={onApply} disabled={!hostMatches}>
              Zapisz {cen(counts.selected)}
            </Button>
          ) : counts.selected > 0 ? (
            <p className="text-sm text-slate-600">Zapis do Subiekta wykonuje administrator.</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/**
 * Stan, flagi kontroli, powód i akcja pozycji — pod nazwą towaru, żeby powód decyzji był widoczny
 * bez przewijania tabeli w bok.
 */
function ItemNotes({ item, canRestore, onRestore }: { item: PriceListItem; canRestore: boolean; onRestore: () => void }) {
  // Flagi kontroli dotyczą decyzji przed zapisem; po zapisie liczy się wynik.
  const flags = item.status === "pending" ? item.flags.filter((f) => f !== "unchanged") : [];
  const restorable =
    canRestore && item.backupAt != null && (item.status === "applied" || item.status === "mismatch" || item.status === "restore_failed");
  if (item.status === "pending" && flags.length === 0 && !item.error) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap gap-1">
        {item.status !== "pending" ? <Badge variant={STATUS_BADGE[item.status].variant}>{STATUS_BADGE[item.status].label}</Badge> : null}
        {flags.map((f) => (
          <Badge key={f} variant={needsReview([f]) ? "warning" : "default"}>
            {f === "pack" ? `Karton ÷${item.packFactor}` : f === "piece" ? `Sztuka z opakowania ÷${item.packFactor}` : PRICE_FLAG_LABEL[f as PriceFlag] ?? f}
          </Badge>
        ))}
      </div>
      {/* Przy „Detal ≠ cennik” komórka ceny już pokazuje wartość z Subiekta — tekst by ją powtarzał. */}
      {item.error && item.status !== "mismatch" ? <p className="text-xs text-red-700">{itemError(item.error)}</p> : null}
      {restorable ? (
        <button
          type="button"
          className="-mx-1 inline-flex min-h-8 items-center whitespace-nowrap rounded px-1 text-xs font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45"
          onClick={onRestore}
        >
          {item.status === "restore_failed" ? "Spróbuj przywrócić ponownie" : "Przywróć z kopii"}: {fmt(item.backupPurchase)} / {fmt(item.backupRetail)}
        </button>
      ) : null}
    </div>
  );
}
