import { mapPool } from "@/lib/async/map-pool";
import { getSubiektDocument, getSubiektProduct } from "@/lib/subiekt/api";
import { subiektJson } from "@/lib/subiekt/client";
import { SUBIEKT_PATHS } from "@/lib/subiekt/paths";
import { subiektQueryString } from "@/lib/subiekt/query";
import { warsawDateKeyDaysAgo, warsawNowParts } from "@/lib/time/warsaw";
import { fetchServicePartTwIds, resolveServicePartsCecha } from "@/lib/data/service-parts";
import { fetchDeviceModelDecisions, fetchSerialAssignments } from "@/lib/data/service-equipment-decisions";
import {
  applyCorrections,
  classifyInvoiceEquipment,
  serialKey,
  type PendingEquipment,
  type TrustedEquipmentItem,
  type TrustInputs,
} from "@/lib/subiekt/client-equipment-trust";
import {
  SUBIEKT_PRODUCT_KIND_SERVICE,
  hasSerialNotes,
  mergeClientEquipment,
  parseSalesDocNumber,
  type ClientEquipmentItem,
  type InvoiceRepairRef,
} from "@/lib/subiekt/client-equipment-parse";

/** Sprzęt serwisuje się latami po zakupie — 10 lat wstecz. */
const LOOKBACK_DAYS = 3650;
/** /documents/fs oddaje najwyżej 200 wierszy na stronę, niezależnie od pageSize. */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;
/** Szczegóły pobieramy tylko dla faktur z numerami w uwagach — limit chroni przed klientem-hurtownią. */
const MAX_DETAILS = 60;
/** Urządzenie kosztuje co najmniej tyle netto; najtańsze z numerem w pomiarze 18.11.2026 — 299 zł (mieszadło). */
const MIN_DEVICE_NET_PRICE = 100;

type DocListRow = { dok_Id: number; dok_Uwagi?: string | null; dok_DataWyst?: string | null };

export type ClientEquipmentResult = {
  items: ClientEquipmentItem[];
  /** Ile dokumentów klienta (faktur i paragonów) przejrzano i czy lista może być niepełna (limit stron albo szczegółów). */
  invoicesScanned: number;
  truncated: boolean;
  /** Numery z faktur za naprawę (same części i usługi) — sprzęt był już u nas w serwisie, to nie jego zakup. */
  repairs: InvoiceRepairRef[];
};

/**
 * Dokumenty klienta (nagłówki). Filtr po kontrahencie ma inną nazwę na każdej liście
 * (sprawdzone na żywym API): FS — `kh_id` (`khId` nie filtruje), PA — `odbiorcaId`.
 */
async function scanClientDocs(
  path: string,
  filter: Record<string, number>,
  range: { dataOd: string; dataDo: string }
): Promise<{ rows: DocListRow[]; scanned: number; truncated: boolean }> {
  const rows: DocListRow[] = [];
  const fetchPage = async (page: number) => {
    const qs = subiektQueryString({ ...filter, ...range, page, pageSize: PAGE_SIZE });
    return (await subiektJson<{ data?: DocListRow[] }>(`${path}${qs}`)).data ?? [];
  };
  // Pierwsza strona sama (zwykle jedyna), dalsze po 3 naraz — klient-hurtownia ma 10 stron, a karta jest przy telefonie.
  for (let page = 1; page <= MAX_PAGES; ) {
    const batch = page === 1 ? [1] : Array.from({ length: Math.min(3, MAX_PAGES - page + 1) }, (_, i) => page + i);
    for (const data of await Promise.all(batch.map(fetchPage))) {
      rows.push(...data);
      // Koniec po stronie krótszej niż limit — nie ufamy totalPages (liczone z żądanego pageSize).
      if (data.length < PAGE_SIZE) return { rows, scanned: rows.length, truncated: false };
    }
    page += batch.length;
  }
  return { rows, scanned: rows.length, truncated: true };
}

