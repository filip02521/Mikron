"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  actionAssignServiceSerial,
  actionDecideServiceDeviceModel,
  actionServiceClientCard,
  actionServicePendingQueue,
  type ClientCardActionResult,
  type PendingQueueActionResult,
  type ServiceOrderActionResult,
} from "@/app/actions/service-orders";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import type { PendingEquipment } from "@/lib/subiekt/client-equipment-trust";
import type { PendingQueueEntry } from "@/lib/subiekt/client-equipment";
import { ClientPicker, pickerInputClass, type PickedClient } from "@/components/serwis/SubiektPickers";
import { OrderStatusPill, WarrantyPill, formatDateOnly, formatLocalDate } from "@/components/serwis/service-order-view";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { IconChevronRight, IconSearch } from "@/components/icons/StrokeIcons";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/cn";
import { polishPlural } from "@/lib/email/polish-plural";
import { buildClientEquipmentCard, cardDeviceMatches, type CardDevice } from "@/lib/orders/client-equipment-card";
import { isClosedServiceOrder, type SerialHistoryItem } from "@/lib/orders/service-orders";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { sidePanelBackdropClass } from "@/lib/ui/surfaces";
import { useAnimatedClose } from "@/lib/ui/use-animated-close";
import { rubricBoxClass, rubricHeadClass, rubricLabelClass } from "@/lib/ui/serwis-theme";

/** Wynik karty na czas sesji strony: ponowne otwarcie w trakcie tej samej rozmowy nie czyta Subiekta od nowa. */
const cache = new Map<number, { at: number; result: Extract<ClientCardActionResult, { ok: true }> }>();
const CACHE_MS = 5 * 60_000;
const freshCached = (khId: number | null) => {
  const hit = khId != null ? cache.get(khId) : undefined;
  return hit && Date.now() - hit.at < CACHE_MS ? hit.result : null;
};

/** Pokaż szukanie w karcie, gdy sprzętu jest więcej niż mieści się na jednym ekranie. */
const SEARCH_FROM = 7;

