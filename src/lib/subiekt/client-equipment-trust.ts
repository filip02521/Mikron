import {
  labelWords,
  parseInvoiceSerialNotesFull,
  type ClientEquipmentItem,
  type InvoiceForEquipment,
  type InvoiceLine,
  type InvoiceRepairRef,
} from "@/lib/subiekt/client-equipment-parse";

/**
 * Zaufana lista sprzętu klienta (karta „Sprzęt klienta”). Pozycja trafia na listę tylko wtedy, gdy wynika
 * jednoznacznie z dokumentu i decyzji serwisu — nigdy z ceny ani z domysłu:
 *
 * 1. Model jest urządzeniem tylko po decyzji człowieka (`deviceModel`: true — katalog serwisu albo „Tak”, false — „Nie”,
 *    null — nie wiadomo). Subiekt nie odróżnia urządzenia od materiału.
 * 2. Numer seryjny należy do pozycji, gdy uwagi wskazują ją wprost („1. SN”, „Poz 4”, „lampa s/n:”) albo gdy na dokumencie
 *    jest dokładnie jedna pozycja, która może być urządzeniem. Inaczej pytamy, do którego sprzętu należy.
 * 3. Wskazana pozycja, która nie może być urządzeniem (pomyłka w numeracji), nie przenosi numeru na inną — pytamy.
 * 4. Urządzenie bez numeru na dokumencie: tylko model potwierdzony jako urządzenie.
 */

export type DeviceModelDecision = boolean | null;

export type TrustInputs = {
  /** true — urządzenie (katalog serwisu albo „Tak”), false — „Nie, to nie sprzęt”, null — nikt nie zdecydował. */
  deviceModel: (twId: number) => DeviceModelDecision;
  /** Decyzja „ten numer należy do…”: towar, null — do żadnej pozycji, undefined — brak decyzji. */
  assignment: (docId: number, serialKey: string) => number | null | undefined;
  /** Pozycja, która w ogóle może być urządzeniem: nie część serwisowa, nie usługa, nie za grosze. */
  canBeDevice: (line: InvoiceLine) => boolean;
};

export type TrustedEquipmentItem = ClientEquipmentItem & {
  /** Ilość na pozycji dokumentu sprzedaży — do porównania z korektą. */
  lineQuantity: number;
};

export type PendingCandidate = { twId: number; symbol: string | null; name: string; unitPrice: number | null; known: boolean };

export type PendingEquipment =
  /** Numer wskazuje jedną pozycję, ale nikt nie zdecydował, czy ten model to urządzenie. */
  | { kind: "model"; item: TrustedEquipmentItem }
  /** Numer mógł należeć do kilku pozycji — serwisant wskazuje, do której (albo „do żadnej”). */
  | {
      kind: "serial";
      serial: string;
      serialKey: string;
      docId: number;
      invoiceNumber: string;
      invoiceDate: string | null;
      candidates: PendingCandidate[];
      /** Uwagi wskazały pozycję, która nie jest urządzeniem (pomyłka w numeracji). */
      misplaced: boolean;
    }
  /** Korekta albo zwrot zmniejszyły ilość urządzenia z numerami — nie wiadomo, który egzemplarz wrócił. */
  | { kind: "correction"; item: TrustedEquipmentItem; remaining: number };

export type TrustResult = { trusted: TrustedEquipmentItem[]; pending: PendingEquipment[]; repairs: InvoiceRepairRef[] };

export const serialKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const lineTwId = (l: InvoiceLine) => Math.trunc(Number(l.ob_TowId));
const linePrice = (l: InvoiceLine) => Number(l.ob_CenaNetto ?? l.ob_CenaBrutto ?? 0) || null;
const lineQty = (l: InvoiceLine) => Math.max(0, Math.round(Number(l.ob_Ilosc ?? 0)));

type Claim = { serials: string[]; targets: number[]; explicit: boolean };

