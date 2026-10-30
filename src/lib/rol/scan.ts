/**
 * Skan miesiąca dla zgłoszeń ROL do Ivoclara (docs/plans/rol-ivoclar-zgloszenia.md §5).
 * Reguły czyste (przypisanie FS do klienta, pozycje Ivoclar, odjęcie KFS, odcisk wyniku),
 * odczyt Subiekta wstrzykiwany (`RolScanDeps`) — testy działają na zmyślonych dokumentach.
 */
import { createHash } from "node:crypto";
import { mapPool } from "@/lib/async/map-pool";
import type { SubiektDocument, SubiektListEnvelope, SubiektListParams } from "@/lib/subiekt/types";
import { ROL_CONFLICT_REASON } from "./constants";

/** dok_Typ faktury korygującej sprzedaż (jak w `subiekt-sales-corrections.ts`). */
const DOC_TYPE_KFS = 6;
/** API zwraca maks. 200 wierszy na stronę, a `totalPages` liczy od żądanego rozmiaru. */
const PAGE_SIZE = 200;

export { ROL_CONFLICT_REASON };

export type RolProgramScope = {
  id: string;
  khIds: readonly number[];
  activeFrom: string;
  activeTo: string | null;
};

export type RolFsHeader = {
  id: number;
  nr: string;
  date: string | null;
  platnikId: number | null;
  odbiorcaId: number | null;
};

export type RolDocLine = { twId: number; symbol: string; name: string; qty: number };

export type RolKfs = RolFsHeader & {
  /** FS, którą koryguje KFS (gdy API ją podaje); null → dopasowanie po dacie. */
  correctedFsId: number | null;
  lines: RolDocLine[];
};

export type RolDraftInvoice = {
  fsDokId: number;
  fsNr: string;
  fsDate: string | null;
  otherLinesCount: number;
  kfsDokIds: number[];
  excluded: boolean;
  excludedReason: string;
};

export type RolDraftLine = {
  fsDokId: number;
  twId: number;
  symbol: string;
  ivoclarCatalogNo: string | null;
  name: string;
  qtyFs: number;
  qtyKfs: number;
};

export type RolBatchDraft = {
  programId: string;
  status: "wykryte" | "brak_zakupow";
  invoices: RolDraftInvoice[];
  lines: RolDraftLine[];
  contentHash: string;
};

export type RolScanResult = {
  period: string;
  /** Wszystkie FS z miesiąca, które skan przejrzał. */
  fsChecked: number;
  drafts: RolBatchDraft[];
};