type SalesDoc = Awaited<ReturnType<typeof getSubiektDocument>>;
type DeviceLineProbe = { ob_TowId?: number | null; ob_CenaNetto?: number | null };
/** Pozycja tańsza niż urządzenie (cena znana i dodatnia). */
const cheap = (l: DeviceLineProbe) => {
  const price = Number(l.ob_CenaNetto);
  return Number.isFinite(price) && price > 0 && price < MIN_DEVICE_NET_PRICE;
};

/**
 * Sprzęt z numerami seryjnymi z pobranych dokumentów: części serwisowe (cecha z indeksu w bazie) i usługi nie są
 * sprzętem, numer bez pozycji-urządzenia to faktura za naprawę. Wspólne dla przyjęcia i karty klienta.
 */
async function deviceLineFilter(docs: readonly SalesDoc[]): Promise<{
  isDeviceLine: (l: DeviceLineProbe) => boolean;
  kindByTwId: Map<number, number | null>;
}> {
  // Numer „SN …” bez pozycji nie trafia do części ani usługi.
  const parts = await resolveServicePartsCecha()
    .then((c) => (c ? fetchServicePartTwIds(c.cechaId) : []))
    .then((ids) => new Set(ids), () => new Set<number>());
  // Rodzaj towaru z kartoteki — raz na model, tylko dla pozycji, które cenowo mogą być sprzętem (to jedno zapytanie
  // na model; faktury hurtowni mają ich setki). Błąd odczytu = rodzaj nieznany (pozycja zostaje).
  const twIds = [
    ...new Set(docs.flatMap((d) => (d.dok_Pozycja ?? []).filter((l) => !cheap(l)).map((l) => Math.trunc(Number(l.ob_TowId))))),
  ].filter((id) => id > 0 && !parts.has(id));
  const kinds = await mapPool(twIds, 4, async (id) => {
    try {
      const p = await getSubiektProduct(id);
      return [id, p.tw_Rodzaj ?? null] as const;
    } catch {
      return [id, null] as const;
    }
  });
  const kindByTwId = new Map(kinds);
  const isDeviceLine = (l: DeviceLineProbe) => {
    const id = Math.trunc(Number(l.ob_TowId));
    return !cheap(l) && !parts.has(id) && kindByTwId.get(id) !== SUBIEKT_PRODUCT_KIND_SERVICE;
  };
  return { isDeviceLine, kindByTwId };
}

/**
 * Sprzęt kupiony przez klienta: pozycje jego faktur sprzedaży (FS) i paragonów (PA) z numerami seryjnymi
 * w uwagach. Paragony detaliczne idą zwykle na jednego zbiorczego kontrahenta — klient z własną kartoteką
 * ma ich niewiele, ale bywają. Tylko serwer.
 */