/** Numery z uwag jako „roszczenia” do pozycji: wskazane wprost albo do dowolnej pozycji dokumentu. */
function claimsOf(doc: InvoiceForEquipment, lines: readonly InvoiceLine[]): Claim[] {
  const notes = parseInvoiceSerialNotesFull(doc.dok_Uwagi);
  const all = lines.map((_, i) => i + 1);
  const claims: Claim[] = [];
  for (const [no, sns] of notes.byPosition) claims.push({ serials: sns, targets: [no], explicit: true });
  for (const r of notes.ranges) claims.push({ serials: r.serials, targets: all.filter((no) => no >= r.from && no <= r.to), explicit: true });
  for (const l of notes.labeled) {
    const words = labelWords(l.label);
    const named = all.filter((no) => {
      const name = `${lines[no - 1]!.tw_Nazwa ?? ""} ${lines[no - 1]!.tw_Symbol ?? ""}`.toLocaleLowerCase("pl-PL");
      return words.some((w) => name.includes(w));
    });
    claims.push(named.length ? { serials: l.serials, targets: named, explicit: true } : { serials: l.serials, targets: all, explicit: false });
  }
  if (notes.loose.length) claims.push({ serials: notes.loose, targets: all, explicit: false });
  return claims;
}

/** Jeden dokument sprzedaży → pewny sprzęt, pytania do serwisanta i numery z faktur za naprawę. */
export function classifyInvoiceEquipment(doc: InvoiceForEquipment, inputs: TrustInputs): TrustResult {
  const lines = [...(doc.dok_Pozycja ?? [])].sort((a, b) => Number(a.ob_Id ?? 0) - Number(b.ob_Id ?? 0));
  const invoiceNumber = doc.dok_NrPelny?.trim() || `FS ${doc.dok_Id}`;
  const invoiceDate = doc.dok_DataWyst ? String(doc.dok_DataWyst).slice(0, 10) : null;
  // Pozycja, która może być urządzeniem: przechodzi sito i nikt nie powiedział „to nie sprzęt”.
  const candidate = (no: number) => {
    const l = lines[no - 1];
    return !!l && lineTwId(l) > 0 && inputs.canBeDevice(l) && inputs.deviceModel(lineTwId(l)) !== false;
  };
  const allCandidates = lines.map((_, i) => i + 1).filter(candidate);
  const trustedSerials = new Map<number, string[]>();
  const modelPending = new Map<number, string[]>();
  /** Pozycje, do których może należeć numer bez rozstrzygnięcia — nie liczymy ich jako „bez numeru”. */
  const contested = new Set<number>();
  const pending: PendingEquipment[] = [];
  const repairs: InvoiceRepairRef[] = [];
  const add = (into: Map<number, string[]>, no: number, sns: string[]) => into.set(no, [...(into.get(no) ?? []), ...sns]);
  const toCandidate = (no: number): PendingCandidate => {
    const l = lines[no - 1]!;
    return {
      twId: lineTwId(l),
      symbol: l.tw_Symbol?.trim() || null,
      name: l.tw_Nazwa?.trim() || l.tw_Symbol?.trim() || `Towar ${lineTwId(l)}`,
      unitPrice: linePrice(l),
      known: inputs.deviceModel(lineTwId(l)) === true,
    };
  };

  for (const claim of claimsOf(doc, lines)) {
    // Decyzja serwisanta dla numeru ma pierwszeństwo przed uwagami.
    const open: string[] = [];
    for (const sn of claim.serials) {
      const decided = inputs.assignment(doc.dok_Id, serialKey(sn));
      if (decided === undefined) open.push(sn);
      else if (decided !== null) {
        const no = lines.findIndex((l) => lineTwId(l) === decided) + 1;
        if (no > 0) add(trustedSerials, no, [sn]);
      }
    }
    if (!open.length) continue;
    const direct = claim.targets.filter(candidate);
    if (direct.length === 1 && (claim.explicit || allCandidates.length === 1)) {
      const no = direct[0]!;
      add(inputs.deviceModel(lineTwId(lines[no - 1]!)) === true ? trustedSerials : modelPending, no, open);
      continue;
    }
    // Wskazana pozycja nie może być urządzeniem (pomyłka w numeracji) albo kilka pozycji pasuje — pytamy o każdy numer.
    const misplaced = claim.explicit && direct.length === 0;
    const options = direct.length ? direct : allCandidates;
    if (!options.length) {
      for (const sn of open) repairs.push({ serial: sn, invoiceId: doc.dok_Id, invoiceNumber, invoiceDate });
      continue;
    }
    for (const no of options) contested.add(no);
    const candidates = options
      .map(toCandidate)
      .sort((a, b) => Number(b.known) - Number(a.known) || (b.unitPrice ?? 0) - (a.unitPrice ?? 0));
    for (const sn of open)
      pending.push({ kind: "serial", serial: sn, serialKey: serialKey(sn), docId: doc.dok_Id, invoiceNumber, invoiceDate, candidates, misplaced });
  }

  const itemFor = (no: number, serials: string[]): TrustedEquipmentItem => {
    const l = lines[no - 1]!;
    return {
      twId: lineTwId(l),
      symbol: l.tw_Symbol?.trim() || null,
      name: l.tw_Nazwa?.trim() || l.tw_Symbol?.trim() || `Towar ${lineTwId(l)}`,
      serials: [...new Set(serials)],
      invoiceId: doc.dok_Id,
      invoiceNumber,
      invoiceDate,
      unitPrice: linePrice(l),
      lineQuantity: lineQty(l),
    };
  };
  const trusted: TrustedEquipmentItem[] = [...trustedSerials].map(([no, sns]) => itemFor(no, sns));
  for (const [no, sns] of modelPending) pending.push({ kind: "model", item: itemFor(no, sns) });
  // Urządzenie bez numeru: model potwierdzony, pozycja bez żadnego numeru i nie jest kandydatem nierozstrzygniętego numeru.
  for (const no of allCandidates) {
    const l = lines[no - 1]!;
    if (inputs.deviceModel(lineTwId(l)) !== true || trustedSerials.has(no) || modelPending.has(no) || contested.has(no) || lineQty(l) <= 0) continue;
    trusted.push({ ...itemFor(no, []), quantity: lineQty(l) });
  }
  return { trusted, pending, repairs };
}

