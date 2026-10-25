/**
 * Braki — składy (BOM) tak, jak liczy je Kreator ZD, ale w stanach fizycznych.
 *
 * Silnik Kreatora po „expand” przenosi sprzedaż zestawu „Składamy” na składniki
 * (`sprzedazOkres` zestawu = 0, oryginał w `bom.relocatedSales`), a stan + ZD zestawu
 * dokłada do `dostepne` składników (`bom.contributionCover`). Dla listy „Do ZD” to poprawne,
 * dla sygnału braku już nie: zestaw ze stanem 0 wyglądał na „brak”, choć z części na półce
 * da się go skompletować w Subiekcie, a składnik miał w „dostępne” towar, który jeszcze jedzie.
 *
 * Tu: stan własny karty, osobno to, co da kompletacja (złożenie zestawu z części albo
 * rozłożenie kompletu na składniki), osobno towar w drodze.
 *
 * Jednostki: sztuki karty Subiekta (ilość składnika na zestaw też w sztukach karty).
 */

import type { ZdProductBomRef } from "@/lib/orders/zd-estimate-bom";
import {
  isValidBomPolicyPair,
  normalizeDemandAllocation,
  normalizePurchaseTarget,
} from "@/lib/orders/zd-estimate-bom-policy";
import type { ZdEstimateBomMeta } from "@/lib/orders/zd-estimate-bom";
import type { ZdEstimatePairMeta } from "@/lib/orders/zd-estimate-pairs";
import { resolveSprzedazDziennie } from "@/lib/orders/zd-estimate-sales-track";
import { pairStockPieces } from "@/lib/stock-watch/analysis";
import {
  zdDocumentUnitsToPieces,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-units";

export type StockWatchBomRole = "assembled_parent" | "purchased_kit" | "component";

/** assemble = złóż zestaw z części; disassemble = rozłóż komplet na składniki. */
export type StockWatchAssemblyKind = "assemble" | "disassemble";

export type StockWatchBomLine = {
  tw_Id: number;
  tw_Symbol?: string | null;
  dostepne: number;
  otwarteZd: number;
  sprzedazOkres: number;
  sprzedazDziennie: number;
  bom?: ZdEstimateBomMeta | null;
  pair?: Pick<
    ZdEstimatePairMeta,
    "role" | "unitsPerPack" | "twinTwId" | "partnerMissing" | "coverSzt" | "pieceDostepne" | "packDostepne"
  > | null;
};

export type StockWatchBomContext = {
  byTw: ReadonlyMap<number, StockWatchBomLine>;
  boms: readonly ZdProductBomRef[];
  /** Opakowania z karty (nie nadpisane parą) — przeliczenie otwartych ZD na sztuki karty. */
  packagingByTwId: ReadonlyMap<
    number,
    { unitsPerPackage: number; documentUnitMode?: ZdPackagingDocumentUnitMode | null }
  >;
  dniOkresu: number | null;
  fallbackDniOkresu: number;
};

export type StockWatchAssembly = {
  kind: StockWatchAssemblyKind;
  /** assemble: ile zestawów; disassemble: ile sztuk składnika z kompletów na stanie. */
  qty: number;
  /** Krótko, co i skąd — do podpowiedzi w panelu. */
  note: string;
  /**
   * Czy kompletacja liczy się do pokrycia (dni, status). Przy „Kupujemy komplet i części”
   * Kreator kupuje zestaw osobno, więc to tylko podpowiedź.
   */
  coversDemand: boolean;
  /** Własny stan nie wystarcza, a kompletacja tak — trzeba zrobić dokument w Subiekcie. */
  actionable: boolean;
};

export type StockWatchBomView = {
  /** null = paczka pary bez własnej roli (składnikiem jest jej sztuka). */
  role: StockWatchBomRole | null;
  /** Dostępne z karty, bez wkładu kompletów. */
  availableQty: number;
  /** Otwarte ZD w sztukach karty, z towarem w drodze z kompletów (×ilość). */
  openZdQty: number;
  velocityDaily: number;
  salesPeriodQty: number;
  /** null = jak w Kreatorze (cel z linii). */
  targetQty: number | null;
  assembly: StockWatchAssembly | null;
  /** Zestaw „Składamy” nie trafia na ZD — ryzyko dostawy liczą jego składniki. */
  orderable: boolean;
};

const MAX_DEPTH = 8;

function finite(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function tw(value: unknown): number {
  return Math.trunc(Number(value)) || 0;
}

function round(value: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function componentOwnSales(line: Pick<StockWatchBomLine, "sprzedazOkres" | "bom">): number {
  return Math.max(0, finite(line.sprzedazOkres) - Math.max(0, finite(line.bom?.contributionSales)));
}

function openZdPieces(ctx: StockWatchBomContext, twId: number): number {
  const line = ctx.byTw.get(twId);
  if (!line) return 0;
  const pack = ctx.packagingByTwId.get(twId);
  return zdDocumentUnitsToPieces(
    Math.max(0, finite(line.otwarteZd)),
    pack?.unitsPerPackage,
    pack?.documentUnitMode ?? "packages"
  );
}

/** Stan z karty: `dostepne` po expand ma doliczone pokrycie z kompletów — odejmujemy je. */
function rawAvailableQty(line: Pick<StockWatchBomLine, "dostepne" | "bom">): number {
  const cover = line.bom?.role === "component" ? finite(line.bom.contributionCover) : 0;
  return finite(line.dostepne) - cover;
}

function bomsByParent(boms: readonly ZdProductBomRef[]): Map<number, ZdProductBomRef> {
  const out = new Map<number, ZdProductBomRef>();
  for (const bom of boms) {
    const parent = tw(bom.parentTwId);
    if (parent > 0 && bom.components?.length) out.set(parent, bom);
  }
  return out;
}

type Supply = { now: number; incoming: number; missing: boolean };

/**
 * Ile sztuk karty da się mieć z ręki (now) i po dostawach (incoming), bez zakupu:
 * stan własny + zestawy „Składamy” złożone z części (rekurencyjnie). Sztuka w parze
 * dostaje też kartony partnera × przelicznik.
 */
function supplyOf(
  ctx: StockWatchBomContext,
  parents: ReadonlyMap<number, ZdProductBomRef>,
  twId: number,
  depth: number
): Supply {
  const line = ctx.byTw.get(twId);
  if (!line) return { now: 0, incoming: 0, missing: true };
  let now = rawAvailableQty(line);
  let incoming = openZdPieces(ctx, twId);
  if (line.pair?.role === "piece" && !line.pair.partnerMissing) {
    const pack = ctx.byTw.get(tw(line.pair.twinTwId));
    const ratio = Math.max(1, finite(line.pair.unitsPerPack));
    if (pack) {
      now += rawAvailableQty(pack) * ratio;
      // Jak pokrycie pary w Kreatorze: ZD paczki × przelicznik (bez opakowań karty).
      incoming += Math.max(0, finite(pack.otwarteZd)) * ratio;
    }
  }
  let missing = false;
  if (line.bom?.role === "assembled_parent" && depth < MAX_DEPTH) {
    const nested = buildable(ctx, parents, twId, depth + 1);
    if (nested) {
      now += nested.now;
      incoming += nested.incoming - nested.now;
      missing = nested.missing;
    }
  }
  return { now, incoming: now + incoming, missing };
}

type Buildable = {
  now: number;
  /** Z częściami, które jadą. */
  incoming: number;
  missing: boolean;
  limits: { twId: number; symbol: string; perKit: number; supply: number }[];
};

function buildable(
  ctx: StockWatchBomContext,
  parents: ReadonlyMap<number, ZdProductBomRef>,
  parentTwId: number,
  depth: number
): Buildable | null {
  const bom = parents.get(parentTwId);
  if (!bom) return null;
  let now = Infinity;
  let incoming = Infinity;
  let missing = false;
  const limits: Buildable["limits"] = [];
  for (const comp of bom.components) {
    const cid = tw(comp.componentTwId);
    const perKit = Math.trunc(finite(comp.qtyPerParent));
    if (!(cid > 0) || perKit < 1) continue;
    const supply = supplyOf(ctx, parents, cid, depth);
    if (supply.missing) missing = true;
    now = Math.min(now, Math.floor(Math.max(0, supply.now) / perKit));
    incoming = Math.min(incoming, Math.floor(Math.max(0, supply.incoming) / perKit));
    limits.push({
      twId: cid,
      symbol: String(ctx.byTw.get(cid)?.tw_Symbol ?? "").trim() || `#${cid}`,
      perKit,
      supply: Math.max(0, supply.now),
    });
  }
  if (!Number.isFinite(now)) return null;
  // Brak składnika na liście = nie wiemy, ile jest — bez zgadywania kompletacji.
  if (missing) return { now: 0, incoming: 0, missing, limits };
  return { now, incoming: Math.max(now, incoming), missing, limits };
}

/**
 * Część wspólna kilku zestawów (albo sprzedawana też sama) nie starczy każdemu zestawowi
 * w całości: tempo składnika z Kreatora ma już popyt wszystkich zestawów. Zestaw może liczyć
 * na tyle dni, ile starczy składnika — dni × tempo zestawu.
 */
function capByComponentCover(ctx: StockWatchBomContext, b: Buildable, kitVelocity: number): Buildable {
  if (!(kitVelocity > 0)) return b;
  let cap = Infinity;
  for (const l of b.limits) {
    const comp = ctx.byTw.get(l.twId);
    // Sztuka pary ma tempo 0 (popyt pary na paczce, w sztukach) — tempo bierzemy z paczki.
    const tempoLine =
      comp?.pair?.role === "piece" && !comp.pair.partnerMissing ? ctx.byTw.get(tw(comp.pair.twinTwId)) : comp;
    const compVelocity = Math.max(0, finite(tempoLine?.sprzedazDziennie));
    if (compVelocity > 1e-9) cap = Math.min(cap, (l.supply / compVelocity) * kitVelocity);
  }
  if (!Number.isFinite(cap)) return b;
  // Tolerancja na szum zmiennoprzecinkowy (dni × tempo wraca do pełnej liczby zestawów).
  const now = Math.min(b.now, Math.floor(cap + 1e-6));
  return { ...b, now, incoming: Math.max(now, b.incoming - (b.now - now)) };
}

function buildableNote(b: Buildable): string {
  return b.limits
    .map((l) => `${l.symbol} ×${l.perKit}: ${round(l.supply, 2)} szt`)
    .join(", ")
    .slice(0, 300);
}

type KitCover = {
  stock: number;
  zd: number;
  kits: Set<number>;
  /**
   * Część z kompletów kupowanych (Tylko komplet / Komplet ze sprzedaży składników): ten sam
   * stan zjada sprzedaż kompletu, której składnik nie ma w tempie — tylko podpowiedź.
   */
  separateStock: number;
};

/**
 * Komplety na stanie / w drodze w przeliczeniu na sztuki składnika — jak `contributionCover`
 * w expand (Składamy z „stan zestawu jako pokrycie”), ale z podziałem stan / ZD.
 * Komplety kupowane (Tylko komplet, Komplet ze sprzedaży składników) da się rozłożyć —
 * liczone osobno, bez wpływu na status.
 */
function kitCoverByComponent(ctx: StockWatchBomContext): Map<number, KitCover> {
  const parents = bomsByParent(ctx.boms);
  const out = new Map<number, KitCover>();
  const add = (cid: number, stock: number, zd: number, kit: number, separate: boolean, depth: number) => {
    const host = ctx.byTw.get(cid);
    const nested = parents.get(cid);
    // Zestaw w zestawie („Składamy”) — pokrycie schodzi na jego składniki, jak w expand.
    if (!separate && host?.bom?.role === "assembled_parent" && nested && depth < MAX_DEPTH) {
      for (const c of nested.components) {
        const nid = tw(c.componentTwId);
        const q = Math.trunc(finite(c.qtyPerParent));
        if (nid > 0 && q >= 1) add(nid, stock * q, zd * q, kit, separate, depth + 1);
      }
      return;
    }
    const cur = out.get(cid) ?? { stock: 0, zd: 0, kits: new Set<number>(), separateStock: 0 };
    if (separate) cur.separateStock += stock;
    else {
      cur.stock += stock;
      cur.zd += zd;
    }
    if (stock > 0 || zd > 0) cur.kits.add(kit);
    out.set(cid, cur);
  };
  for (const bom of ctx.boms) {
    const parentId = tw(bom.parentTwId);
    const parent = ctx.byTw.get(parentId);
    if (!parent || !bom.components?.length) continue;
    const allocation = normalizeDemandAllocation(bom.demandAllocation);
    const target = normalizePurchaseTarget(bom.purchaseTarget);
    // Nielegalną parę expand pomija — tu też.
    if (!isValidBomPolicyPair(allocation, target)) continue;
    const explodeCover = allocation === "explode" && bom.stockAsCover !== false;
    const kitSplits = allocation === "separate" && (target === "kit_only" || target === "kit_from_components");
    if (!explodeCover && !kitSplits) continue;
    // Komplet bez własnej sprzedaży (MIX: popyt to tylko kolory) — jego stan to stan kolorów.
    const kitOwnSales =
      target === "kit_from_components"
        ? finite(parent.bom?.kitOwnSales ?? parent.sprzedazOkres)
        : finite(parent.sprzedazOkres);
    const separateOnly = kitSplits && kitOwnSales > 0;
    // Komplet bywa składnikiem innego zestawu — jego `dostepne` ma wtedy doliczone pokrycie.
    const stock = Math.max(0, rawAvailableQty(parent));
    const zd = openZdPieces(ctx, parentId);
    for (const comp of bom.components) {
      const cid = tw(comp.componentTwId);
      const q = Math.trunc(finite(comp.qtyPerParent));
      if (cid > 0 && q >= 1) add(cid, stock * q, zd * q, parentId, separateOnly, 0);
    }
  }
  return out;
}

function kitSymbolsOf(ctx: StockWatchBomContext, cover: KitCover | undefined): string {
  return cover
    ? [...cover.kits]
        .map((id) => String(ctx.byTw.get(id)?.tw_Symbol ?? "").trim() || `#${id}`)
        .join(", ")
        .slice(0, 280)
    : "";
}

function disassembly(
  ctx: StockWatchBomContext,
  cover: KitCover | undefined,
  stock: number,
  separateStock: number,
  ownSales: number
): StockWatchAssembly | null {
  if (stock > 0) {
    return {
      kind: "disassemble",
      qty: round(stock, 3),
      note: `z kompletów: ${kitSymbolsOf(ctx, cover)}`,
      coversDemand: true,
      // Sprzedaż tylko w zestawach: komplet na półce już jest tym towarem — nic do rozkładania.
      actionable: ownSales > 0,
    };
  }
  if (separateStock > 0) {
    return {
      kind: "disassemble",
      qty: round(separateStock, 3),
      note: `z kompletów: ${kitSymbolsOf(ctx, cover)} (komplet ma też własną sprzedaż)`,
      coversDemand: false,
      actionable: false,
    };
  }
  return null;
}

/**
 * Paczka pary, której paczka albo sztuka jest składnikiem: stan pary w sztukach bez wkładu
 * kompletów (inaczej ZD kompletu liczyłoby się jak towar na półce), komplety osobno.
 */
function pairComponentView(
  ctx: StockWatchBomContext,
  kitCover: ReadonlyMap<number, KitCover>,
  pack: StockWatchBomLine
): StockWatchBomView | null {
  const pair = pack.pair!;
  const piece = ctx.byTw.get(tw(pair.twinTwId)) ?? null;
  const ratio = Math.max(1, finite(pair.unitsPerPack));
  const packCover = pack.bom?.role === "component" ? finite(pack.bom.contributionCover) : 0;
  const pieceCover = piece?.bom?.role === "component" ? finite(piece.bom.contributionCover) : 0;
  if (!(packCover > 0) && !(pieceCover > 0) && !kitCover.has(pack.tw_Id) && !(piece && kitCover.has(piece.tw_Id))) {
    return null;
  }
  const withCover = finite(pair.pieceDostepne) + finite(pair.packDostepne) * ratio;
  const availableQty = withCover - packCover * ratio - pieceCover;
  const ownZd = Math.max(0, finite(pair.coverSzt) - withCover);
  const packKit = kitCover.get(pack.tw_Id);
  const pieceKit = piece ? kitCover.get(piece.tw_Id) : undefined;
  const kitStock = (packKit?.stock ?? 0) * ratio + (pieceKit?.stock ?? 0);
  const kitZd = (packKit?.zd ?? 0) * ratio + (pieceKit?.zd ?? 0);
  const separateStock = (packKit?.separateStock ?? 0) * ratio + (pieceKit?.separateStock ?? 0);
  const ownSales =
    Math.max(0, finite(pack.sprzedazOkres)) -
    Math.max(0, finite(pack.bom?.contributionSales)) * ratio -
    Math.max(0, finite(piece?.bom?.contributionSales));
  const cover: KitCover = {
    stock: kitStock,
    zd: kitZd,
    separateStock,
    kits: new Set([...(packKit?.kits ?? []), ...(pieceKit?.kits ?? [])]),
  };
  return {
    role: pack.bom?.role ?? null,
    availableQty,
    openZdQty: round(ownZd + kitZd, 3),
    velocityDaily: Math.max(0, finite(pack.sprzedazDziennie)),
    salesPeriodQty: Math.max(0, finite(pack.sprzedazOkres)),
    targetQty: null,
    assembly: disassembly(ctx, cover, kitStock, separateStock, ownSales),
    orderable: true,
  };
}

/** Widok wszystkich linii z rolą w składzie; reszta (bez BOM) nie trafia do mapy. */
export function resolveStockWatchBomViews(ctx: StockWatchBomContext): Map<number, StockWatchBomView> {
  const out = new Map<number, StockWatchBomView>();
  if (!ctx.boms.length) return out;
  const parents = bomsByParent(ctx.boms);
  const kitCover = kitCoverByComponent(ctx);

  for (const line of ctx.byTw.values()) {
    // Para przed rolą: składnikiem bywa tylko sztuka, a stan liczy wiersz paczki.
    if (line.pair && !line.pair.partnerMissing) {
      if (line.pair.role === "pack") {
        const view = pairComponentView(ctx, kitCover, line);
        if (view) out.set(line.tw_Id, view);
      } else if (line.bom?.role === "component") {
        // Sztuka pary: popyt na paczce; tu tylko stan karty bez wkładu kompletów.
        out.set(line.tw_Id, {
          role: "component",
          availableQty: rawAvailableQty(line),
          openZdQty: round(openZdPieces(ctx, line.tw_Id), 3),
          velocityDaily: 0,
          salesPeriodQty: 0,
          targetQty: 0,
          assembly: null,
          orderable: false,
        });
      }
      continue;
    }
    const role = line.bom?.role;
    if (!role) continue;
    const ownAvailable = rawAvailableQty(line);
    const ownZd = openZdPieces(ctx, line.tw_Id);
    const baseVelocity = Math.max(0, finite(line.sprzedazDziennie));

    if (role === "assembled_parent") {
      const sales = Math.max(0, finite(line.bom?.relocatedSales));
      const velocity = resolveSprzedazDziennie({
        sprzedazOkres: sales,
        sprzedazDziennie: 0,
        dniOkresu: ctx.dniOkresu,
        fallbackDniOkresu: ctx.fallbackDniOkresu,
      });
      const b = buildable(ctx, parents, line.tw_Id, 0);
      const fromParts = b && !b.missing ? capByComponentCover(ctx, b, velocity) : null;
      out.set(line.tw_Id, {
        role,
        availableQty: ownAvailable,
        openZdQty: round(ownZd + (fromParts ? fromParts.incoming - fromParts.now : 0), 3),
        velocityDaily: velocity,
        salesPeriodQty: sales,
        // Zestawu nie trzymamy na zapas — Kreator liczy cel na składnikach.
        targetQty: 0,
        assembly:
          fromParts && fromParts.now > 0
            ? { kind: "assemble", qty: fromParts.now, note: buildableNote(fromParts), coversDemand: true, actionable: true }
            : null,
        orderable: false,
      });
      continue;
    }

    if (role === "purchased_kit") {
      const bom = parents.get(line.tw_Id);
      const target = normalizePurchaseTarget(bom?.purchaseTarget);
      // Kupujemy komplet i części — zestaw da się też złożyć z części (podpowiedź).
      const b = target === "as_sold" ? buildable(ctx, parents, line.tw_Id, 0) : null;
      out.set(line.tw_Id, {
        role,
        availableQty: ownAvailable,
        openZdQty: round(ownZd, 3),
        velocityDaily: baseVelocity,
        salesPeriodQty: Math.max(0, finite(line.sprzedazOkres)),
        targetQty: null,
        assembly:
          b && !b.missing && b.now > 0
            ? { kind: "assemble", qty: b.now, note: buildableNote(b), coversDemand: false, actionable: false }
            : null,
        orderable: true,
      });
      continue;
    }

    // Składnik.
    const cover = kitCover.get(line.tw_Id);
    out.set(line.tw_Id, {
      role,
      availableQty: ownAvailable,
      openZdQty: round(ownZd + (cover?.zd ?? 0), 3),
      velocityDaily: baseVelocity,
      salesPeriodQty: Math.max(0, finite(line.sprzedazOkres)),
      targetQty: null,
      assembly: disassembly(ctx, cover, cover?.stock ?? 0, cover?.separateStock ?? 0, componentOwnSales(line)),
      // Zablokowany składnik (Tylko komplet / MIX) zamawia się kompletem — bez ryzyka dostawy.
      orderable: !(line.bom?.purchaseBlocked && !(finite(line.bom?.contributionSales) > 0)),
    });
  }
  return out;
}

export type StockWatchLineFigures = {
  availableQty: number;
  openZdQty: number;
  velocityDaily: number;
  salesPeriodQty: number;
  targetQty: number;
  assembly: StockWatchAssembly | null;
  /** Zestaw „Składamy” nie idzie na ZD — bez ryzyka dostawy (liczą je składniki). */
  orderable: boolean;
  bomRole: StockWatchBomRole | null;
};

/**
 * Liczby wiersza Braków z linii Kreatora: para paczka↔sztuka (sztuki pary na paczce),
 * skład (stan karty + kompletacja osobno), reszta wprost z linii.
 */
export function resolveStockWatchLineFigures(
  line: StockWatchBomLine & {
    celZapasuTracked: number;
    pair?: (StockWatchBomLine["pair"] & { coverSzt: number; pieceDostepne: number; packDostepne: number }) | null;
  },
  bomView: StockWatchBomView | null,
  cardPack: { unitsPerPackage: number; documentUnitMode?: ZdPackagingDocumentUnitMode | null } | null
): StockWatchLineFigures {
  const pairStock = bomView ? null : pairStockPieces(line.pair);
  if (pairStock) {
    return {
      ...pairStock,
      velocityDaily: Math.max(0, finite(line.sprzedazDziennie)),
      salesPeriodQty: finite(line.sprzedazOkres),
      targetQty: finite(line.celZapasuTracked),
      assembly: null,
      orderable: true,
      bomRole: line.bom?.role ?? null,
    };
  }
  if (bomView) {
    return {
      availableQty: bomView.availableQty,
      openZdQty: bomView.openZdQty,
      velocityDaily: Math.max(0, bomView.velocityDaily),
      salesPeriodQty: bomView.salesPeriodQty,
      targetQty: bomView.targetQty ?? finite(line.celZapasuTracked),
      assembly: bomView.assembly,
      orderable: bomView.orderable,
      bomRole: bomView.role,
    };
  }
  return {
    availableQty: finite(line.dostepne),
    openZdQty: zdDocumentUnitsToPieces(
      Math.max(0, finite(line.otwarteZd)),
      cardPack?.unitsPerPackage,
      cardPack?.documentUnitMode ?? "packages"
    ),
    velocityDaily: Math.max(0, finite(line.sprzedazDziennie)),
    salesPeriodQty: finite(line.sprzedazOkres),
    targetQty: finite(line.celZapasuTracked),
    assembly: null,
    orderable: true,
    bomRole: line.bom?.role ?? null,
  };
}