export async function fetchClientEquipment(khId: number, preferSerials: readonly string[] = []): Promise<ClientEquipmentResult> {
  const range = { dataOd: warsawDateKeyDaysAgo(LOOKBACK_DAYS), dataDo: warsawNowParts().dateKey };
  const [fs, pa] = await Promise.all([
    scanClientDocs(SUBIEKT_PATHS.documentsFs, { kh_id: khId }, range),
    scanClientDocs(SUBIEKT_PATHS.documentsPa, { odbiorcaId: khId }, range),
  ]);
  const withSerials = [...fs.rows, ...pa.rows].filter((r) => hasSerialNotes(r.dok_Uwagi));
  let truncated = fs.truncated || pa.truncated;
  // Dokument z numerem ze zgłoszenia w uwagach pierwszy, potem najnowsze — limit szczegółów nie gubi szukanego zakupu.
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const wanted = preferSerials.map(norm).filter((s) => s.length >= 4);
  const hasWanted = (r: DocListRow) => wanted.length > 0 && wanted.some((s) => norm(String(r.dok_Uwagi ?? "")).includes(s));
  const newest = [...withSerials].sort(
    (a, b) => Number(hasWanted(b)) - Number(hasWanted(a)) || String(b.dok_DataWyst ?? "").localeCompare(String(a.dok_DataWyst ?? ""))
  );
  if (newest.length > MAX_DETAILS) truncated = true;
  // /documents/{id} oddaje pozycje dla każdego typu dokumentu (FS i PA).
  const docs = await mapPool(newest.slice(0, MAX_DETAILS), 4, (r) => getSubiektDocument(r.dok_Id));
  const scanned = fs.scanned + pa.scanned;
  // Te same zasady co karta „Sprzęt klienta” (client-equipment-trust.ts). Bez bazy decyzji wszystko jest niepotwierdzone.
  const [{ isDeviceLine }, models, assignments] = await Promise.all([
    deviceLineFilter(docs),
    fetchDeviceModelDecisions().catch(() => new Map<number, boolean>()),
    fetchSerialAssignments(docs.map((d) => d.dok_Id)).catch(() => new Map<string, number | null>()),
  ]);
  const inputs: TrustInputs = {
    deviceModel: (twId) => models.get(twId) ?? null,
    assignment: (docId, key) => assignments.get(`${docId}|${key}`),
    canBeDevice: isDeviceLine,
  };
  const results = docs.map((d) => classifyInvoiceEquipment({ ...d, dok_Uwagi: (d.dok_Uwagi as string | null | undefined) ?? null }, inputs));
  // Przy przyjęciu serwisant ma sprzęt w ręku: model jeszcze niepotwierdzony też jest do wyboru (z oznaczeniem), ale nigdy
  // nie wpisuje się sam. Numer bez jednoznacznej pozycji — model wybiera się niżej ręcznie.
  const items = mergeClientEquipment([
    ...results.flatMap((r) => r.trusted),
    ...results.flatMap((r) => r.pending).flatMap((p) => (p.kind === "model" ? [{ ...p.item, unconfirmed: true }] : [])),
  ]);
  return { items, invoicesScanned: scanned, truncated, repairs: results.flatMap((r) => r.repairs) };
}

/** Korekta faktury sprzedaży (pozycje = stan po korekcie) i zwrot do paragonu (pozycje = zwrócone sztuki). */
const SUBIEKT_DOC_TYPE_KFS = 6;
const SUBIEKT_DOC_TYPE_ZW = 14;
/** Karta klienta: dokumenty z numerami w uwagach (starsze też — tam jest sprzęt po gwarancji). */
const CARD_MAX_SERIAL_DOCS = 120;
/** Karta klienta: najnowsze dokumenty bez numerów — urządzenia kupione bez SN; 300 dokumentów po 8 naraz ≈ 1,8 s (pomiar 18.11.2026). */
const CARD_MAX_PLAIN_DOCS = 300;
/** Zakup bez numeru starszy niż 3 lata jest po gwarancji (24 mies. domyślnie), a czytanie go kosztuje czas rozmowy. */
const CARD_PLAIN_DAYS = 3 * 365;

type CorrectionRow = DocListRow & { dok_DoDokId?: number | null };

export type ClientEquipmentCard = {
  /** Pewny sprzęt: model potwierdzony jako urządzenie, numer wskazany jednoznacznie albo przez serwisanta. */
  items: TrustedEquipmentItem[];
  /** Do rozstrzygnięcia przez serwisanta: czy model to urządzenie, do którego sprzętu należy numer, korekta części sztuk. */
  pending: PendingEquipment[];
  invoicesScanned: number;
  truncated: boolean;
  repairs: InvoiceRepairRef[];
  /** Urządzenia oddane w całości korektą (KFS) albo zwrotem (ZW) — nie ma ich na liście. */
  returned: number;
};

const sortNewest = <T extends { invoiceDate: string | null; invoiceId: number }>(a: T, b: T) =>
  (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? "") || b.invoiceId - a.invoiceId;

/**
 * Zaufana lista sprzętu klienta do karty „Sprzęt klienta” (rozmowa telefoniczna). Zasady: `client-equipment-trust.ts`.
 * Faktury i paragony z 10 lat (z numerami w uwagach) i z 3 lat (bez numerów — urządzenia potwierdzonych modeli), korekty
 * (KFS) i zwroty (ZW) tych dokumentów. Tylko serwer.
 */