/** `YYYY-MM-01` miesiąca przed `todayKey` (`YYYY-MM-DD`). */
export function previousMonthPeriod(todayKey: string): string {
  const [y, m] = todayKey.split("-").map(Number) as [number, number];
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}-01`;
}

/** Zakres dat wystawienia FS dla miesiąca `period` (`YYYY-MM-01`). */
export function rolPeriodRange(period: string): { dataOd: string; dataDo: string } {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { dataOd: period, dataDo: `${period.slice(0, 8)}${String(last).padStart(2, "0")}` };
}

export function isRolPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value);
}

/** Program obowiązuje, gdy jego okres aktywności zachodzi na zgłaszany miesiąc. */
export function programActiveInPeriod(program: Pick<RolProgramScope, "activeFrom" | "activeTo">, period: string): boolean {
  const { dataOd, dataDo } = rolPeriodRange(period);
  return program.activeFrom <= dataDo && (program.activeTo === null || program.activeTo >= dataOd);
}

/** Numer katalogowy Ivoclar = 6-cyfrowy symbol towaru (wzór arkusza z 09.2026); inaczej brak. */
export function ivoclarCatalogNo(symbol: string): string | null {
  const s = symbol.trim();
  return /^\d{6}$/.test(s) ? s : null;
}

const toId = (v: unknown): number | null => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function fsHeaderFromDocument(d: SubiektDocument): RolFsHeader | null {
  const id = toId(d.dok_Id);
  if (!id) return null;
  return {
    id,
    nr: String(d.dok_NrPelny ?? "").trim() || `FS/${id}`,
    date: String(d.dok_DataWyst ?? "").slice(0, 10) || null,
    platnikId: toId(d.dok_PlatnikId),
    odbiorcaId: toId(d.dok_OdbiorcaId),
  };
}

export function docLinesFromDocument(d: SubiektDocument): RolDocLine[] {
  const out: RolDocLine[] = [];
  for (const p of d.dok_Pozycja ?? []) {
    const twId = toId(p.ob_TowId);
    const qty = Math.abs(Number(p.ob_Ilosc) || 0);
    if (!twId || !(qty > 0)) continue;
    out.push({ twId, symbol: String(p.tw_Symbol ?? "").trim(), name: String(p.tw_Nazwa ?? "").trim(), qty });
  }
  return out;
}

/** Programy, do których należy dokument (po płatniku albo odbiorcy). */
function programsOf(doc: Pick<RolFsHeader, "platnikId" | "odbiorcaId">, programs: readonly RolProgramScope[]): string[] {
  return programs
    .filter((p) => [doc.platnikId, doc.odbiorcaId].some((kh) => kh !== null && p.khIds.includes(kh)))
    .map((p) => p.id);
}

/** FS przypisane do programów; FS pasująca do kilku trafia do `conflicts`. */
export function assignFsToPrograms(
  headers: readonly RolFsHeader[],
  programs: readonly RolProgramScope[]
): { byProgram: Map<string, RolFsHeader[]>; conflicts: Array<{ fs: RolFsHeader; programIds: string[] }> } {
  const byProgram = new Map<string, RolFsHeader[]>(programs.map((p) => [p.id, []]));
  const conflicts: Array<{ fs: RolFsHeader; programIds: string[] }> = [];
  for (const fs of headers) {
    const ids = programsOf(fs, programs);
    if (ids.length === 1) byProgram.get(ids[0]!)!.push(fs);
    else if (ids.length > 1) conflicts.push({ fs, programIds: ids });
  }
  return { byProgram, conflicts };
}

function hashDraft(invoices: readonly RolDraftInvoice[], lines: readonly RolDraftLine[]): string {
  const canon = JSON.stringify({
    i: invoices.map((i) => [i.fsDokId, i.excluded ? 1 : 0, i.kfsDokIds]),
    l: lines.map((l) => [l.fsDokId, l.twId, l.qtyFs, l.qtyKfs]),
  });
  return createHash("sha256").update(canon).digest("hex").slice(0, 16);
}

/**
 * Paczka jednego klienta: pozycje Ivoclar z jego FS, minus KFS.
 * KFS ze wskazaną FS odejmuje się od tej FS; bez wskazania — tylko KFS z tego miesiąca,
 * od najpóźniejszych FS z tym towarem. Odjęcie nigdy nie schodzi poniżej zera.
 */
export function buildBatchDraft(input: {
  programId: string;
  period: string;
  fs: ReadonlyArray<{ header: RolFsHeader; lines: readonly RolDocLine[]; conflict?: boolean }>;
  kfs: readonly RolKfs[];
  isIvoclar: (twId: number) => boolean;
}): RolBatchDraft {
  const { dataOd, dataDo } = rolPeriodRange(input.period);
  const sorted = [...input.fs].sort(
    (a, b) => String(a.header.date).localeCompare(String(b.header.date)) || a.header.id - b.header.id
  );
  const invoices: RolDraftInvoice[] = [];
  const lines: RolDraftLine[] = [];
  for (const { header, lines: docLines, conflict } of sorted) {
    const own = docLines.filter((l) => input.isIvoclar(l.twId));
    // Ta sama pozycja może być na FS kilka razy (np. dwie partie) — łączymy po towarze.
    const byTw = new Map<number, RolDraftLine>();
    for (const l of own) {
      const prev = byTw.get(l.twId);
      if (prev) prev.qtyFs += l.qty;
      else
        byTw.set(l.twId, {
          fsDokId: header.id,
          twId: l.twId,
          symbol: l.symbol,
          ivoclarCatalogNo: ivoclarCatalogNo(l.symbol),
          name: l.name,
          qtyFs: l.qty,
          qtyKfs: 0,
        });
    }
    // FS bez towarów Ivoclar nie wchodzi do paczki (to nie jest zakup do zgłoszenia).
    if (byTw.size === 0) continue;
    invoices.push({
      fsDokId: header.id,
      fsNr: header.nr,
      fsDate: header.date,
      otherLinesCount: docLines.length - own.length,
      kfsDokIds: [],
      excluded: Boolean(conflict),
      excludedReason: conflict ? ROL_CONFLICT_REASON : "",
    });
    lines.push(...byTw.values());
  }

  const invoiceById = new Map(invoices.map((i) => [i.fsDokId, i]));
  for (const k of input.kfs) {
    const target = k.correctedFsId !== null ? invoiceById.get(k.correctedFsId) : undefined;
    const inPeriod = k.date !== null && k.date >= dataOd && k.date <= dataDo;
    if (k.correctedFsId !== null && !target) continue; // koryguje FS spoza paczki
    if (!target && !inPeriod) continue;
    for (const kl of k.lines) {
      let left = kl.qty;
      const candidates = lines
        .filter((l) => l.twId === kl.twId && (!target || l.fsDokId === target.fsDokId))
        .reverse();
      for (const l of candidates) {
        const take = Math.min(left, l.qtyFs - l.qtyKfs);
        if (take > 0) {
          l.qtyKfs += take;
          left -= take;
          const inv = invoiceById.get(l.fsDokId)!;
          if (!inv.kfsDokIds.includes(k.id)) inv.kfsDokIds.push(k.id);
        }
        if (left <= 0) break;
      }
    }
  }

  const active = lines.some((l) => l.qtyFs - l.qtyKfs > 0);
  return {
    programId: input.programId,
    status: active ? "wykryte" : "brak_zakupow",
    invoices,
    lines,
    contentHash: hashDraft(invoices, lines),
  };
}

export type RolScanDeps = {
  listFs: (params: SubiektListParams) => Promise<SubiektListEnvelope<SubiektDocument>>;
  getFs: (id: number) => Promise<SubiektDocument>;
  listDocuments: (params: SubiektListParams) => Promise<SubiektListEnvelope<SubiektDocument>>;
  getDocument: (id: number) => Promise<SubiektDocument>;
  loadIvoclarTwIds: () => Promise<ReadonlySet<number>>;
};

/** Wszystkie strony listy; błąd dowolnej strony przerywa skan (bez wyniku częściowego). */
async function listAllPages(
  list: RolScanDeps["listFs"],
  params: SubiektListParams
): Promise<SubiektDocument[]> {
  const out: SubiektDocument[] = [];
  let page = 1;
  let totalPages: number;
  do {
    const res = await list({ ...params, page, pageSize: PAGE_SIZE });
    out.push(...(res.data ?? []));
    totalPages = Math.max(1, Math.trunc(Number(res.pagination?.totalPages) || 1));
    page += 1;
  } while (page <= totalPages);
  return out;
}

/**
 * Skan miesiąca `period` dla programów aktywnych w tym miesiącu. KFS czytamy do `todayKey`,
 * bo korekty do FS z miesiąca bywają wystawiane później.
 */
export async function scanRolPeriod(
  deps: RolScanDeps,
  input: { period: string; todayKey: string; programs: readonly RolProgramScope[] }
): Promise<RolScanResult> {
  if (!isRolPeriod(input.period)) throw new Error("Nieprawidłowy miesiąc zgłoszenia.");
  const programs = input.programs.filter((p) => programActiveInPeriod(p, input.period));
  const { dataOd, dataDo } = rolPeriodRange(input.period);

  const [fsDocs, ivoclar] = await Promise.all([listAllPages(deps.listFs, { dataOd, dataDo }), deps.loadIvoclarTwIds()]);
  if (ivoclar.size === 0) throw new Error("Pusty zakres towarów Ivoclar — skan nie rozpozna pozycji.");
  const headers = fsDocs.map(fsHeaderFromDocument).filter((h): h is RolFsHeader => h !== null);
  const { byProgram, conflicts } = assignFsToPrograms(headers, programs);

  const matched = [...new Map([...byProgram.values(), ...conflicts.map((c) => [c.fs])].flat().map((h) => [h.id, h])).values()];
  const details = await mapPool(matched, 3, async (h) => [h.id, docLinesFromDocument(await deps.getFs(h.id))] as const);
  const linesByFs = new Map(details);

  const kfsHeaders = (await listAllPages(deps.listDocuments, { typ: DOC_TYPE_KFS, dataOd, dataDo: input.todayKey }))
    .map((d) => ({ doc: d, header: fsHeaderFromDocument(d) }))
    .filter((k): k is { doc: SubiektDocument; header: RolFsHeader } => k.header !== null && programsOf(k.header, programs).length > 0);
  const kfs: Array<RolKfs & { programIds: string[] }> = await mapPool(kfsHeaders, 3, async ({ doc, header }) => {
    const full = await deps.getDocument(header.id);
    // KFS wskazuje korygowaną FS w `dok_DoDokId` (sprawdzone na LIVE 29.10.2026).
    const corrected = toId(full.dok_DoDokId ?? doc.dok_DoDokId);
    return { ...header, correctedFsId: corrected, lines: docLinesFromDocument(full), programIds: programsOf(header, programs) };
  });

  const drafts = programs.map((p) =>
    buildBatchDraft({
      programId: p.id,
      period: input.period,
      fs: [
        ...(byProgram.get(p.id) ?? []).map((header) => ({ header, lines: linesByFs.get(header.id) ?? [] })),
        ...conflicts
          .filter((c) => c.programIds.includes(p.id))
          .map((c) => ({ header: c.fs, lines: linesByFs.get(c.fs.id) ?? [], conflict: true })),
      ],
      kfs: kfs.filter((k) => k.programIds.includes(p.id)),
      isIvoclar: (tw) => ivoclar.has(tw),
    })
  );
  return { period: input.period, fsChecked: headers.length, drafts };
}
