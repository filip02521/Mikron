/**
 * Opisy pozycji z wcześniejszego maila do agencji celnej (wklejonego z poczty) → propozycje kart.
 * Pozycje mapowane po numerze z maila na pozycje faktury w tej samej kolejności.
 * Czysta logika — bez bazy i sieci.
 *
 * Obsługiwane zapisy (mail Saeshin i format generowany przez aplikację):
 *   „1-4. Prostnice do mikrosilnika … - kod CN 90184990”
 *   „9-10. Podkładka”
 *   „2. Uchwyt do skalpela nr 3, stal nierdzewna, wyrób medyczny, kod CN 90184990, stawka VAT 8%”
 *   „Stawka VAT 23%” / „Stawka VAT 23% dla wszystkich pozycji” — wspólna stawka
 *   „… kod taryfy celnej dla wszystkich:\n90184990” — wspólny kod CN
 *   „1-3. Wiertła …; materiał z którego zostały wykonane - stal, węglik”
 *   „Kod taryfy celnej: 8207 70 90” pod pozycjami — kod dla pozycji powyżej bez własnego kodu
 */

import { normalizeCnCode, type CustomsVatRate } from "./customs-clearance";

export type ImportedEmailLine = {
  descriptionPl: string;
  material: string;
  cnCode: string | null;
  vatRate: CustomsVatRate | null;
  isMedicalDevice: boolean;
};

export type ImportedCustomsEmail = {
  /** Numer pozycji (od 1) → opis. Zakres „9-10.” daje dwa wpisy. */
  byPosition: Map<number, ImportedEmailLine>;
  sharedCnCode: string | null;
  sharedVatRate: CustomsVatRate | null;
  /** Z „Przesyłka zawiera …” (bez wspólnego kodu CN). */
  shipmentDescription: string | null;
  maxPosition: number;
  /** Zakresy „29-31. …” jak w mailu — do sprawdzenia, czy jeden opis pasuje do wszystkich pozycji. */
  ranges: { from: number; to: number; descriptionPl: string }[];
};

const VAT_RATES = new Set([0, 5, 8, 23]);
const MAX_RANGE = 500;

const CN_RE = /[\s,;–-]*\bkod(?:em)?\s+(?:CN|HS|taryf\w*(?:\s+celnej)?)\s*(?:dla\s+wszystkich)?\s*:?\s*(\d{4}[\s.]?\d{2}[\s.]?\d{2})\b/i;
const VAT_RE = /[\s,;–-]*\bstawk\w*\s+VAT\s*:?\s*(\d{1,2})\s*%/i;
const MEDICAL_RE = /[\s,;–-]*\bwyr[oó]b\w*\s+medyczn\w*/i;
const ENTRY_RE = /^\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*\.\s+(.+?)\s*$/;
/** Sekcje maila numerowane jak pozycje („1. Dane na fakturze…”, „3. Mikran sp. z o.o.”) — to nie towary. */
const SECTION_RE = /^(dane\s+(na\s+fakturze|do\s+odprawy)|przesyłka\s+zawiera|rodzaj\s+odprawy|stawk\w*\s+VAT|mikran\b|kod\w*\s+taryf)/i;
/** „; materiał z którego zostały wykonane - stal, węglik” / „, materiał: stal”. */
const MATERIAL_RE = /[;,]\s*materiał\w*(?:\s+z\s+którego\s+\S+\s+wykonan\w*)?\s*[-–:]\s*(.+)$/i;
/** Wiersz z samym kodem taryfy: „Kod taryfy celnej: 8207 70 90”, „kod CN 82077090”. */
const CN_ROW_RE = /^kod(?:em)?\s+(?:CN|HS|taryf\w*(?:\s+celnej)?)\s*(dla\s+wszystkich)?\s*:?\s*(\d{4}[\s.]?\d{2}[\s.]?\d{2})\s*$/i;

function vatOf(raw: string | undefined): CustomsVatRate | null {
  const n = Number(raw);
  return VAT_RATES.has(n) ? (n as CustomsVatRate) : null;
}

/** Jedna pozycja maila → opis, materiał, CN, VAT, wyrób medyczny. */
export function parseEmailLineBody(body: string): ImportedEmailLine {
  let rest = body;
  // Format aplikacji „opis, materiał, kod CN …, stawka VAT …%” — tylko wtedy przecinki dzielą opis.
  const appFormat = /,\s*(kod\s+CN|stawk\w*\s+VAT|wyr[oó]b\w*\s+medyczn)/i.test(rest);
  // Najpierw znaczniki (CN, VAT, wyrób medyczny), potem materiał — inaczej „materiał: …” połknąłby kod CN.
  const cn = rest.match(CN_RE);
  if (cn) rest = rest.replace(CN_RE, "");
  const vat = rest.match(VAT_RE);
  if (vat) rest = rest.replace(VAT_RE, "");
  const medical = MEDICAL_RE.test(rest);
  if (medical) rest = rest.replace(MEDICAL_RE, "");
  rest = rest.replace(/[\s,;:–-]+$/, "").trim();
  const explicitMaterial = rest.match(MATERIAL_RE);
  if (explicitMaterial) rest = rest.replace(MATERIAL_RE, "").replace(/[\s,;:–-]+$/, "").trim();
  const [description = "", ...material] = explicitMaterial || !appFormat ? [rest] : rest.split(/,\s+/);
  return {
    descriptionPl: description.trim().slice(0, 500),
    material: (explicitMaterial?.[1] ?? material.join(", ")).replace(/[\s.;]+$/, "").trim().slice(0, 300),
    cnCode: normalizeCnCode(cn?.[1]),
    vatRate: vatOf(vat?.[1]),
    isMedicalDevice: medical,
  };
}