export async function fetchClientEquipmentCard(khId: number): Promise<ClientEquipmentCard> {
  const range = { dataOd: warsawDateKeyDaysAgo(LOOKBACK_DAYS), dataDo: warsawNowParts().dateKey };
  const [fs, pa, kfs, zw, models] = await Promise.all([
    scanClientDocs(SUBIEKT_PATHS.documentsFs, { kh_id: khId }, range),
    scanClientDocs(SUBIEKT_PATHS.documentsPa, { odbiorcaId: khId }, range),
    scanClientDocs(SUBIEKT_PATHS.documents, { typ: SUBIEKT_DOC_TYPE_KFS, kh_id: khId }, range),
    scanClientDocs(SUBIEKT_PATHS.documents, { typ: SUBIEKT_DOC_TYPE_ZW, kh_id: khId }, range),
    fetchDeviceModelDecisions(),
  ]);
  const newestFirst = [...fs.rows, ...pa.rows].sort((a, b) => String(b.dok_DataWyst ?? "").localeCompare(String(a.dok_DataWyst ?? "")) || b.dok_Id - a.dok_Id);
  const serialRows = newestFirst.filter((r) => hasSerialNotes(r.dok_Uwagi));
  const plainFrom = warsawDateKeyDaysAgo(CARD_PLAIN_DAYS);
  const plainRows = newestFirst.filter((r) => !hasSerialNotes(r.dok_Uwagi) && String(r.dok_DataWyst ?? "").slice(0, 10) >= plainFrom);
  const truncated = fs.truncated || pa.truncated || serialRows.length > CARD_MAX_SERIAL_DOCS || plainRows.length > CARD_MAX_PLAIN_DOCS;
  const [serialDocs, plainDocs] = await Promise.all([
    mapPool(serialRows.slice(0, CARD_MAX_SERIAL_DOCS), 3, (r) => getSubiektDocument(r.dok_Id)),
    mapPool(plainRows.slice(0, CARD_MAX_PLAIN_DOCS), 8, (r) => getSubiektDocument(r.dok_Id)),
  ]);
  const [{ isDeviceLine }, assignments] = await Promise.all([
    deviceLineFilter(serialDocs),
    fetchSerialAssignments(serialDocs.map((d) => d.dok_Id)),
  ]);
  const inputs: TrustInputs = {
    deviceModel: (twId) => models.get(twId) ?? null,
    assignment: (docId, key) => assignments.get(`${docId}|${key}`),
    canBeDevice: isDeviceLine,
  };
  const results = [...serialDocs, ...plainDocs].map((d) => classifyInvoiceEquipment({ ...d, dok_Uwagi: (d.dok_Uwagi as string | null | undefined) ?? null }, inputs));
  const trustedRaw = results.flatMap((r) => r.trusted);

  // Korekty i zwroty tylko dokumentów, z których jest sprzęt: KFS — ilość po korekcie (ostatnia korekta), ZW — zwrócone sztuki.
  const withDevices = new Set(trustedRaw.map((t) => t.invoiceId));
  const kfsRows = (kfs.rows as CorrectionRow[]).filter((r) => r.dok_DoDokId != null && withDevices.has(Number(r.dok_DoDokId)));
  const zwRows = (zw.rows as CorrectionRow[]).filter((r) => r.dok_DoDokId != null && withDevices.has(Number(r.dok_DoDokId)));
  const corrections = await mapPool([...kfsRows, ...zwRows], 4, (r) => getSubiektDocument(r.dok_Id));
  const finals = finalQuantities(trustedRaw, kfsRows, zwRows, corrections);
  const corrected = applyCorrections(trustedRaw, finals);

  // Ten sam egzemplarz (model + numer) z kilku dokumentów — tylko najnowszy zakup.
  const seen = new Set<string>();
  const items = [...corrected.trusted].sort(sortNewest).filter((it) => {
    if (!it.serials.length) return true;
    const keys = it.serials.map((s) => `${it.twId}|${serialKey(s)}`);
    if (keys.every((k) => seen.has(k))) return false;
    for (const k of keys) seen.add(k);
    return true;
  });
  return {
    items,
    pending: [...results.flatMap((r) => r.pending), ...corrected.pending],
    invoicesScanned: fs.scanned + pa.scanned,
    truncated,
    repairs: results.flatMap((r) => r.repairs),
    returned: corrected.returned,
  };
}

