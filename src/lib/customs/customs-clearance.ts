/**
 * Odprawa celna importu (spoza UE → PL) — czysta logika bez bazy i sieci.
 *
 * Źródła danych:
 * - pozycje faktury dostawcy (kod artykułu, nazwa, ilość, cena),
 * - karty celne artykułów (`customs_product_cards`) — zatwierdzone wcześniej opisy,
 * - artykuły wymienione w dokumentach dostawcy (`customs_document_articles`,
 *   np. Annex A deklaracji zgodności) — podstawa stawki VAT 8% dla wyrobów medycznych.
 */

export type CustomsVatRate = 0 | 5 | 8 | 23;

export const CUSTOMS_DEFAULT_VAT_RATE: CustomsVatRate = 23;
export const CUSTOMS_MEDICAL_VAT_RATE: CustomsVatRate = 8;

export const CUSTOMS_IMPORTER = {
  name: "Mikran sp. z o.o.",
  street: "ul. Wojskowa 3/L4",
  postalCity: "60-792 Poznań",
  nip: "7831008373",
} as const;

export type CustomsDocumentRef = {
  id: string;
  fileName: string;
  description: string;
};

/** Znormalizowany kod artykułu → dokumenty dostawcy, w których występuje. */
export type CustomsDocumentArticleIndex = ReadonlyMap<string, readonly CustomsDocumentRef[]>;

export type CustomsProductCard = {
  supplierArticleCode: string;
  descriptionPl: string;
  material: string;
  cnCode: string | null;
  isMedicalDevice: boolean;
  vatRate: CustomsVatRate | null;
  vatBasisDocumentId: string | null;
  status: "proposed" | "confirmed";
  /** Skąd wartości: ręcznie wpisane wygrywają z dokumentami, propozycje AI — nie. */
  source?: "manual" | "ai" | "copied";
};

/**
 * Kod artykułu dostawcy w jednej postaci: wielkie litery, bez zbędnych spacji,
 * jednolity myślnik („de – 1196” → „DE-1196”).
 */
