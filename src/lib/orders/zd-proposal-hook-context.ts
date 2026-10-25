/**
 * Kontekst przekazywany przez nocny przebieg (`stock-watch/worker.ts`) do podpięć propozycji
 * ZD automatu: bezpieczników (zad. 4, `zd-proposal-guards.ts`) i minimum (zad. 5,
 * `zd-proposal-minimum.ts`). Tylko serwer (typy silnika i cen zakupu).
 */
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import type { ZdOrderHorizon } from "@/lib/orders/zd-order-horizon";
import type { runZdOrderEngine } from "@/lib/orders/zd-order-engine";
import type { ZdOrderList } from "@/lib/orders/zd-order-list";
import type { ProductPurchasePrice } from "@/lib/stock-watch/data";

export type ZdOrderEngineOk = Extract<Awaited<ReturnType<typeof runZdOrderEngine>>, { ok: true }>;

export type ZdProposalHookContext = {
  supplierId: string;
  /** Linie z zdUnits > 0 — to, co trafi do propozycji. */
  lines: ZdAutoProposalLine[];
  /** Pełna lista zakresu (też zdUnits = 0) — kandydaci do dopełnienia, tempo, stany. */
  list: ZdOrderList;
  engine: ZdOrderEngineOk;
  horizon: ZdOrderHorizon | null;
  /** Ceny z ostatnich ZD (dzisiejsze źródło `priceNet`). */
  prices: ReadonlyMap<number, ProductPurchasePrice>;
  /** Dni celu faktycznie użyte (strategia: co najmniej cykl + dostawa + bufor). */
  dniZapasuUsed: number;
  dataDo: string;
};
