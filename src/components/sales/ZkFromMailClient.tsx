"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  actionZkMailAnalyze,
  actionZkMailCreate,
  actionZkMailSearchClients,
  actionZkMailSearchProducts,
  type ZkMailCreateResult,
} from "@/app/actions/zk-from-mail";
import type { MatchLevel, ZkClientOption, ZkProductOption } from "@/lib/sales/zk-from-mail/match";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Spinner } from "@/components/ui/Spinner";
import { fieldControlClass } from "@/components/ui/Field";
import { IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { panelTypography, salesPageShellClass } from "@/lib/ui/ontime-theme";
import { polishPlural } from "@/lib/email/polish-plural";
import { cn } from "@/lib/cn";

type Row = {
  key: string;
  text: string;
  /** Grupa z chwili rozpoznania — wybór towaru nie przesuwa wiersza. */
  group: MatchLevel;
  reason: string;
  chosen: ZkProductOption | null;
  /** Wybrane ręcznie (nie z pewnego dopasowania). */
  picked: boolean;
  candidates: ZkProductOption[];
  qty: string;
};

type ClientState = {
  level: MatchLevel;
  reason: string;
  chosen: ZkClientOption | null;
  picked: boolean;
  candidates: ZkClientOption[];
};

const GROUPS: Array<{ level: MatchLevel; title: string }> = [
  { level: "brak", title: "Do wyboru" },
  { level: "do_sprawdzenia", title: "Do sprawdzenia" },
  { level: "pewne", title: "Rozpoznane" },
];

const linkButtonClass =
  "text-[0.8125rem] text-indigo-700 underline underline-offset-2 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm";

function todayLabel(): string {
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Warsaw" }).format(new Date());
}

function StatusBadge({ group, chosen, picked }: { group: MatchLevel; chosen: unknown; picked: boolean }) {
  if (chosen && picked) return <Badge variant="info">Wybrane</Badge>;
  // W grupie „Rozpoznane” stan mówi nagłówek grupy — bez drugiej odznaki z tym samym.
  if (chosen) return group === "pewne" ? null : <Badge variant="success">Pewne</Badge>;
  return group === "brak" ? <Badge variant="danger">Brak dopasowania</Badge> : <Badge variant="warning">Do sprawdzenia</Badge>;
}

function ProductLabel({ p }: { p: ZkProductOption }) {
  return (
    <span className="text-sm text-slate-900">
      <span className="font-mono text-xs text-slate-600">{p.symbol}</span> {p.nazwa}
    </span>
  );
}

/** Pole szukania w Subiekcie z listą wyników do kliknięcia (towar albo klient). */
function SubiektSearch<T>({
  label,
  placeholder,
  search,
  renderItem,
  itemKey,
  onPick,
}: {
  label: string;
  placeholder: string;
  search: (q: string) => Promise<{ ok: true; items: T[] } | { ok: false; message: string }>;
  renderItem: (item: T) => React.ReactNode;
  itemKey: (item: T) => number;
  onPick: (item: T) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await search(query);
      if (res.ok) {
        setItems(res.items);
        setError(null);
      } else {
        setItems(null);
        setError(res.message);
      }
    });
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          aria-label={label}
          className={fieldControlClass("default", "min-w-0 flex-1")}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
        />
        <Button variant="secondary" onClick={run} disabled={pending} aria-label={`Szukaj: ${label}`}>
          {pending ? <Spinner className="h-4 w-4" /> : <IconSearch className="h-4 w-4" />}
          <span className="hidden sm:inline">Szukaj</span>
        </Button>
      </div>
      {error ? <p className="text-[0.8125rem] text-red-700">{error}</p> : null}
      {items && items.length === 0 ? <p className={panelTypography.rowMeta}>Nic nie znaleziono. Wpisz symbol albo inną część nazwy.</p> : null}
      {items && items.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {items.map((item) => (
            <li key={itemKey(item)}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => onPick(item)}
              >
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CandidateList<T>({
  items,
  itemKey,
  itemLabel,
  renderItem,
  onPick,
}: {
  items: T[];
  itemKey: (item: T) => number;
  /** Dla czytnika ekranu: „Wybierz: 517019 Gnathostar”, nie pięć razy „Wybierz”. */
  itemLabel: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onPick: (item: T) => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={itemKey(item)} className="flex items-start justify-between gap-2">
          <span className="min-w-0">{renderItem(item)}</span>
          <Button size="sm" variant="secondary" onClick={() => onPick(item)} aria-label={`Wybierz: ${itemLabel(item)}`}>
            Wybierz
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ClientLabel({ c }: { c: ZkClientOption }) {
  const meta = [c.nip ? `NIP ${c.nip}` : "", c.miejscowosc, c.email].filter(Boolean).join(" · ");
  return (
    <span className="block">
      <span className={panelTypography.rowTitle}>{c.nazwa || `Klient ${c.khId}`}</span>
      {meta ? <span className={cn("block break-words", panelTypography.rowMeta)}>{meta}</span> : null}
    </span>
  );
}

export function ZkFromMailClient({ hostError }: { hostError: string | null }) {
  const [mail, setMail] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [client, setClient] = useState<ClientState | null>(null);
  const [changingClient, setChangingClient] = useState(false);
  /** Pole szukania klienta, gdy są podpowiedzi — schowane za linkiem, żeby nie dublować wyboru. */
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [searchingRow, setSearchingRow] = useState<string | null>(null);
  const [uwagi, setUwagi] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<Extract<ZkMailCreateResult, { ok: true }> | null>(null);
  /** Subiekt mógł zapisać ZK, ale nie potwierdził — ponowne „Utwórz” zrobiłoby duplikat. */
  const [uncertain, setUncertain] = useState<string | null>(null);
  const [skippedLines, setSkippedLines] = useState(0);
  const submittingRef = useRef(false);
  const [analyzing, startAnalyze] = useTransition();
  const [creating, startCreate] = useTransition();
  const rowSeq = useRef(0);

  const analyze = () =>
    startAnalyze(async () => {
      setAnalyzeError(null);
      setSubmitError(null);
      const res = await actionZkMailAnalyze(mail);
      if (!res.ok) {
        setAnalyzeError(res.message);
        return;
      }
      setClient({ ...res.client, picked: false });
      setChangingClient(false);
      setClientSearchOpen(false);
      setSearchingRow(null);
      setSkippedLines(res.skippedLines);
      setRows(
        res.lines.map((l) => ({
          key: `r${rowSeq.current++}`,
          text: l.text,
          group: l.level,
          reason: l.reason,
          chosen: l.chosen,
          picked: false,
          candidates: l.candidates,
          qty: l.quantity == null ? "" : String(l.quantity),
        }))
      );
      setUwagi(`Z maila${res.senderEmail ? ` od ${res.senderEmail}` : ""}, ${todayLabel()}`);
    });

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => (prev ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => {
    const key = `r${rowSeq.current++}`;
    setRows((prev) => [...(prev ?? []), { key, text: "Dodane ręcznie", group: "brak", reason: "", chosen: null, picked: false, candidates: [], qty: "" }]);
    setSearchingRow(key);
  };

  const missing = useMemo(() => {
    if (!rows) return null;
    const noProduct = rows.filter((r) => !r.chosen).length;
    const noQty = rows.filter((r) => !(Number(r.qty.replace(",", ".")) > 0)).length;
    const parts: string[] = [];
    if (!client?.chosen) parts.push("wybierz klienta");
    if (rows.length === 0) parts.push("dodaj pozycję");
    if (noProduct) parts.push(`wybierz towar dla ${polishPlural(noProduct, "pozycji", "pozycji", "pozycji")}`);
    if (noQty) parts.push(`wpisz ilość w ${polishPlural(noQty, "pozycji", "pozycjach", "pozycjach")}`);
    return parts.length ? `Najpierw ${parts.join(", ")}.` : null;
  }, [rows, client]);

  const counts = useMemo(() => {
    // Liczy to, co jeszcze czeka na decyzję — wybór towaru przenosi wiersz do „gotowe”, nie w inną grupę.
    const c = { brak: 0, do_sprawdzenia: 0, ready: 0 };
    for (const r of rows ?? []) {
      if (r.chosen) c.ready++;
      else if (r.group === "brak") c.brak++;
      else c.do_sprawdzenia++;
    }
    return c;
  }, [rows]);

  const create = () => {
    if (missing) {
      setSubmitError(missing);
      return;
    }
    // Dwa kliknięcia w jednej klatce: isPending jeszcze false, a każde wywołanie to osobne ZK w Subiekcie.
    if (submittingRef.current) return;
    submittingRef.current = true;
    startCreate(async () => {
      try {
        setSubmitError(null);
        const res = await actionZkMailCreate({
          khId: client?.chosen?.khId,
          lines: (rows ?? []).map((r) => ({ towarId: r.chosen?.towarId, symbol: r.chosen?.symbol, ilosc: Number(r.qty.replace(",", ".")) })),
          uwagi,
        });
        if (res.ok) setCreated(res);
        else if (res.uncertain) setUncertain(res.message);
        else setSubmitError(res.message);
      } finally {
        submittingRef.current = false;
      }
    });
  };

  const reset = () => {
    setMail("");
    setClient(null);
    setRows(null);
    setCreated(null);
    setUncertain(null);
    setSubmitError(null);
    setSkippedLines(0);
    setUwagi("");
  };

  const locked = Boolean(created) || Boolean(uncertain) || creating;
  const lineCount = rows?.length ?? 0;

  return (
    <div className={salesPageShellClass}>
      <PageHeader
        back={{ href: "/zk", label: "ZK czekające" }}
        title="Nowe ZK z maila"
        description="Wklej mail klienta. OnTime podpowie klienta i towary, Ty je sprawdzasz, a ZK powstaje w Subiekcie dopiero po kliknięciu „Utwórz”."
      />

      {hostError ? (
        <Alert tone="error" title="Tworzenie ZK jest wyłączone">
          {hostError}
        </Alert>
      ) : (
        <Alert tone="warning" title="Tryb testowy">
          ZK trafi do kopii testowej Subiekta, nie do bazy MIKRAN.
        </Alert>
      )}

      <Card className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-600">Treść maila</span>
          <textarea
            className={fieldControlClass("default", "min-h-40 sm:min-h-48 font-mono text-[0.8125rem] sm:text-[0.8125rem]")}
            placeholder={"Od: klient@firma.pl\n\n- symbol albo nazwa towaru – ilość"}
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            disabled={locked || Boolean(hostError)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={analyze} disabled={analyzing || locked || Boolean(hostError)}>
            {analyzing ? <Spinner className="h-4 w-4" /> : null}
            {analyzing ? "Szukam w Subiekcie…" : rows ? "Rozpoznaj jeszcze raz" : "Rozpoznaj klienta i towary"}
          </Button>
          {rows && !analyzing ? (
            <span className={panelTypography.rowMeta}>
              {rows.length ? `Rozpoznano ${polishPlural(rows.length, "pozycję", "pozycje", "pozycji")} z maila` : "W mailu nie ma linii z ilością ani symbolem"}
            </span>
          ) : null}
        </div>
        {analyzing ? (
          <div role="status" className="flex items-center gap-2 text-[0.8125rem] text-slate-600">
            <BrandLoader size="sm" tile={false} />
            Szukam klienta i towarów w Subiekcie, zwykle kilka sekund.
          </div>
        ) : null}
        {analyzeError ? <Alert tone="error">{analyzeError}</Alert> : null}
        {skippedLines > 0 && !analyzing ? (
          <Alert tone="warning" title={`Pominięto ${polishPlural(skippedLines, "linię", "linie", "linii")} z maila`}>
            OnTime czyta najwyżej 30 pozycji naraz. Brakujące dodaj przyciskiem „Dodaj pozycję” albo wklej resztę maila w kolejnym ZK.
          </Alert>
        ) : null}
      </Card>

      {client ? (
        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className={panelTypography.sectionTitle}>Klient</h2>
            {client.chosen && !client.picked ? (
              <Badge variant="success">Pewne</Badge>
            ) : (
              <StatusBadge group={client.level} chosen={client.chosen} picked={client.picked} />
            )}
          </div>
          {client.chosen && !changingClient ? (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <ClientLabel c={client.chosen} />
              {!locked ? (
                <button type="button" className={linkButtonClass} onClick={() => setChangingClient(true)}>
                  Zmień klienta
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={panelTypography.rowMeta}>
                  {!client.chosen && client.reason ? `${client.reason[0]!.toUpperCase()}${client.reason.slice(1)}. ` : null}
                  Wybierz klienta.
                </p>
                {client.chosen ? (
                  <button type="button" className={linkButtonClass} onClick={() => setChangingClient(false)}>
                    Anuluj, zostaw {client.chosen.nazwa || "wybranego klienta"}
                  </button>
                ) : null}
              </div>
              {client.candidates.length ? (
                <CandidateList
                  items={client.candidates}
                  itemKey={(c) => c.khId}
                  itemLabel={(c) => c.nazwa}
                  renderItem={(c) => <ClientLabel c={c} />}
                  onPick={(c) => {
                    setClient({ ...client, chosen: c, picked: true });
                    setChangingClient(false);
                  }}
                />
              ) : null}
              {client.candidates.length && !clientSearchOpen ? (
                <button type="button" className={linkButtonClass} onClick={() => setClientSearchOpen(true)}>
                  Szukaj innego klienta
                </button>
              ) : (
                <SubiektSearch
                  label="Klient w Subiekcie"
                  placeholder="Nazwa, NIP albo e-mail klienta"
                  search={actionZkMailSearchClients}
                  itemKey={(c) => c.khId}
                  renderItem={(c) => <ClientLabel c={c} />}
                  onPick={(c) => {
                    setClient({ ...client, chosen: c, picked: true });
                    setChangingClient(false);
                    setClientSearchOpen(false);
                  }}
                />
              )}
            </div>
          )}
        </Card>
      ) : null}

      {rows ? (
        <Card className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={panelTypography.sectionTitle}>Pozycje</h2>
            <span className={panelTypography.rowMeta}>
              {[
                counts.brak ? `${counts.brak} do wyboru` : "",
                counts.do_sprawdzenia ? `${counts.do_sprawdzenia} do sprawdzenia` : "",
                counts.ready ? `${counts.ready} gotowe` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          {GROUPS.map(({ level, title }) => {
            const groupRows = rows.filter((r) => r.group === level);
            if (!groupRows.length) return null;
            return (
              <section key={level} aria-label={title}>
                <h3 className="pt-3 pb-1 text-[0.8125rem] font-semibold text-slate-700">{title}</h3>
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {groupRows.map((r) => (
                    <li key={r.key} className="space-y-2 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-[0.8125rem] italic text-slate-600 break-words">„{r.text}”</p>
                        <span className="shrink-0 whitespace-nowrap">
                          <StatusBadge group={r.group} chosen={r.chosen} picked={r.picked} />
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          {r.chosen && searchingRow !== r.key ? (
                            <>
                              <ProductLabel p={r.chosen} />
                              {!locked ? (
                                <div>
                                  <button type="button" className={linkButtonClass} onClick={() => setSearchingRow(r.key)}>
                                    Zmień towar
                                  </button>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {r.chosen ? (
                                <button type="button" className={linkButtonClass} onClick={() => setSearchingRow(null)}>
                                  Anuluj, zostaw {r.chosen.symbol}
                                </button>
                              ) : null}
                              {r.candidates.length ? (
                                <CandidateList
                                  items={r.candidates}
                                  itemKey={(p) => p.towarId}
                                  itemLabel={(p) => `${p.symbol} ${p.nazwa}`}
                                  renderItem={(p) => <ProductLabel p={p} />}
                                  onPick={(p) => {
                                    updateRow(r.key, { chosen: p, picked: true });
                                    setSearchingRow(null);
                                  }}
                                />
                              ) : null}
                              {r.candidates.length && searchingRow !== r.key ? (
                                <button type="button" className={linkButtonClass} onClick={() => setSearchingRow(r.key)}>
                                  Szukaj innego towaru
                                </button>
                              ) : (
                                <SubiektSearch
                                  label="Towar w Subiekcie"
                                  placeholder="Symbol lub nazwa"
                                  search={actionZkMailSearchProducts}
                                  itemKey={(p) => p.towarId}
                                  renderItem={(p) => <ProductLabel p={p} />}
                                  onPick={(p) => {
                                    updateRow(r.key, { chosen: p, picked: true });
                                    setSearchingRow(null);
                                  }}
                                />
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 items-start gap-1 self-end sm:self-auto">
                          <input
                            aria-label={`Ilość: ${r.text}`}
                            inputMode="decimal"
                            className={fieldControlClass(r.qty ? "default" : "warning", "w-20 text-right tabular-nums")}
                            placeholder="Ilość"
                            value={r.qty}
                            onChange={(e) => updateRow(r.key, { qty: e.target.value.replace(/[^\d.,]/g, "") })}
                            disabled={locked}
                          />
                          {!locked ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Usuń pozycję: ${r.text}`}
                              onClick={() => setRows((prev) => (prev ?? []).filter((x) => x.key !== r.key))}
                              className="h-11 w-11 p-0 sm:h-10 sm:w-10"
                            >
                              <IconX className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
            <span className={panelTypography.rowMeta}>Cena z kartoteki Subiekta.</span>
            {!locked ? (
              <button type="button" className={linkButtonClass} onClick={addRow}>
                + Dodaj pozycję
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {rows ? (
        <Card className="space-y-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-600">Uwagi na ZK</span>
            <textarea
              className={fieldControlClass("default", "min-h-16 sm:min-h-16")}
              value={uwagi}
              maxLength={500}
              onChange={(e) => setUwagi(e.target.value)}
              disabled={locked}
            />
          </label>
          <p className={panelTypography.rowMeta}>Wystawił: Twoje konto w Subiekcie (gdy OnTime je rozpozna), inaczej operator Subiekta.</p>
        </Card>
      ) : null}

      {rows && !created && !uncertain ? (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          {submitError || missing ? (
            <p className={cn("text-[0.8125rem] sm:text-right", submitError ? "text-red-700" : "text-slate-600")} role={submitError ? "alert" : undefined}>
              {submitError ?? missing}
            </p>
          ) : null}
          <Button onClick={create} disabled={creating || Boolean(hostError)} size="lg">
            {creating ? <Spinner className="h-4 w-4" /> : null}
            {creating ? "Tworzę ZK…" : `Utwórz ZK w Subiekcie (test) · ${polishPlural(lineCount, "pozycja", "pozycje", "pozycji")}`}
          </Button>
        </div>
      ) : null}

      {creating ? (
        <div role="status" className="flex items-center gap-2 text-[0.8125rem] text-slate-600">
          <BrandLoader size="sm" tile={false} />
          Zapisuję ZK w Subiekcie i odczytuję je z powrotem. Zwykle kilkanaście sekund.
        </div>
      ) : null}

      {uncertain ? (
        <div className="space-y-3">
          <Alert tone="warning" title="Nie wiadomo, czy ZK powstało">
            {uncertain}
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setUncertain(null)}>
              ZK nie ma w Subiekcie, wróć do podglądu
            </Button>
            <Button variant="ghost" onClick={reset}>
              Nowe ZK z kolejnego maila
            </Button>
          </div>
        </div>
      ) : null}

      {created ? (
        <div className="space-y-3">
          <Alert tone={created.mismatches.length ? "warning" : "success"} title={`Utworzono ${created.numer} (test)`}>
            {created.mismatches.length
              ? `Odczyt z Subiekta różni się od podglądu: ${created.mismatches.join("; ")}. Sprawdź ZK w Subiekcie.`
              : `Odczytane z Subiekta: ${created.clientName || "klient"}, ${polishPlural(created.lineCount, "pozycja", "pozycje", "pozycji")}, towary i ilości zgodne z podglądem.`}
          </Alert>
          <Button variant="secondary" onClick={reset}>
            Nowe ZK z kolejnego maila
          </Button>
        </div>
      ) : null}
    </div>
  );
}