function Rubric({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const id = `card-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={rubricBoxClass}>
      <div className={rubricHeadClass}>
        <h3 id={id} className={rubricLabelClass}>
          {title} <span className="font-normal normal-case tracking-normal text-slate-500">· {count}</span>
        </h3>
      </div>
      <ul className="divide-y divide-[var(--sv-rule)]">{children}</ul>
    </section>
  );
}

function DeviceRow({ d, onOpenOrder, canOpenOrder }: { d: CardDevice; onOpenOrder: (id: string) => void; canOpenOrder: (id: string) => boolean }) {
  const open = d.orders.find((o) => !isClosedServiceOrder(o.status)) ?? null;
  const last = open ?? d.orders[0] ?? null;
  return (
    <li className="space-y-1.5 px-3 py-3">
      {/* Na telefonie odznaka pod nazwą — obok ściskała nazwę modelu do czterech linii. */}
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-3">
        <span className="min-w-0 text-[0.9375rem] font-semibold leading-snug text-slate-900">{d.name}</span>
        <WarrantyPill status={d.warranty} className="shrink-0" />
      </div>
      <p className="text-[0.8125rem] leading-snug text-slate-600">
        {d.serials.length ? (
          <>
            SN{" "}
            {d.serials.map((sn, i) => (
              // Numer zawija się tylko między numerami, nie w środku (bardzo długi łamie się mimo to).
              <span key={sn} className="inline-block max-w-full break-all font-mono text-slate-900">
                {sn}
                {i < d.serials.length - 1 ? ",\u00a0" : ""}
              </span>
            ))}
          </>
        ) : (
          <>Bez numeru seryjnego na dokumencie{d.quantity && d.quantity > 1 ? ` · ${d.quantity} szt.` : ""}</>
        )}
      </p>
      <p className="text-xs text-slate-500">
        {d.symbol ? <span className="font-mono">{d.symbol}</span> : null}
        {d.symbol ? " · " : null}
        {d.invoiceNumber}
        {d.invoiceDate ? ` z ${formatDateOnly(d.invoiceDate)}` : ""}
      </p>
      {last ? (
        canOpenOrder(last.id) ? (
          <button
            type="button"
            onClick={() => onOpenOrder(last.id)}
            className="-mx-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-[0.8125rem] font-medium text-indigo-700 underline underline-offset-2 transition-colors duration-150 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            {open ? "W serwisie teraz" : "Był w serwisie"}: <span className="font-mono">{last.number}</span>
            <IconChevronRight size={14} aria-hidden />
          </button>
        ) : (
          <p className="text-[0.8125rem] text-slate-600">
            Był w serwisie: <span className="font-mono">{last.number}</span>, {formatLocalDate(last.createdAt)}
          </p>
        )
      ) : null}
    </li>
  );
}

const decideBtn = "min-h-11 px-3";

/** Jedno pytanie z grupy „Do potwierdzenia”. Odpowiedź zapisuje się dla wszystkich klientów i odświeża kartę. */
function PendingRow({
  p,
  readOnly,
  busy,
  onDecide,
  context,
}: {
  p: Exclude<PendingEquipment, { kind: "serial" }>;
  readOnly: boolean;
  busy: boolean;
  onDecide: (fn: () => Promise<ServiceOrderActionResult>) => void;
  /** Kolejka ze wszystkich klientów: klient i liczba faktur, które rozstrzyga odpowiedź. */
  context?: string;
}) {
  const doc = (n: string, date: string | null) => `${n}${date ? ` z ${formatDateOnly(date)}` : ""}`;
  if (p.kind === "model") {
    const it = p.item;
    return (
      <li className="space-y-2 px-3 py-3">
        {context ? <p className="text-xs text-slate-500">{context}</p> : null}
        <p className="text-[0.9375rem] font-semibold leading-snug text-slate-900">Czy {it.name} to urządzenie?</p>
        <p className="text-[0.8125rem] leading-snug text-slate-600">
          SN{" "}
          {it.serials.map((sn, i) => (
            <span key={sn} className="inline-block max-w-full break-all font-mono text-slate-900">
              {sn}
              {i < it.serials.length - 1 ? ",\u00a0" : ""}
            </span>
          ))}
          {" · "}
          {doc(it.invoiceNumber, it.invoiceDate)}
        </p>
        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} className={decideBtn} onClick={() => onDecide(() => actionDecideServiceDeviceModel({ twId: it.twId, isDevice: true }))}>
              Tak, to urządzenie
            </Button>
            <Button type="button" variant="secondary" disabled={busy} className={decideBtn} onClick={() => onDecide(() => actionDecideServiceDeviceModel({ twId: it.twId, isDevice: false }))}>
              Nie, to nie sprzęt
            </Button>
          </div>
        )}
      </li>
    );
  }
  const it = p.item;
  return (
    <li className="space-y-2 px-3 py-3">
      <p className="text-[0.9375rem] font-semibold leading-snug text-slate-900">
        {it.name}: zostało {p.remaining} z {it.lineQuantity} szt. — który egzemplarz wrócił?
      </p>
      <p className="text-[0.8125rem] leading-snug text-slate-600">Korekta albo zwrot do {doc(it.invoiceNumber, it.invoiceDate)}.</p>
      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          {it.serials.map((sn) => (
            <Button key={sn} type="button" variant="secondary" disabled={busy} className={decideBtn} onClick={() => onDecide(() => actionAssignServiceSerial({ docId: it.invoiceId, serials: [sn], twId: null }))}>
              Wrócił SN <span className="font-mono">{sn}</span>
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

/** Numery z jednego dokumentu z tą samą listą możliwych pozycji — jedno pytanie (zestaw ma zwykle kilka numerów). */
type SerialQuestion = {
  docId: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  serials: string[];
  candidates: Extract<PendingEquipment, { kind: "serial" }>["candidates"];
  misplaced: boolean;
};

function groupSerialQuestions(pending: readonly PendingEquipment[]): SerialQuestion[] {
  const out = new Map<string, SerialQuestion>();
  for (const p of pending) {
    if (p.kind !== "serial") continue;
    const key = `${p.docId}|${p.misplaced}|${p.candidates.map((c) => c.twId).join(",")}`;
    const prev = out.get(key);
    if (prev) prev.serials.push(p.serial);
    else out.set(key, { docId: p.docId, invoiceNumber: p.invoiceNumber, invoiceDate: p.invoiceDate, serials: [p.serial], candidates: p.candidates, misplaced: p.misplaced });
  }
  return [...out.values()];
}

/** „Do którego sprzętu należą numery?” — wszystkie naraz albo każdy osobno; nieznany model można od razu odrzucić. */
function SerialQuestionRow({
  q,
  readOnly,
  busy,
  onDecide,
  context,
}: {
  q: SerialQuestion;
  readOnly: boolean;
  busy: boolean;
  onDecide: (fn: () => Promise<ServiceOrderActionResult>) => void;
  context?: string;
}) {
  const [one, setOne] = useState<string | null>(null);
  const many = q.serials.length > 1;
  const target = one ? [one] : q.serials;
  return (
    <li className="space-y-2 px-3 py-3">
      {context ? <p className="text-xs text-slate-500">{context}</p> : null}
      <p className="text-[0.9375rem] font-semibold leading-snug text-slate-900">
        {many && !one ? "Do którego sprzętu należą numery?" : "Do którego sprzętu należy numer?"}
      </p>
      <p className="text-[0.8125rem] leading-snug text-slate-600">
        SN{" "}
        {target.map((sn, i) => (
          <span key={sn} className="inline-block max-w-full break-all font-mono text-slate-900">
            {sn}
            {i < target.length - 1 ? ",\u00a0" : ""}
          </span>
        ))}
        {" · "}
        {q.invoiceNumber}
        {q.invoiceDate ? ` z ${formatDateOnly(q.invoiceDate)}` : ""}.{" "}
        {q.misplaced ? "Uwagi wskazują pozycję, która nie jest sprzętem (pomyłka w numeracji)." : "Uwagi nie wskazują pozycji, a sprzętem może być kilka."}
      </p>
      {readOnly ? null : (
        <>
          <ul className="divide-y divide-[var(--sv-rule)] rounded-lg border border-[var(--sv-rule)]">
            {q.candidates.map((c) => (
              // Na telefonie przyciski pod nazwą — obok ściskały nazwę modelu do kilku linii.
              <li key={c.twId} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1 text-[0.8125rem] text-slate-900">
                  {c.name}
                  {c.known ? <span className="text-slate-500"> · urządzenie</span> : null}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    className={decideBtn}
                    onClick={() => onDecide(() => actionAssignServiceSerial({ docId: q.docId, serials: target, twId: c.twId }))}
                  >
                    {many && !one ? "Wszystkie tu" : "To ten"}
                  </Button>
                  {c.known ? null : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      className={decideBtn}
                      title="Model nie jest urządzeniem — dla wszystkich klientów"
                      onClick={() => onDecide(() => actionDecideServiceDeviceModel({ twId: c.twId, isDevice: false }))}
                    >
                      Nie sprzęt
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              className={decideBtn}
              onClick={() => onDecide(() => actionAssignServiceSerial({ docId: q.docId, serials: target, twId: null }))}
            >
              Żaden — pomyłka w uwagach
            </Button>
            {many ? (
              one ? (
                <Button type="button" variant="secondary" className={decideBtn} onClick={() => setOne(null)}>
                  Wróć do wszystkich
                </Button>
              ) : (
                <label className="inline-flex min-h-11 items-center gap-2 text-[0.8125rem] text-slate-700">
                  Każdy osobno:
                  <select
                    className={cn(pickerInputClass, "h-11 w-auto")}
                    value=""
                    onChange={(e) => setOne(e.target.value || null)}
                  >
                    <option value="">wybierz numer…</option>
                    {q.serials.map((sn) => (
                      <option key={sn} value={sn}>
                        {sn}
                      </option>
                    ))}
                  </select>
                </label>
              )
            ) : null}
          </div>
        </>
      )}
    </li>
  );
}

const shortDate = (ymd: string) => formatDateOnly(ymd).slice(0, 5);
const dayBefore = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Pytania ze wszystkich klientów, tydzień po tygodniu (najnowsze faktury najpierw) — serwisant uczy kartę hurtem.
 * Pytanie o model raz, z liczbą faktur, które rozstrzyga; pytania o numery — po fakturze, z nazwą klienta.
 */
function PendingQueue({ readOnly, onDecided }: { readOnly: boolean; onDecided: () => void }) {
  const [win, setWin] = useState<PendingQueueActionResult | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [deciding, startDeciding] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const load = (until: string | null) =>
    startLoading(async () => {
      const res = await actionServicePendingQueue({ to: until }).catch(() => ({ ok: false as const, message: "Nie udało się pobrać faktur z Subiekta." }));
      setWin(res);
      setTo(until);
    });
  const decide = (fn: () => Promise<ServiceOrderActionResult>) =>
    startDeciding(async () => {
      const res = await fn();
      setNotice({ ok: res.ok, text: res.message });
      if (!res.ok) return;
      onDecided();
      const fresh = await actionServicePendingQueue({ to }).catch(() => null);
      if (fresh) setWin(fresh);
    });

  if (!win && !loading) {
    return (
      <section className="space-y-2 rounded-lg border border-[var(--sv-rule)] bg-card px-4 py-3">
        <h3 className={rubricLabelClass}>Pytania z ostatnich faktur</h3>
        <p className="text-[0.8125rem] text-slate-600">
          Odpowiedz hurtem, zanim klient zadzwoni: każda decyzja (model to urządzenie, numer należy do…) zostaje dla wszystkich klientów.
        </p>
        <Button type="button" variant="secondary" onClick={() => load(null)}>
          Pokaż pytania z ostatniego tygodnia
        </Button>
      </section>
    );
  }
  if (loading && !win) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-lg border border-[var(--sv-rule)] bg-card px-4 py-3">
        <BrandLoader size="sm" tile={false} />
        <span className="text-[0.8125rem] text-slate-600">Czytam faktury i paragony z tygodnia — zwykle 2–4 s…</span>
      </div>
    );
  }
  if (!win) return null;
  if (!win.ok) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <span className="min-w-0 flex-1 text-[0.8125rem] text-amber-900">{win.message}</span>
        <Button type="button" variant="secondary" onClick={() => load(to)}>
          Spróbuj ponownie
        </Button>
      </div>
    );
  }
  // Jeden model — jedno pytanie, choćby był na kilku fakturach.
  const models = new Map<number, { p: Extract<PendingEquipment, { kind: "model" }>; clients: Set<string>; docs: number }>();
  const rest: PendingQueueEntry[] = [];
  for (const e of win.entries) {
    if (e.pending.kind !== "model") {
      rest.push(e);
      continue;
    }
    const prev = models.get(e.pending.item.twId);
    if (prev) {
      prev.clients.add(e.client.name);
      prev.docs++;
    } else models.set(e.pending.item.twId, { p: e.pending, clients: new Set([e.client.name]), docs: 1 });
  }
  const modelRows = [...models.values()].sort((a, b) => b.docs - a.docs);
  const clientOfDoc = new Map(rest.flatMap((e) => (e.pending.kind === "serial" ? [[e.pending.docId, e.client.name] as const] : [])));
  const serialRows = groupSerialQuestions(rest.map((e) => e.pending));
  const corrections = rest.filter((e) => e.pending.kind === "correction");
  const count = modelRows.length + serialRows.length + corrections.length;
  const older = dayBefore(win.from);
  return (
    <section className="space-y-3">
      <p className="text-[0.9375rem] font-semibold text-slate-900" aria-live="polite">
        {count ? `${polishPlural(count, "pytanie", "pytania", "pytań")} z faktur ${shortDate(win.from)}–${formatDateOnly(win.to)}` : `Brak pytań z faktur ${shortDate(win.from)}–${formatDateOnly(win.to)}`}
      </p>
      {deciding ? (
        <div role="status" className="flex items-center gap-3 rounded-lg border border-[var(--sv-rule)] bg-card px-4 py-2.5">
          <BrandLoader size="sm" tile={false} />
          <span className="text-[0.8125rem] text-slate-600">Zapisuję decyzję i liczę pytania od nowa — kilka sekund…</span>
        </div>
      ) : notice ? (
        <p role="status" className={cn("text-[0.8125rem]", notice.ok ? "text-emerald-800" : "text-red-700")}>
          {notice.text}
        </p>
      ) : null}
      {count ? (
        <Rubric title="Do potwierdzenia" count={count}>
          {modelRows.map(({ p, clients, docs }) => (
            <PendingRow
              key={`m-${p.item.twId}`}
              p={p}
              readOnly={readOnly}
              busy={deciding}
              onDecide={decide}
              context={docs > 1 ? `Na ${docs} fakturach · ${[...clients][0]}${clients.size > 1 ? " i inni" : ""}` : [...clients][0]}
            />
          ))}
          {serialRows.map((q) => (
            <SerialQuestionRow key={`s-${q.docId}-${q.serials.join("|")}`} q={q} readOnly={readOnly} busy={deciding} onDecide={decide} context={clientOfDoc.get(q.docId)} />
          ))}
          {corrections.map((e) =>
            e.pending.kind === "correction" ? (
              <PendingRow key={`c-${e.pending.item.invoiceId}-${e.pending.item.twId}`} p={e.pending} readOnly={readOnly} busy={deciding} onDecide={decide} context={e.client.name} />
            ) : null
          )}
        </Rubric>
      ) : (
        <p className="text-[0.8125rem] text-slate-600">
          {polishPlural(win.withSerials, "faktura", "faktury", "faktur")} z numerami seryjnymi w tym tygodniu — wszystko rozstrzygnięte.
        </p>
      )}
      {win.truncated ? <p className="text-xs text-slate-500">Tydzień miał bardzo dużo dokumentów — część najstarszych z tego tygodnia pominięta.</p> : null}
      <Button type="button" variant="secondary" disabled={loading || deciding} onClick={() => load(older)}>
        {loading ? "Czytam starsze faktury…" : `Starsze faktury (do ${formatDateOnly(older)})`}
      </Button>
    </section>
  );
}

function OrderRow({ o, onOpenOrder, canOpenOrder }: { o: SerialHistoryItem; onOpenOrder: (id: string) => void; canOpenOrder: (id: string) => boolean }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[0.8125rem] font-semibold text-slate-900">{o.number}</span>
        <span className="block text-[0.8125rem] leading-snug text-slate-600">
          {o.deviceName}
          {o.serialNo ? (
            <>
              {" · SN "}
              <span className="font-mono">{o.serialNo}</span>
            </>
          ) : null}
        </span>
        <span className="block text-xs text-slate-500">Przyjęte {formatLocalDate(o.createdAt)}</span>
      </span>
      <OrderStatusPill status={o.status} />
    </>
  );
  if (!canOpenOrder(o.id)) return <li className="flex items-center gap-3 px-3 py-3">{body}</li>;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenOrder(o.id)}
        className="group flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-[var(--sv-box)] focus-visible:bg-[var(--sv-box)] focus-visible:outline-none"
      >
        {body}
        <IconChevronRight size={16} className="shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
      </button>
    </li>
  );
}

/**
 * „Sprzęt klienta” przy telefonie: serwisant wpisuje klienta i widzi, co od nas kupił (faktury i paragony z 10 lat),
 * z numerami seryjnymi i stanem gwarancji, oraz jego zlecenia serwisowe. Tylko odczyt.
 */
export function ClientEquipmentLookup({
  client,
  onClientChange,
  warrantyMonths,
  today,
  onClose,
  onOpenOrder,
  canOpenOrder,
}: {
  /** Ostatnio sprawdzany klient — zostaje po zamknięciu panelu, żeby wrócić do niego w tej samej rozmowie. */
  client: PickedClient | null;
  onClientChange: (c: PickedClient | null) => void;
  warrantyMonths: ReadonlyMap<number, number>;
  today: Date;
  onClose: () => void;
  onOpenOrder: (orderId: string) => void;
  canOpenOrder: (orderId: string) => boolean;
}) {
  const { panelRef, backdropRef, requestClose } = useAnimatedClose(onClose);
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));
  const khId = client?.khId ?? null;
  const [result, setResult] = useState<ClientCardActionResult | null>(() => freshCached(khId));
  const [loadedFor, setLoadedFor] = useState<number | null>(() => (freshCached(khId) ? khId : null));
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [deciding, startDeciding] = useTransition();
  const { readOnly } = useAdminPanelPreview();
  const seq = useRef(0);
  useBodyScrollLock(true);
  useFocusTrap(panelRef, true);

  // Inny klient: wynik poprzedniego znika od razu (render), zanim przyjdzie nowy.
  if (khId !== loadedFor && result) {
    setResult(null);
    setQuery("");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Lista podpowiedzi klienta zamyka się sama; Escape w polu nie zamyka całego panelu.
      if (e.target instanceof HTMLElement && e.target.getAttribute("aria-expanded") === "true") return;
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [requestClose, opener]);

  useEffect(() => {
    if (khId == null || khId === loadedFor) return;
    const mine = ++seq.current;
    actionServiceClientCard(khId).then(
      (res) => {
        if (mine !== seq.current) return;
        if (res.ok) cache.set(khId, { at: Date.now(), result: res });
        setResult(res);
        setLoadedFor(khId);
      },
      () => {
        if (mine !== seq.current) return;
        setResult({ ok: false, message: "Nie udało się pobrać faktur i paragonów klienta z Subiekta." });
        setLoadedFor(khId);
      }
    );
    // Ponowna próba zmienia `attempt` — wtedy pobieramy jeszcze raz tego samego klienta.
  }, [khId, loadedFor, attempt]);

  // Decyzja obowiązuje dla wszystkich klientów: pamięć kart czyścimy, a tę kartę liczymy od nowa (lista zostaje widoczna).
  const decide = (fn: () => Promise<ServiceOrderActionResult>) =>
    startDeciding(async () => {
      const res = await fn();
      setNotice({ ok: res.ok, text: res.message });
      if (!res.ok || khId == null) return;
      cache.clear();
      const fresh = await actionServiceClientCard(khId).catch(() => null);
      if (!fresh) return;
      if (fresh.ok) cache.set(khId, { at: Date.now(), result: fresh });
      setResult(fresh);
    });

  const card = useMemo(
    () => (result?.ok ? buildClientEquipmentCard(result.items, result.orders ?? [], result.repairs, warrantyMonths, today) : null),
    [result, warrantyMonths, today]
  );
  const total = result?.ok ? result.items.length : 0;
  const active = card ? card.active.filter((d) => cardDeviceMatches(d, query)) : [];
  const other = card ? card.other.filter((d) => cardDeviceMatches(d, query)) : [];
  const orders = result?.ok ? result.orders ?? [] : [];
  const inService = orders.filter((o) => !isClosedServiceOrder(o.status)).length;
  const loading = khId != null && khId !== loadedFor;
  const pending = result?.ok ? result.pending : [];
  const serialQuestions = groupSerialQuestions(pending);
  const otherPending = pending.filter((p): p is Exclude<PendingEquipment, { kind: "serial" }> => p.kind !== "serial");
  const questions = serialQuestions.length + otherPending.length;

  const summary = card
    ? [
        polishPlural(total, "urządzenie", "urządzenia", "urządzeń"),
        `${card.active.length} na gwarancji`,
        ...(questions ? [`${questions} do potwierdzenia`] : []),
        ...(inService ? [`${inService} w serwisie teraz`] : []),
      ].join(" · ")
    : null;

  return (
    <>
      <div
        ref={(el) => {
          backdropRef.current = el;
        }}
        className={cn(sidePanelBackdropClass, "panel-slide-backdrop-enter")}
        onClick={requestClose}
        aria-hidden
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-card-title"
        className="panel-slide-enter touch-ui fixed inset-y-0 right-0 z-[60] flex w-full max-w-[34rem] flex-col border-l border-slate-200/80 bg-raised shadow-[var(--shadow-card-elevated)]"
        style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-center gap-2">
            <h2 id="client-card-title" className="font-display text-xl font-bold leading-tight tracking-tight text-slate-900">
              Sprzęt klienta
            </h2>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Zamknij"
              className="ml-auto grid h-11 w-11 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {client?.khId != null ? (
            // Wybrany klient w pełnej nazwie (nie ucięty w polu) — to on jest tematem karty.
            <div className="flex items-start gap-3">
              <dl className="min-w-0 flex-1 text-[0.8125rem]">
                <dt className={rubricLabelClass}>Klient</dt>
                <dd className="text-[0.9375rem] font-semibold leading-snug text-slate-900">{client.name}</dd>
                {client.phone ? (
                  <dd>
                    <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center font-medium text-indigo-700 underline underline-offset-2">
                      tel. {client.phone}
                    </a>
                  </dd>
                ) : null}
              </dl>
              <Button type="button" variant="secondary" className="shrink-0" onClick={() => onClientChange(null)}>
                Zmień klienta
              </Button>
            </div>
          ) : (
            <ClientPicker value={client} onChange={onClientChange} label="Klient" autoFocus />
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6" {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}>
          {!client || client.khId == null ? (
            <>
            <p className="text-sm text-slate-600">
              {client?.name
                ? "Wybierz klienta z podpowiedzi — sprzęt czytamy z jego faktur i paragonów w Subiekcie."
                : "Wpisz nazwę, miasto albo NIP klienta i wybierz go z podpowiedzi. Zobaczysz sprzęt, który od nas kupił, z numerami seryjnymi i gwarancją, oraz jego zlecenia serwisowe."}
            </p>
            {client?.name ? null : <PendingQueue readOnly={readOnly} onDecided={() => cache.clear()} />}
            </>
          ) : loading ? (
            <div role="status" className="flex items-center gap-3 rounded-lg border border-[var(--sv-rule)] bg-card px-4 py-3">
              <BrandLoader size="sm" tile={false} />
              <span className="text-[0.8125rem] text-slate-600">Czytam faktury i paragony klienta z Subiekta — zwykle 1–4 s…</span>
            </div>
          ) : result && !result.ok ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="min-w-0 flex-1 text-[0.8125rem] text-amber-900">{result.message}</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLoadedFor(null);
                  setResult(null);
                  setAttempt((a) => a + 1);
                }}
              >
                Spróbuj ponownie
              </Button>
            </div>
          ) : result?.ok && card ? (
            <>
              {total || pending.length ? (
                <p className="text-[0.9375rem] font-semibold text-slate-900" aria-live="polite">
                  {summary}
                </p>
              ) : null}
              {deciding ? (
                <div role="status" className="flex items-center gap-3 rounded-lg border border-[var(--sv-rule)] bg-card px-4 py-2.5">
                  <BrandLoader size="sm" tile={false} />
                  <span className="text-[0.8125rem] text-slate-600">Zapisuję decyzję i liczę kartę od nowa — kilka sekund…</span>
                </div>
              ) : notice ? (
                <p role="status" className={cn("text-[0.8125rem]", notice.ok ? "text-emerald-800" : "text-red-700")}>
                  {notice.text}
                </p>
              ) : null}
              {questions ? (
                <Rubric title="Do potwierdzenia" count={questions}>
                  {otherPending.map((p) => (
                    <PendingRow key={`${p.kind}-${p.item.invoiceId}-${p.item.twId}`} p={p} readOnly={readOnly} busy={deciding} onDecide={decide} />
                  ))}
                  {serialQuestions.map((q) => (
                    <SerialQuestionRow key={`s-${q.docId}-${q.serials.join("|")}`} q={q} readOnly={readOnly} busy={deciding} onDecide={decide} />
                  ))}
                </Rubric>
              ) : null}
              {total >= SEARCH_FROM ? (
                <label className="relative block">
                  <span className="sr-only">Szukaj w sprzęcie klienta</span>
                  <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Model, numer seryjny, faktura"
                    className={cn(pickerInputClass, "pl-9")}
                  />
                </label>
              ) : null}
              {total === 0 && pending.length === 0 ? (
                <p aria-live="polite" className="rounded-lg border border-[var(--sv-rule)] bg-card px-4 py-3 text-[0.8125rem] text-slate-600">
                  Brak sprzętu w fakturach i paragonach klienta (
                  {polishPlural(result.invoicesScanned, "dokument", "dokumenty", "dokumentów")} z 10 lat). Klient mógł kupić sprzęt na inną firmę
                  albo przez sklep na zbiorczy paragon — zapytaj o numer faktury.
                </p>
              ) : null}
              {active.length ? (
                <Rubric title="Na gwarancji" count={active.length}>
                  {active.map((d) => (
                    <DeviceRow key={`${d.invoiceId}-${d.twId}-${d.serials[0] ?? "x"}`} d={d} onOpenOrder={onOpenOrder} canOpenOrder={canOpenOrder} />
                  ))}
                </Rubric>
              ) : null}
              {other.length ? (
                <Rubric title="Po gwarancji" count={other.length}>
                  {other.map((d) => (
                    <DeviceRow key={`${d.invoiceId}-${d.twId}-${d.serials[0] ?? "x"}`} d={d} onOpenOrder={onOpenOrder} canOpenOrder={canOpenOrder} />
                  ))}
                </Rubric>
              ) : null}
              {query && !active.length && !other.length ? (
                <p className="text-[0.8125rem] text-slate-600">Nic nie pasuje do „{query}”. Sprawdź model albo numer seryjny.</p>
              ) : null}
              {result.orders == null ? (
                <p className="text-[0.8125rem] text-amber-900">Nie udało się odczytać zleceń serwisowych klienta — lista sprzętu jest pełna.</p>
              ) : orders.length ? (
                <Rubric title="Zlecenia serwisowe" count={orders.length}>
                  {orders.map((o) => (
                    <OrderRow key={o.id} o={o} onOpenOrder={onOpenOrder} canOpenOrder={canOpenOrder} />
                  ))}
                </Rubric>
              ) : null}
              {card.repairsElsewhere.length ? (
                <Rubric title="Naprawiane u nas, zakupu brak na liście" count={card.repairsElsewhere.length}>
                  {card.repairsElsewhere.map((r) => (
                    <li key={`${r.invoiceId}-${r.serial}`} className="px-3 py-2.5 text-[0.8125rem] text-slate-600">
                      SN <span className="font-mono text-slate-900">{r.serial}</span> · {r.invoiceNumber}
                      {r.invoiceDate ? ` z ${formatDateOnly(r.invoiceDate)}` : ""}
                    </li>
                  ))}
                </Rubric>
              ) : null}
              {total || pending.length ? (
                <p className="text-xs text-slate-500">
                  Na liście jest tylko sprzęt pewny: model potwierdzony przez serwis i numer wskazany na dokumencie (albo przez Ciebie). Przejrzano{" "}
                  {polishPlural(result.invoicesScanned, "dokument", "dokumenty", "dokumentów")} z 10 lat; sprzęt bez numeru — z ostatnich 3 lat. Gwarancja: 24
                  mies. od daty dokumentu albo okres modelu z katalogu.
                  {result.returned ? ` Pominięto ${polishPlural(result.returned, "urządzenie oddane", "urządzenia oddane", "urządzeń oddanych")} korektą albo zwrotem.` : ""}
                  {result.truncated ? " Klient ma bardzo dużo dokumentów — najstarszy sprzęt może nie być na liście." : ""}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