export type PendingQueueEntry = { client: { khId: number | null; name: string }; pending: PendingEquipment };

export type PendingQueueWindow = {
  /** YYYY-MM-DD — okno faktur i paragonów (wszyscy klienci). */
  from: string;
  to: string;
  entries: PendingQueueEntry[];
  /** Dokumenty w oknie i te z numerami w uwagach (tylko one mogą dać pytanie). */
  scanned: number;
  withSerials: number;
  truncated: boolean;
};

type QueueRow = DocListRow & { kh__Kontrahent_Odbiorca?: { kh_Id?: number; adr_NazwaPelna?: string | null; adr_Nazwa?: string | null } | null };

/**
 * Kolejka „Do potwierdzenia” ze wszystkich klientów: faktury i paragony z numerami w uwagach z okna `days` dni do `to`
 * (najnowsze najpierw), ocenione jak w karcie klienta. Serwisant odpowiada hurtem, zanim klient zadzwoni. Tylko serwer.
 */
export async function fetchPendingQueueWindow(to: string, days: number): Promise<PendingQueueWindow> {
  const end = new Date(`${to}T12:00:00Z`);
  const from = new Date(end.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const range = { dataOd: from, dataDo: to };
  const [fs, pa, models] = await Promise.all([
    scanClientDocs(SUBIEKT_PATHS.documentsFs, {}, range),
    scanClientDocs(SUBIEKT_PATHS.documentsPa, {}, range),
    fetchDeviceModelDecisions(),
  ]);
  const rows = ([...fs.rows, ...pa.rows] as QueueRow[])
    .filter((r) => hasSerialNotes(r.dok_Uwagi))
    .sort((a, b) => String(b.dok_DataWyst ?? "").localeCompare(String(a.dok_DataWyst ?? "")) || b.dok_Id - a.dok_Id);
  const docs = await mapPool(rows, 6, (r) => getSubiektDocument(r.dok_Id));
  const [{ isDeviceLine }, assignments] = await Promise.all([deviceLineFilter(docs), fetchSerialAssignments(docs.map((d) => d.dok_Id))]);
  const inputs: TrustInputs = {
    deviceModel: (twId) => models.get(twId) ?? null,
    assignment: (docId, key) => assignments.get(`${docId}|${key}`),
    canBeDevice: isDeviceLine,
  };
  const clientOf = new Map(
    rows.map((r) => {
      const k = r.kh__Kontrahent_Odbiorca;
      const khId = Math.trunc(Number(k?.kh_Id ?? 0));
      return [r.dok_Id, { khId: khId > 0 ? khId : null, name: (k?.adr_NazwaPelna || k?.adr_Nazwa || "Klient bez nazwy").trim() }] as const;
    })
  );
  const entries = docs.flatMap((d) =>
    classifyInvoiceEquipment({ ...d, dok_Uwagi: (d.dok_Uwagi as string | null | undefined) ?? null }, inputs).pending.map((pending) => ({
      client: clientOf.get(d.dok_Id) ?? { khId: null, name: "Klient bez nazwy" },
      pending,
    }))
  );
  return { from, to, entries, scanned: fs.scanned + pa.scanned, withSerials: rows.length, truncated: fs.truncated || pa.truncated };
}

/** Ilość, która została u klienta: ostatnia korekta (KFS — stan po korekcie) albo pozycja minus zwroty (ZW). */
function finalQuantities(
  trusted: readonly TrustedEquipmentItem[],
  kfsRows: readonly CorrectionRow[],
  zwRows: readonly CorrectionRow[],
  docs: readonly SalesDoc[]
): Map<number, Map<number, number>> {
  const byId = new Map(docs.map((d) => [d.dok_Id, d]));
  const qtyByTw = (d: SalesDoc | undefined) => {
    const m = new Map<number, number>();
    for (const l of d?.dok_Pozycja ?? []) {
      const tw = Math.trunc(Number(l.ob_TowId));
      if (tw > 0) m.set(tw, (m.get(tw) ?? 0) + Math.max(0, Math.round(Number(l.ob_Ilosc ?? 0))));
    }
    return m;
  };
  const out = new Map<number, Map<number, number>>();
  const latestKfs = new Map<number, CorrectionRow>();
  for (const r of kfsRows) {
    const prev = latestKfs.get(Number(r.dok_DoDokId));
    if (!prev || String(r.dok_DataWyst ?? "") > String(prev.dok_DataWyst ?? "") || (r.dok_DataWyst === prev.dok_DataWyst && r.dok_Id > prev.dok_Id))
      latestKfs.set(Number(r.dok_DoDokId), r);
  }
  for (const [docId, r] of latestKfs) out.set(docId, qtyByTw(byId.get(r.dok_Id)));
  for (const r of zwRows) {
    const docId = Number(r.dok_DoDokId);
    const returnedQty = qtyByTw(byId.get(r.dok_Id));
    const m = out.get(docId) ?? new Map<number, number>();
    for (const [tw, q] of returnedQty) {
      const line = trusted.find((t) => t.invoiceId === docId && t.twId === tw);
      const base = m.get(tw) ?? line?.lineQuantity ?? 0;
      m.set(tw, Math.max(0, base - q));
    }
    out.set(docId, m);
  }
  return out;
}

export type ClientRecentInvoice = { id: number; number: string; date: string | null; gross: number | null };

/** Ostatnie faktury klienta (90 dni, najnowsze najpierw) — do wskazania faktury za naprawę. Tylko serwer. */
export async function fetchClientRecentInvoices(khId: number): Promise<ClientRecentInvoice[]> {
  const qs = subiektQueryString({ kh_id: khId, dataOd: warsawDateKeyDaysAgo(90), dataDo: warsawNowParts().dateKey, page: 1, pageSize: PAGE_SIZE });
  const res = await subiektJson<{ data?: { dok_Id: number; dok_NrPelny?: string | null; dok_DataWyst?: string | null; dok_WartBrutto?: number | null }[] }>(
    `${SUBIEKT_PATHS.documentsFs}${qs}`
  );
  return (res.data ?? [])
    .map((d) => ({
      id: d.dok_Id,
      number: d.dok_NrPelny?.trim() || `FS ${d.dok_Id}`,
      date: d.dok_DataWyst ? String(d.dok_DataWyst).slice(0, 10) : null,
      gross: typeof d.dok_WartBrutto === "number" ? d.dok_WartBrutto : null,
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id)
    .slice(0, 30);
}

type DocNumberRow = { dok_Id: number; dok_NrPelny?: string | null; dok_OdbiorcaId?: number | null; dok_PlatnikId?: number | null };

/**
 * Faktura sprzedaży po numerze wpisanym przez klienta („FS 978/M/11/2026”, „978/M/11/2026”) i jej odbiorca.
 * `numer` na liście FS filtruje po samym numerze kolejnym (wszystkie miesiące, sprawdzone na :5080), więc pełny
 * numer porównujemy tutaj. Paragonów nie szukamy: idą zwykle na zbiorczego kontrahenta detalicznego, więc
 * „klient z paragonu” byłby cudzym sprzętem. Tylko serwer.
 */
export async function findInvoiceBuyer(raw: string): Promise<{ number: string; khId: number } | null> {
  const want = parseSalesDocNumber(raw);
  if (!want || want.kind === "pa") return null;
  const qs = subiektQueryString({ numer: want.nr, page: 1, pageSize: PAGE_SIZE });
  const res = await subiektJson<{ data?: DocNumberRow[] }>(`${SUBIEKT_PATHS.documentsFs}${qs}`);
  for (const d of res.data ?? []) {
    if (parseSalesDocNumber(d.dok_NrPelny ?? "")?.key !== want.key) continue;
    const khId = Math.trunc(Number(d.dok_OdbiorcaId || d.dok_PlatnikId));
    if (Number.isSafeInteger(khId) && khId > 0) return { number: d.dok_NrPelny!.trim(), khId };
  }
  return null;
}