export function parseCustomsEmailText(text: string): ImportedCustomsEmail {
  const byPosition = new Map<number, ImportedEmailLine>();
  let sharedCnCode: string | null = null;
  let sharedVatRate: CustomsVatRate | null = null;
  let shipmentDescription: string | null = null;
  let maxPosition = 0;
  const ranges: ImportedCustomsEmail["ranges"] = [];
  let expectSharedCn = false;
  /** Pozycje od ostatniego wiersza „Kod taryfy celnej: …” — ten wiersz dotyczy ich. */
  let sinceLastCn: number[] = [];

  for (const rawRow of text.replace(/\r/g, "").split("\n")) {
    // Cytat z poczty („> 5. Podkładka”) i nadmiarowe spacje.
    const row = rawRow.replace(/^\s*(>\s*)+/, "").trim();
    if (!row) continue;

    if (expectSharedCn) {
      expectSharedCn = false;
      const cn = normalizeCnCode(row);
      if (cn) {
        sharedCnCode = cn;
        continue;
      }
    }

    const numbered = row.match(ENTRY_RE);
    // „2. Przesyłka zawiera …” — numer sekcji, nie pozycji: dalej jak wiersz bez numeru.
    const entry = numbered && !SECTION_RE.test(numbered[3]!) ? numbered : null;
    const line = numbered && !entry ? numbered[3]! : row;
    if (entry) {
      const from = Number(entry[1]);
      const to = entry[2] ? Number(entry[2]) : from;
      if (from < 1 || to < from || to - from > MAX_RANGE) continue;
      const parsed = parseEmailLineBody(entry[3]!);
      if (!parsed.descriptionPl) continue;
      for (let p = from; p <= to; p++) {
        byPosition.set(p, parsed);
        sinceLastCn.push(p);
      }
      maxPosition = Math.max(maxPosition, to);
      if (to > from) ranges.push({ from, to, descriptionPl: parsed.descriptionPl });
      continue;
    }

    const cnRow = line.match(CN_ROW_RE);
    if (cnRow) {
      const cn = normalizeCnCode(cnRow[2]);
      const targets = sinceLastCn.filter((p) => !byPosition.get(p)?.cnCode);
      if (cn && targets.length && !cnRow[1]) {
        for (const p of targets) byPosition.set(p, { ...byPosition.get(p)!, cnCode: cn });
      } else if (cn) {
        sharedCnCode = cn;
      }
      sinceLastCn = [];
      continue;
    }

    // Wiersze bez numeru: nagłówki („2) Przesyłka zawiera …”), wspólny CN i VAT.
    const shipment = line.match(/przesyłka\s+zawiera\s+(.*)$/i);
    if (shipment) {
      const body = shipment[1]!;
      const cn = body.match(CN_RE);
      if (cn) sharedCnCode = normalizeCnCode(cn[1]);
      else if (/kod\w*\s+taryf\w*/i.test(body)) expectSharedCn = true;
      const desc = body
        .replace(CN_RE, "")
        .replace(/,?\s*kod\w*\s+taryf\w*.*$/i, "")
        .replace(/[\s,:;–-]+$/, "")
        .trim();
      if (desc) shipmentDescription = desc.slice(0, 300);
      continue;
    }
    const vat = line.match(/^stawk\w*\s+VAT\s*:?\s*(\d{1,2})\s*%/i);
    if (vat) {
      sharedVatRate = vatOf(vat[1]) ?? sharedVatRate;
      continue;
    }
    if (/kod\w*\s+taryf\w*.*wszystkich\s*:?\s*$/i.test(line)) expectSharedCn = true;
  }

  return { byPosition, sharedCnCode, sharedVatRate, shipmentDescription, maxPosition, ranges };
}

/** Oznaczenie modelu / artykułu w tekście: „DE-1179”, „F100aIII”, „UP-50H”. */
const MODEL_TOKEN_RE = /\b[A-Z]{1,5}[- ]?\d{2,}[A-Z0-9]*\b/gi;

/**
 * Zakres z maila („29-31. Nożyk … Zahle DE-1179 nr 10”), którego opis wskazuje konkretny artykuł,
 * a obejmuje też pozycje z innymi kodami — opis jednej pozycji trafiłby do kart pozostałych.
 */
export function emailRangeConflicts(
  ranges: ImportedCustomsEmail["ranges"],
  lines: readonly { position: number; supplierArticleCode: string; supplierName: string }[]
): string[] {
  const out: string[] = [];
  for (const r of ranges) {
    const inRange = lines.filter((l) => l.position >= r.from && l.position <= r.to);
    if (new Set(inRange.map((l) => l.supplierArticleCode)).size < 2) continue;
    const tokens = [...r.descriptionPl.matchAll(MODEL_TOKEN_RE)].map((m) => m[0].toUpperCase().replace(/\s+/g, "-"));
    if (!tokens.length) continue;
    const matches = (l: (typeof inRange)[number]) => {
      const hay = `${l.supplierArticleCode} ${l.supplierName}`.toUpperCase().replace(/\s+/g, "-");
      return tokens.some((t) => hay.includes(t));
    };
    const hit = inRange.filter(matches);
    const miss = inRange.filter((l) => !matches(l));
    if (!hit.length || !miss.length) continue;
    out.push(
      `Poz. ${r.from}-${r.to}: opis „${r.descriptionPl.slice(0, 60)}” wskazuje poz. ${hit.map((l) => l.position).join(", ")}, ` +
        `a obejmuje też ${miss.map((l) => `${l.position} (${l.supplierArticleCode || l.supplierName})`).join(", ")} - rozdziel opis.`
    );
  }
  return out;
}
