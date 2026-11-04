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
};

const NUMBERED = /^(\d{1,3})\s*[.)]\s*(.*)$/;

/** Numer seryjny: bez spacji w środku nie musi być, ale cyfra jest zawsze („Proszę o kontakt” to nie SN). */
function serialTokens(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((t) => t.trim().replace(/\s+/g, " "))
    .filter((t) => t.length >= 3 && t.length <= 60 && /\d/.test(t));
}

/** Uwagi FS → numery seryjne po numerze pozycji (1 = pierwsza pozycja). */
export function parseInvoiceSerialNotes(notes: string | null | undefined): Map<number, string[]> {
  const out = new Map<number, string[]>();
  let current: number | null = null;
  for (const raw of String(notes ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = NUMBERED.exec(line);
    if (m) {
      current = Number(m[1]);
      if (current < 1) {
        current = null;
        continue;
      }
      const tokens = serialTokens(m[2] ?? "");
      if (tokens.length) out.set(current, [...(out.get(current) ?? []), ...tokens]);
      continue;
    }
    // Wiersz bez numeru: ciąg dalszy ostatniej pozycji; przed pierwszą numerowaną — zwykła uwaga.
    if (current == null) continue;
    const tokens = serialTokens(line);
    if (tokens.length) out.set(current, [...(out.get(current) ?? []), ...tokens]);
  }
  return out;
}

/** Czy uwagi wyglądają na numery seryjne — sito przed pobraniem szczegółów faktury. */
export function hasSerialNotes(notes: string | null | undefined): boolean {
  return parseInvoiceSerialNotes(notes).size > 0;
}

type InvoiceLine = { ob_Id?: number | null; ob_TowId?: number | null; tw_Symbol?: string | null; tw_Nazwa?: string | null };

export type InvoiceForEquipment = {
  dok_Id: number;
  dok_NrPelny?: string | null;
  dok_DataWyst?: string | null;
  dok_Uwagi?: string | null;
  dok_Pozycja?: InvoiceLine[] | null;
};

/** Pozycje faktury z numerami seryjnymi. Numer spoza zakresu pozycji jest pomijany (literówka w uwagach). */
export function equipmentFromInvoice(doc: InvoiceForEquipment): ClientEquipmentItem[] {
  const serials = parseInvoiceSerialNotes(doc.dok_Uwagi);
  if (!serials.size) return [];
  const lines = [...(doc.dok_Pozycja ?? [])].sort((a, b) => Number(a.ob_Id ?? 0) - Number(b.ob_Id ?? 0));
  const out: ClientEquipmentItem[] = [];
  for (const [no, sns] of serials) {
    const line = lines[no - 1];
    const twId = Math.trunc(Number(line?.ob_TowId));
    if (!line || !Number.isSafeInteger(twId) || twId <= 0) continue;
    out.push({
      twId,
      symbol: line.tw_Symbol?.trim() || null,
      name: line.tw_Nazwa?.trim() || line.tw_Symbol?.trim() || `Towar ${twId}`,
      serials: [...new Set(sns)],
      invoiceId: doc.dok_Id,
      invoiceNumber: doc.dok_NrPelny?.trim() || `FS ${doc.dok_Id}`,
      invoiceDate: doc.dok_DataWyst ? String(doc.dok_DataWyst).slice(0, 10) : null,
    });
  }
  return out;
}

/** `tw_Rodzaj` w Subiekcie: 2 = usługa (licencje, abonamenty z kluczem w uwagach) — to nie sprzęt do naprawy. */
export const SUBIEKT_PRODUCT_KIND_SERVICE = 2;

/** Bez usług; towar o nieznanym rodzaju (nie udało się sprawdzić) zostaje — lepiej pokazać za dużo niż zgubić sprzęt. */
export function dropServiceProducts(
  items: readonly ClientEquipmentItem[],
  kindByTwId: ReadonlyMap<number, number | null>
): ClientEquipmentItem[] {
  return items.filter((i) => kindByTwId.get(i.twId) !== SUBIEKT_PRODUCT_KIND_SERVICE);
}

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
