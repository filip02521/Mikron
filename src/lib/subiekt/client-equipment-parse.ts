/**
 * Sprzęt klienta z faktur sprzedaży — czysta logika (bez sieci).
 *
 * Numery seryjne handlowcy wpisują w Uwagach FS (`dok_Uwagi`), w postaci „N. numer”, gdzie N to
 * numer pozycji na fakturze (kolejność `dok_Pozycja`, rosnąco po `ob_Id`). Kolejne wiersze bez numeru
 * należą do ostatniej pozycji (np. zestaw: silnik, prostnica, sterownik):
 *
 *   1. X10A1TESTR101
 *   X20A1TESTS102
 *   7. 2026/001
 *
 * „Sprzęt” to pozycja, która ma numer seryjny — materiały zużywalne go nie mają.
 */

export type ClientEquipmentItem = {
  twId: number;
  symbol: string | null;
  name: string;
  serials: string[];
  invoiceId: number;
  invoiceNumber: string;
  /** YYYY-MM-DD */
  invoiceDate: string | null;
  /** Cena jednostkowa netto z faktury — odróżnia urządzenie od części do niego z tym samym SN. */
  unitPrice?: number | null;
  /** Sztuki bez numeru seryjnego na dokumencie (model rozpoznany jako urządzenie); brak — pozycja z numerami. */
  quantity?: number;
  /** Model nie jest jeszcze potwierdzony jako urządzenie (przyjęcie: do wyboru, ale nie wpisuje się sam). */
  unconfirmed?: boolean;
};

const NUMBERED = /^(\d{1,3})\s*[.)]\s*(.*)$/;

/**
 * „S/N:”, „SN ”, „nr:”, „numer seryjny” przed numerem — nie są jego częścią. „SN”/„nr” tylko z separatorem:
 * numer „SN11122” zaczyna się od tych liter i zostaje cały.
 */
const SERIAL_PREFIX = /^(?:s\s*\/\s*n\s*[:.]?\s*|(?:sn|nr|numer(?:\s+seryjny)?)(?:\s*[:.]\s*|\s+))/i;
/** Jeden ciąg bez spacji, z cyfrą, 5–40 znaków (adres „Opolska 1”, kod „01-267” czy „Proszę o kontakt” odpadają). */
const SERIAL_TOKEN = /^[A-Za-z0-9][A-Za-z0-9/._-]{4,39}$/;
const POSTCODE = /^\d{2}-\d{3}$/;

/** Krótszy numer (np. „9314”) tylko w wierszu jawnie oznaczonym „SN” — w luźnym tekście to rok, ilość albo numer domu. */
const SERIAL_TOKEN_EXPLICIT = /^[A-Za-z0-9][A-Za-z0-9/._-]{2,39}$/;

function asSerial(raw: string, explicit = false): string | null {
  const t = raw.trim().replace(SERIAL_PREFIX, "").trim();
  return (explicit ? SERIAL_TOKEN_EXPLICIT : SERIAL_TOKEN).test(t) && /\d/.test(t) && !POSTCODE.test(t) ? t : null;
}

/** Numer rozdzielony spacją przy wpisywaniu: „A 1400001”, „X2BTEST 001” — jedna litera albo końcówka z 3 cyfr. */
function joinSplitSerials(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (prev && ((/^[A-Za-z]$/.test(prev) && /^\d{4,}$/.test(p)) || (/^\d{3}$/.test(p) && /[A-Za-z]/.test(prev) && /\d/.test(prev) && prev.length >= 5))) {
      out[out.length - 1] = `${prev}${p}`;
    } else out.push(p);
  }
  return out;
}

/**
 * Numery z fragmentu uwag. Kilka numerów oddziela przecinek, średnik albo spacja — ale wiersz uznajemy
 * tylko wtedy, gdy KAŻDE jego słowo wygląda na numer: „Jana Kazimierza 53a” (adres z paragonu) nie jest SN.
 */