export function normalizeArticleCode(code: string | null | undefined): string {
  if (!code) return "";
  return code
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Wartości z pustej kolumny kodu („Model: /”), które nie są numerem artykułu. */
const CODE_PLACEHOLDER = /^[\s/\\.\-–—_*]*$|^(N\/?A|NONE|BRAK|NIL)$/i;

/**
 * Klucz artykułu do kart celnych: kod dostawcy, a gdy faktura go nie ma (UP3D, PioCreat,
 * Saeshin „105L(BL):COLLET CHUCK "A"”) — nazwa z faktury bez interpunkcji, żeby ta sama
 * pozycja trafiała w tę samą kartę niezależnie od tego, jak AI przepisało dwukropki i cudzysłowy.
 */
export function customsArticleKey(code: string | null | undefined, name: string | null | undefined): string {
  const raw = (code ?? "").trim();
  if (raw && !CODE_PLACEHOLDER.test(raw)) return normalizeArticleCode(raw).slice(0, 120);
  return (name ?? "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 120)
    .trim();
}

export function buildDocumentArticleIndex(
  rows: readonly { supplierArticleCode: string; document: CustomsDocumentRef }[]
): CustomsDocumentArticleIndex {
  const index = new Map<string, CustomsDocumentRef[]>();
  for (const row of rows) {
    const code = normalizeArticleCode(row.supplierArticleCode);
    if (!code) continue;
    const docs = index.get(code) ?? [];
    if (!docs.some((d) => d.id === row.document.id)) docs.push(row.document);
    index.set(code, docs);
  }
  return index;
}

export type ResolvedLineVat = {
  rate: CustomsVatRate;
  isMedicalDevice: boolean;
  /** Dokument do załączenia agencji (tylko przy stawce 8%). */
  basisDocument: CustomsDocumentRef | null;
  source: "document" | "card" | "default";
  warning: string | null;
};

/**
 * Stawka VAT pozycji:
 * - karta zatwierdzona lub wpisana ręcznie wygrywa (użytkownik zdecydował), ale rozbieżność
 *   z dokumentami dostawcy daje ostrzeżenie,
 * - inaczej (brak karty / propozycja AI): artykuł w dokumencie dostawcy → 8% (wyrób medyczny),
 *   w pozostałych przypadkach 23%.
 * Stawka 8% zawsze wymaga dokumentu do załączenia — bez niego ostrzeżenie.
 */
export function resolveLineVat(input: {
  articleCode: string;
  card: CustomsProductCard | null;
  documentIndex: CustomsDocumentArticleIndex;
}): ResolvedLineVat {
  const code = normalizeArticleCode(input.articleCode);
  const docs = code ? input.documentIndex.get(code) ?? [] : [];
  const card = input.card;

  // Stawka od człowieka: zatwierdzona, wpisana ręcznie albo przeniesiona z wcześniejszego maila / historii
  // odpraw („copied”). Tylko propozycja AI nie decyduje o VAT — wtedy dokumenty albo 23%.
  const userDecided =
    card != null && (card.status === "confirmed" || card.source === "manual" || card.source === "copied");
  if (card && userDecided && card.vatRate != null) {
    if (card.vatRate === CUSTOMS_MEDICAL_VAT_RATE) {
      const basis =
        docs.find((d) => d.id === card.vatBasisDocumentId) ?? docs[0] ?? null;
      return {
        rate: card.vatRate,
        isMedicalDevice: card.isMedicalDevice,
        basisDocument: basis,
        source: "card",
        warning: basis
          ? null
          : "VAT 8% bez dokumentu dostawcy — dodaj deklarację zgodności w karcie dostawcy.",
      };
    }
    return {
      rate: card.vatRate,
      isMedicalDevice: card.isMedicalDevice,
      basisDocument: null,
      source: "card",
      warning:
        docs.length > 0
          ? `Artykuł jest w dokumencie „${docs[0]!.fileName}” — sprawdź, czy nie należy się 8%.`
          : null,
    };
  }

  if (docs.length > 0) {
    return {
      rate: CUSTOMS_MEDICAL_VAT_RATE,
      isMedicalDevice: true,
      basisDocument: docs[0]!,
      source: "document",
      warning: null,
    };
  }

  return {
    rate: CUSTOMS_DEFAULT_VAT_RATE,
    isMedicalDevice: false,
    basisDocument: null,
    source: "default",
    warning: null,
  };
}

export type CustomsEmailLine = {
  position: number;
  descriptionPl: string;
  material: string;
  cnCode: string | null;
  isMedicalDevice: boolean;
  vatRate: CustomsVatRate;
};

function lineGroupKey(line: CustomsEmailLine, includeCn: boolean): string {
  return JSON.stringify([
    line.descriptionPl.trim(),
    line.material.trim(),
    line.isMedicalDevice,
    line.vatRate,
    includeCn ? line.cnCode : null,
  ]);
}

function formatPositionRange(from: number, to: number): string {
  return from === to ? `${from}.` : `${from}-${to}.`;
}

function formatLineBody(line: CustomsEmailLine, includeCn: boolean, includeVat: boolean): string {
  const description = line.descriptionPl.trim();
  const material = line.material.trim();
  // Opis z przecinkami („…, np. pmma”) — materiał po średniku, żeby agencja nie wzięła go za część opisu.
  const parts = description.includes(",") && material
    ? [`${description}; materiał: ${material}`]
    : [description, material].filter(Boolean);
  if (line.isMedicalDevice) parts.push("wyrób medyczny");
  if (includeCn && line.cnCode) parts.push(`kod CN ${line.cnCode}`);
  if (includeVat) parts.push(`stawka VAT ${line.vatRate}%`);
  return parts.join(", ");
}

/** Wspólna stawka VAT, gdy wszystkie pozycje mają tę samą (wtedy raz pod listą, nie przy każdej). */
export function sharedVatRate(lines: readonly CustomsEmailLine[]): CustomsVatRate | null {
  const rates = new Set(lines.map((l) => l.vatRate));
  return rates.size === 1 ? [...rates][0]! : null;
}

/** Pozycje do maila: kolejne identyczne pozycje łączone w zakres („8-9.”). */
export function formatCustomsLines(
  lines: readonly CustomsEmailLine[],
  includeCn: boolean,
  includeVat = true
): string[] {
  const sorted = [...lines].sort((a, b) => a.position - b.position);
  const out: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const first = sorted[i]!;
    const key = lineGroupKey(first, includeCn);
    let j = i;
    while (
      j + 1 < sorted.length &&
      sorted[j + 1]!.position === sorted[j]!.position + 1 &&
      lineGroupKey(sorted[j + 1]!, includeCn) === key
    ) {
      j++;
    }
    out.push(
      `${formatPositionRange(first.position, sorted[j]!.position)} ${formatLineBody(first, includeCn, includeVat)}`
    );
    i = j + 1;
  }
  return out;
}

/** Wspólny kod CN, gdy wszystkie pozycje go mają i jest ten sam. */
export function sharedCnCode(lines: readonly CustomsEmailLine[]): string | null {
  const codes = new Set(lines.map((l) => l.cnCode));
  if (codes.size !== 1) return null;
  const [only] = codes;
  return only ?? null;
}

/** Treść maila do agencji celnej w formacie używanym w Mikranie. */
export function formatCustomsAgencyEmail(input: {
  shipmentDescription: string;
  lines: readonly CustomsEmailLine[];
  invoiceDataCorrect?: boolean;
}): string {
  const shared = sharedCnCode(input.lines);
  const shipment = input.shipmentDescription.trim() || "towary";
  const header = shared
    ? `2) Przesyłka zawiera ${shipment}, kod taryfy celnej dla wszystkich:\n${shared}`
    : `2) Przesyłka zawiera ${shipment}:`;

  // Jedna stawka dla całej przesyłki (np. Saeshin — same 23%) → raz pod listą, jak w mailach Mikranu.
  const vat = input.lines.length > 1 ? sharedVatRate(input.lines) : null;
  const list = [header, "", ...formatCustomsLines(input.lines, shared == null, vat == null)];
  if (vat != null) list.push("", `Stawka VAT ${vat}% dla wszystkich pozycji`);

  const blocks = [
    "Dzień dobry,",
    input.invoiceDataCorrect === false ? "1) Dane na fakturze wymagają korekty" : "1) Dane na fakturze są poprawne",
    list.join("\n"),
    [
      `3) ${CUSTOMS_IMPORTER.name}`,
      `${CUSTOMS_IMPORTER.street}, ${CUSTOMS_IMPORTER.postalCity}`,
      `NIP: ${CUSTOMS_IMPORTER.nip}`,
    ].join("\n"),
  ];
  return blocks.join("\n\n");
}

/** Dokumenty do załączenia: podstawy stawki 8% (bez duplikatów, w kolejności pozycji). */
export function collectVatBasisDocuments(
  lines: readonly { vat: ResolvedLineVat }[]
): CustomsDocumentRef[] {
  const seen = new Set<string>();
  const out: CustomsDocumentRef[] = [];
  for (const { vat } of lines) {
    if (vat.rate !== CUSTOMS_MEDICAL_VAT_RATE || !vat.basisDocument) continue;
    if (seen.has(vat.basisDocument.id)) continue;
    seen.add(vat.basisDocument.id);
    out.push(vat.basisDocument);
  }
  return out;
}

export type CustomsLineState = "confirmed" | "confirmed_changed" | "proposal" | "missing";

/**
 * Stan pozycji w widoku odprawy:
 * - confirmed — karta zatwierdzona i nic się nie zmieniło („Zatwierdzone wcześniej”),
 * - confirmed_changed — karta zatwierdzona, ale dokumenty dostawcy mówią co innego,
 * - proposal — propozycja (AI / skopiowana), czeka na zatwierdzenie,
 * - missing — brak karty, trzeba uzupełnić.
 */
export function customsLineState(card: CustomsProductCard | null, vat: ResolvedLineVat): CustomsLineState {
  if (!card) return "missing";
  if (card.status !== "confirmed") return "proposal";
  return vat.warning ? "confirmed_changed" : "confirmed";
}

/**
 * Kod CN w postaci 8 cyfr (spacje / kropki ignorowane) albo null. Odrzuca działy, których
 * nie ma w Nomenklaturze Scalonej (00, 77 — zarezerwowany, 98–99 — kody krajowe / specjalne).
 */
/** Kod w zapisie taryfy: „8482 10 10” (8 cyfr; inne wartości bez zmian). */
export function formatCnCode(code: string): string {
  return /^\d{8}$/.test(code) ? `${code.slice(0, 4)} ${code.slice(4, 6)} ${code.slice(6)}` : code;
}

export function normalizeCnCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s.]/g, "");
  if (!/^[0-9]{8}$/.test(digits)) return null;
  const chapter = Number(digits.slice(0, 2));
  return chapter >= 1 && chapter <= 97 && chapter !== 77 ? digits : null;
}