/** Ilość po korekcie (KFS) albo po zwrocie (ZW) dla pozycji dokumentu: docId → (tw_Id → sztuki, które zostały u klienta). */
export type FinalQuantities = ReadonlyMap<number, ReadonlyMap<number, number>>;

/**
 * Korekty i zwroty: urządzenie oddane w całości znika z listy; bez numeru — ilość po korekcie; z numerami i zwrotem
 * części sztuk — do wyjaśnienia (nie wiadomo, który egzemplarz wrócił).
 */
export function applyCorrections(
  trusted: readonly TrustedEquipmentItem[],
  finals: FinalQuantities
): { trusted: TrustedEquipmentItem[]; pending: PendingEquipment[]; returned: number } {
  const out: TrustedEquipmentItem[] = [];
  const pending: PendingEquipment[] = [];
  let returned = 0;
  for (const it of trusted) {
    const left = finals.get(it.invoiceId)?.get(it.twId);
    // Zostało tyle sztuk, ile numerów (zwrócony egzemplarz oznaczony jako „wrócił”) — lista znów jest pewna.
    if (left == null || left >= it.lineQuantity || (it.serials.length > 0 && it.serials.length <= left)) {
      out.push(it);
      continue;
    }
    if (left <= 0) {
      returned++;
      continue;
    }
    if (!it.serials.length) out.push({ ...it, quantity: Math.min(it.quantity ?? left, left) });
    else pending.push({ kind: "correction", item: it, remaining: left });
  }
  return { trusted: out, pending, returned };
}