function serialTokens(text: string, explicit = false): string[] {
  const parts = joinSplitSerials(
    text
      // Apostrof bywa literówką zamiast średnika („T20R2X246' T20R2X278”) — numer nigdy go nie zawiera.
      .split(/[,;']/)
      .map((p) => p.trim().replace(SERIAL_PREFIX, ""))
      .flatMap((p) => p.split(/\s+/))
      // „sn 302 i 304/2023” — spójnik między numerami nie odrzuca wiersza.
      .filter((p) => p && !/^(?:i|oraz)$/i.test(p))
  );
  const serials = parts.map((p) => asSerial(p, explicit));
  return serials.every((s): s is string => s != null) ? serials : [];
}

/**
 * Wiersz z numerem bez pozycji faktury — tak wpisuje większość handlowców: „SN X21TEST006”, „SN: X2BTEST015”,
 * „S/N: A 1400001”, „sn 400001”, sklejone „SNX21TEST003” (bez „SN” tylko, gdy dalej jest litera: „SN11122” zostaje cały).
 */
const SN_LINE = /^(?:s\s*\/\s*n|sn|nr\s+seryjny|numer\s+seryjny)(?:\s*[:.]\s*|\s+)(.+)$/i;
const SN_GLUED = /^sn(?=[a-z][a-z0-9]*\d)([a-z0-9/._-]{4,40})$/i;
/** Sam numer w wierszu bez „SN”: litery i cyfry (obie), 6–40 znaków, bez separatorów numerów dokumentów. */
const BARE_SERIAL = /^(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{6,40}$/;
/** „Poz 4”, „Poz. 4:”, „pozycja 4 SN…” — nagłówek pozycji; numery w tym samym albo w kolejnych wierszach. */
const POS_LINE = /^poz(?:ycja|\.)?\s*(\d{1,3})\s*[:.)]?\s*(.*)$/i;
/**
 * Numer części zestawu z etykietą: „C.B:T20R2X178”, „H.P: H24R2X078”, „FOOT:T09R2X178”. Etykieta bez cyfr (do 12 znaków),
 * numer z literą i cyfrą; dane firmy („NIP: PL…”, „tel.”, zamówienie, kupon, konto) nie są numerem.
 */
const LABELED_SN = /^(?!(?:nip|regon|tel|fax|zam|kupon|iban|konto|nr\s*konta|faktura|fv|wz|zk)\b)([a-ząćęłńóśźż][a-ząćęłńóśźż.\s/]{0,15}):\s*(.+)$/i;
/** „Poz 1 - 5 SN X21TEST001” — numer zestawu z kilku pozycji. */
const RANGE_LINE = /^\D{0,15}?\b(\d{1,3})\s*[-–]\s*(\d{1,3})\s+(?:s\s*\/\s*n|sn)(?:\s*[:.]\s*|\s+)(.+)$/i;

export type InvoiceSerialNotes = {
  /** Numer pozycji (1 = pierwsza) → numery. */
  byPosition: Map<number, string[]>;
  /** Numery z zakresu pozycji („1 - 5 SN …”). */
  ranges: { from: number; to: number; serials: string[] }[];
  /** Numery bez pozycji („SN …”) — przypisuje je `equipmentFromInvoice` po cenie pozycji. */
  loose: string[];
  /** Numery z etykietą („lampa s/n: …”, „C.B: …”) — etykieta bywa nazwą produktu i wskazuje pozycję. */
  labeled: { label: string; serials: string[] }[];
};

/** Uwagi FS → numery seryjne: po pozycji, z zakresu pozycji albo bez pozycji. */
export function parseInvoiceSerialNotesFull(notes: string | null | undefined): InvoiceSerialNotes {
  const byPosition = new Map<number, string[]>();
  const ranges: InvoiceSerialNotes["ranges"] = [];
  const loose: string[] = [];
  const labeled: InvoiceSerialNotes["labeled"] = [];
  let current: number | null = null;
  for (const raw of String(notes ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const range = RANGE_LINE.exec(line);
    if (range) {
      const tokens = serialTokens(range[3] ?? "", true);
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (tokens.length && from >= 1 && to >= from) ranges.push({ from, to, serials: tokens });
      current = null;
      continue;
    }
    const m = NUMBERED.exec(line) ?? POS_LINE.exec(line);
    if (m) {
      current = Number(m[1]);
      if (current < 1) {
        current = null;
        continue;
      }
      const tokens = serialTokens(m[2] ?? "");
      if (tokens.length) byPosition.set(current, [...(byPosition.get(current) ?? []), ...tokens]);
      continue;
    }
    const sn = SN_LINE.exec(line);
    const glued = sn ? null : SN_GLUED.exec(line);
    if (sn || glued) {
      const tokens = glued ? [glued[1]!] : serialTokens(sn![1] ?? "", true);
      if (tokens.length) loose.push(...tokens);
      current = null;
      continue;
    }
    // Wiersz bez numeru: ciąg dalszy ostatniej pozycji; przed pierwszą numerowaną — sam numer bez „SN”
    // („R219AB007”, „t12xy028”): tylko gdy cały wiersz to numery z literą i cyfrą, bez „/” i „.” (nie numer dokumentu).
    if (current == null) {
      const bare = line.split(/[\s,;]+/).filter(Boolean);
      if (bare.length && bare.every((t) => BARE_SERIAL.test(t))) loose.push(...bare);
      else {
        const lab = LABELED_SN.exec(line);
        if (lab) {
          const label = lab[1]!.trim();
          const value = lab[2]!.trim();
          // Etykieta z „s/n” mówi, że to numer — wtedy też krótki i z ukośnikiem („2021/555”); bez niej tylko litery z cyframi.
          const tokens = /s\s*\/\s*n|\bsn\b/i.test(label) ? serialTokens(value, true) : BARE_SERIAL.test(value) ? [value] : [];
          if (tokens.length) labeled.push({ label, serials: tokens });
        }
      }
      continue;
    }
    const tokens = serialTokens(line);
    if (tokens.length) byPosition.set(current, [...(byPosition.get(current) ?? []), ...tokens]);
  }
  return { byPosition, ranges, loose, labeled };
}

/** Uwagi FS → numery seryjne po numerze pozycji (1 = pierwsza pozycja); bez numerów „SN …” bez pozycji. */
export function parseInvoiceSerialNotes(notes: string | null | undefined): Map<number, string[]> {
  return parseInvoiceSerialNotesFull(notes).byPosition;
}

/** Czy uwagi wyglądają na numery seryjne — sito przed pobraniem szczegółów faktury. */
export function hasSerialNotes(notes: string | null | undefined): boolean {
  const n = parseInvoiceSerialNotesFull(notes);
  return n.byPosition.size > 0 || n.ranges.length > 0 || n.loose.length > 0 || n.labeled.length > 0;
}

export type InvoiceLine = {
  ob_Id?: number | null;
  ob_TowId?: number | null;
  tw_Symbol?: string | null;
  tw_Nazwa?: string | null;
  ob_Ilosc?: number | null;
  ob_CenaNetto?: number | null;
  ob_CenaBrutto?: number | null;
};

export type InvoiceForEquipment = {
  dok_Id: number;
  dok_NrPelny?: string | null;
  dok_DataWyst?: string | null;
  dok_Uwagi?: string | null;
  dok_Pozycja?: InvoiceLine[] | null;
};

/** Słowa etykiety, które mogą być nazwą produktu: min. 4 litery, bez „numer”, „seryjny” itp. */
export function labelWords(label: string): string[] {
  const skip = new Set(["numer", "seryjny", "serial", "nr", "sn"]);
  return label
    .toLocaleLowerCase("pl-PL")
    .split(/[^a-ząćęłńóśźż]+/)
    .filter((w) => w.length >= 4 && !skip.has(w));
}

/** Numer z uwag faktury bez pozycji-urządzenia: faktura za naprawę (same części i usługi), nie zakup. */
export type InvoiceRepairRef = { serial: string; invoiceId: number; invoiceNumber: string; invoiceDate: string | null };

/** `tw_Rodzaj` w Subiekcie: 2 = usługa (licencje, abonamenty z kluczem w uwagach) — to nie sprzęt do naprawy. */
export const SUBIEKT_PRODUCT_KIND_SERVICE = 2;

/**
 * Lista do wyboru: najnowsze zakupy najpierw; ten sam egzemplarz (towar + numer seryjny) z kilku faktur
 * (korekta, ponowne wystawienie) — tylko najnowszy wpis.
 */
export function mergeClientEquipment(items: readonly ClientEquipmentItem[]): ClientEquipmentItem[] {
  const sorted = [...items].sort(
    (a, b) => (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? "") || b.invoiceId - a.invoiceId
  );
  const seen = new Set<string>();
  const out: ClientEquipmentItem[] = [];
  for (const it of sorted) {
    const fresh = it.serials.filter((s) => !seen.has(`${it.twId}|${s.toUpperCase()}`));
    for (const s of fresh) seen.add(`${it.twId}|${s.toUpperCase()}`);
    if (fresh.length) out.push({ ...it, serials: fresh });
  }
  return out;
}

/** Numer dokumentu sprzedaży do porównań: „fs 978/m/11/2026”, „978/M/11/2026” → „978/M/11/2026”; rodzaj FS/PA osobno. */
export function parseSalesDocNumber(raw: string): { kind: "fs" | "pa" | null; key: string; nr: number } | null {
  const m = raw.trim().toUpperCase().match(/^(?:(FS|PA)\s*)?(\d{1,7})\s*(\/[A-Z0-9/ ]*)?$/);
  if (!m) return null;
  const nr = Number(m[2]);
  if (!nr) return null;
  return { kind: m[1] === "FS" ? "fs" : m[1] === "PA" ? "pa" : null, key: `${nr}${(m[3] ?? "").replace(/\s+/g, "")}`, nr };
}

export type EquipmentTicketHint = "serial" | "invoice" | "product" | null;

const serialCmp = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/** Słowa nazwy do porównania (≥ 4 znaki, bez wielkości liter i polskich znaków). */
function nameWords(s: string): Set<string> {
  return new Set(
    s
      .toLocaleLowerCase("pl-PL")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4)
  );
}

/**
 * Sprzęt klienta ułożony pod zgłoszenie z helpdesku: najpierw egzemplarz o numerze seryjnym ze zgłoszenia,
 * potem pozycje z faktury podanej w zgłoszeniu, potem te, których nazwa ma wspólne słowo z „produktem”;
 * reszta w dotychczasowej kolejności.
 */
export function rankEquipmentForTicket(
  items: readonly ClientEquipmentItem[],
  ticket: { invoice: string; product: string; serial?: string }
): (ClientEquipmentItem & { hint: EquipmentTicketHint })[] {
  const inv = parseSalesDocNumber(ticket.invoice);
  const words = nameWords(ticket.product);
  const sn = serialCmp(ticket.serial ?? "");
  const hinted = items.map((it, i) => {
    const doc = parseSalesDocNumber(it.invoiceNumber);
    const bySerial = sn.length > 0 && it.serials.some((s) => serialCmp(s) === sn);
    const byInvoice = !!inv && !!doc && doc.key === inv.key && (!inv.kind || !doc.kind || inv.kind === doc.kind);
    const byProduct = words.size > 0 && [...nameWords(`${it.name} ${it.symbol ?? ""}`)].some((w) => words.has(w));
    const hint: EquipmentTicketHint = bySerial ? "serial" : byInvoice ? "invoice" : byProduct ? "product" : null;
    return { ...it, hint, i };
  });
  const rank = (h: EquipmentTicketHint) => (h === "serial" ? 0 : h === "invoice" ? 1 : h === "product" ? 2 : 3);
  return hinted.sort((a, b) => rank(a.hint) - rank(b.hint) || a.i - b.i).map(({ i: _i, ...rest }) => rest);
}
