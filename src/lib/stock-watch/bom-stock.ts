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
import { normalizeDemandAllocation, normalizePurchaseTarget } from "@/lib/orders/zd-estimate-bom-policy";
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
  pair?: Pick<ZdEstimatePairMeta, "role" | "unitsPerPack" | "twinTwId" | "partnerMissing"> | null;
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
  role: StockWatchBomRole;
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
      incoming += openZdPieces(ctx, pack.tw_Id) * ratio;
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

function buildableNote(b: Buildable): string {
  return b.limits
    .map((l) => `${l.symbol} ×${l.perKit}: ${round(l.supply, 2)} szt`)
    .join(", ")
    .slice(0, 300);
}

type KitCover = { stock: number; zd: number; kits: Set<number> };

/**
 * Komplety na stanie / w drodze w przeliczeniu na sztuki składnika — jak `contributionCover`
 * w expand (Składamy z „stan zestawu jako pokrycie”), ale z podziałem stan / ZD.
 * Dla kompletów kupowanych (Tylko komplet, Komplet ze sprzedaży składników) składniki
 * powstają z rozłożenia kompletu, więc też się liczą.
 */
function kitCoverByComponent(ctx: StockWatchBomContext): Map<number, KitCover> {
  const parents = bomsByParent(ctx.boms);
  const out = new Map<number, KitCover>();
  const add = (cid: number, stock: number, zd: number, kit: number, depth: number) => {
    const host = ctx.byTw.get(cid);
    const nested = parents.get(cid);
    // Zestaw w zestawie („Składamy”) — pokrycie schodzi na jego składniki, jak w expand.
    if (host?.bom?.role === "assembled_parent" && nested && depth < MAX_DEPTH) {
      for (const c of nested.components) {
        const nid = tw(c.componentTwId);
        const q = Math.trunc(finite(c.qtyPerParent));
        if (nid > 0 && q >= 1) add(nid, stock * q, zd * q, kit, depth + 1);
      }
      return;
    }
    const cur = out.get(cid) ?? { stock: 0, zd: 0, kits: new Set<number>() };
    cur.stock += stock;
    cur.zd += zd;
    cur.kits.add(kit);
    out.set(cid, cur);
  };
  for (const bom of ctx.boms) {
    const parentId = tw(bom.parentTwId);
    const parent = ctx.byTw.get(parentId);
    if (!parent || !bom.components?.length) continue;
    const allocation = normalizeDemandAllocation(bom.demandAllocation);
    const target = normalizePurchaseTarget(bom.purchaseTarget);
    const explodeCover = allocation === "explode" && bom.stockAsCover !== false;
    const kitSplits = allocation === "separate" && (target === "kit_only" || target === "kit_from_components");
    if (!explodeCover && !kitSplits) continue;
    const stock = Math.max(0, finite(parent.dostepne));
    const zd = openZdPieces(ctx, parentId);
    for (const comp of bom.components) {
      const cid = tw(comp.componentTwId);
      const q = Math.trunc(finite(comp.qtyPerParent));
      if (cid > 0 && q >= 1) add(cid, stock * q, zd * q, parentId, 0);
    }
  }
  return out;
}

/** Widok wszystkich linii z rolą w składzie; reszta (bez BOM) nie trafia do mapy. */
export function resolveStockWatchBomViews(ctx: StockWatchBomContext): Map<number, StockWatchBomView> {
  const out = new Map<number, StockWatchBomView>();
  if (!ctx.boms.length) return out;
  const parents = bomsByParent(ctx.boms);
  const kitCover = kitCoverByComponent(ctx);

  for (const line of ctx.byTw.values()) {
    const role = line.bom?.role;
    if (!role) continue;
    // Para paczka↔sztuka ma własne liczenie w sztukach (pairStockPieces) — zostaje.
    if (line.pair && !line.pair.partnerMissing) continue;
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
      const fromParts = b && !b.missing ? b : null;
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
    const kitSymbols = cover
      ? [...cover.kits]
          .map((id) => String(ctx.byTw.get(id)?.tw_Symbol ?? "").trim() || `#${id}`)
          .join(", ")
          .slice(0, 280)
      : "";
    out.set(line.tw_Id, {
      role,
      availableQty: ownAvailable,
      openZdQty: round(ownZd + (cover?.zd ?? 0), 3),
      velocityDaily: baseVelocity,
      salesPeriodQty: Math.max(0, finite(line.sprzedazOkres)),
      targetQty: null,
      assembly:
        cover && cover.stock > 0
          ? {
              kind: "disassemble",
              qty: round(cover.stock, 3),
              note: `z kompletów: ${kitSymbols}`,
              coversDemand: true,
              // Sprzedaż tylko w zestawach: komplet na półce już jest tym towarem — nic do rozkładania.
              actionable: componentOwnSales(line) > 0,
            }
          : null,
      orderable: true,
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
  const pairStock = pairStockPieces(line.pair);
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
