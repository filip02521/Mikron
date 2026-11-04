import {
  formatPieces,
  shortDayLabel,
  zkLineIncomingCover,
  type ProsbaAlreadyOrderedInfo,
  type ProsbaIncomingZdDoc,
} from "@/lib/orders/prosba-already-ordered";
import type { ZkWatchLineCoverage } from "@/lib/sales/zk-watch-order-link";
import {
  assessProsbaLineStock,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";

/** Skąd pozycja ZK dostanie towar — jedna odpowiedź na pozycję, w oknie „co zamawiamy?”. */
export type ZkLineAvailabilityKind = "stock" | "transit" | "ordered" | "need" | "unknown";

export type ZkLineAvailability = {
  kind: ZkLineAvailabilityKind;
  badge: string;
  /** Krótka etykieta do wiersza listy (czytana jednym spojrzeniem). */
  chip: string;
  tone: "success" | "info" | "warning" | "default";
  /** Udział ilości z ZK (0–1): półka, dostawa z terminem, własna prośba, brak. */
  bar: { stock: number; transit: number; ordered: number; need: number };
  /** „W drodze: …” — null, gdy nic nie jedzie. */
  incomingFact: string | null;
  /** „Twoja prośba: …” — null bez otwartej prośby. */
  requestFact: string | null;
  /** Zdanie z następnym krokiem (tylko gdy jest co powiedzieć). */
  note: string | null;
  /** ZD z tym towarem (do rozwinięcia „Pokaż dostawy”). */
  docs: ProsbaIncomingZdDoc[];
  /** Cudze ZK bez rezerwacji, które czekają na ten towar. */
  otherZkWaiting: number;
};

const EMPTY_BAR = { stock: 0, transit: 0, ordered: 0, need: 0 };

function frac(part: number, whole: number): number {
  return whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
}

/**
 * Stan jednej pozycji ZK z danych, które okno już pobiera: stan z Subiekta (po rezerwacjach
 * tego ZK), towar w drodze (ZD) i prośby. Kolejność rozstrzygania: prośba powiązana z TYM ZK →
 * półka wystarcza → dostawa z terminem → brak. Otwarta prośba handlowca na ten towar bez
 * powiązania z ZK (np. dla innego klienta) niczego tu nie pokrywa — jest tylko ostrzeżeniem.
 */
export function assessZkLineAvailability(input: {
  quantity: number | null;
  stock: ProsbaLineStockSnapshot | undefined;
  info: ProsbaAlreadyOrderedInfo | undefined;
  stockExempt?: boolean;
  /** Pokrycie pozycji prośbami powiązanymi z tym ZK (computeZkWatchOrderHints). */
  zkCoverage?: ZkWatchLineCoverage;
  todayKey?: string;
}): ZkLineAvailability {
  const qty = input.quantity;
  const inc = input.info?.incoming ?? null;
  const own = input.info?.own ?? [];
  const docs = inc?.docs ?? [];
  const base = { docs, otherZkWaiting: 0, incomingFact: null, requestFact: null, note: null };

  if (input.stockExempt || qty == null || !(qty > 0) || (!input.stock && !input.info)) {
    return {
      ...base,
      kind: "unknown",
      badge: input.stockExempt ? "Bez sprawdzania stanu" : "Bez danych z Subiekta",
      chip: input.stockExempt ? "Bez sprawdzania" : "Bez danych",
      tone: "default",
      bar: EMPTY_BAR,
    };
  }

  const mine = own[0];
  const requestFact = mine
    ? mine.phase === "pending"
      ? `czeka u zakupów od ${shortDayLabel(mine.createdAt) ?? "—"}`
      : mine.phase === "partial"
        ? `dostarczono ${formatPieces(mine.deliveredQuantity)}${mine.quantity != null ? ` z ${formatPieces(mine.quantity)}` : ""}`
        : `zamówiona u dostawcy ${shortDayLabel(mine.orderedAt) ?? ""}`.trim()
    : null;

  if (input.zkCoverage && input.zkCoverage !== "uncovered") {
    const delivered = input.zkCoverage === "delivered";
    return {
      ...base,
      requestFact,
      kind: "ordered",
      badge: delivered ? "Dostarczone z prośby" : input.zkCoverage === "partial" ? "Częściowo dostarczone" : "Już zamówione",
      chip: delivered
        ? "Dostarczone"
        : input.zkCoverage === "partial"
          ? "Częściowo"
          : mine?.phase === "pending"
            ? "U zakupów"
            : `Zamówione${mine && shortDayLabel(mine.orderedAt) ? ` ${shortDayLabel(mine.orderedAt)}` : ""}`,
      tone: delivered ? "success" : "info",
      bar: { ...EMPTY_BAR, ordered: 1 },
      note: "Na tę pozycję jest już prośba z tego ZK - druga byłaby dublem.",
    };
  }

  const shelf = input.stock ? Math.max(0, input.stock.available) : 0;
  const shelfPart = frac(shelf, qty);
  const cover = zkLineIncomingCover(inc, qty, input.todayKey);
  const otherZkWaiting = inc ? Math.max(0, inc.zkWaiting - Math.min(qty, inc.zkWaiting)) : 0;
  const incomingFact =
    inc && inc.incoming > 0
      ? `${formatPieces(inc.incoming)}${cover ? `, wolne dla tego ZK ${formatPieces(cover.freeForLine)}` : ""}`
      : null;
  // Otwarta prośba na ten towar spoza tego ZK — nie pokrywa pozycji, ale warto ją zobaczyć.
  const facts = { ...base, otherZkWaiting, incomingFact, requestFact };
  const ownElsewhereNote = mine
    ? "Masz otwartą prośbę na ten towar spoza tego ZK - sprawdź, czy nie zamawiasz drugi raz."
    : null;

  if (input.stock && assessProsbaLineStock({ requestedQty: qty, stock: input.stock }) === "sufficient") {
    // Półka wystarcza — dostawy w drodze tej pozycji nie dotyczą, więc ich nie pokazujemy.
    return {
      ...facts,
      incomingFact: null,
      docs: [],
      kind: "stock",
      badge: "Na stanie",
      chip: "Na stanie",
      tone: "success",
      bar: { ...EMPTY_BAR, stock: 1 },
    };
  }

  if (cover?.covered && cover.certain) {
    return {
      ...facts,
      kind: "transit",
      badge: cover.doc?.deadline ? `W drodze · do ${shortDayLabel(cover.doc.deadline)}` : "W drodze",
      chip: shortDayLabel(cover.doc?.deadline) ?? "W drodze",
      tone: "info",
      bar: { ...EMPTY_BAR, stock: shelfPart, transit: 1 - shelfPart },
      note: ownElsewhereNote,
    };
  }

  const needBar = { ...EMPTY_BAR, stock: shelfPart, need: 1 - shelfPart };
  if (cover?.covered) {
    return {
      ...facts,
      kind: "need",
      badge: "W drodze bez terminu",
      chip: "Bez terminu",
      tone: "warning",
      bar: needBar,
      note: "Brakująca ilość jest w ZD bez pewnego terminu - zapytaj zakupy albo zamów.",
    };
  }
  if (inc && inc.incoming > 0) {
    return {
      ...facts,
      kind: "need",
      badge: "Zajęte przez inne ZK",
      chip: "Zajęte przez inne ZK",
      tone: "warning",
      bar: needBar,
      note: "Dostawa w drodze jest już rozdzielona na zamówienia innych klientów - trzeba zamówić.",
    };
  }
  return { ...facts, kind: "need", badge: "Brak", chip: "Brak", tone: "warning", bar: needBar, note: ownElsewhereNote };
}

/** Liczba pozycji w każdym stanie — do paska i legendy w nagłówku okna. */
export function countZkLineAvailability(
  items: readonly Pick<ZkLineAvailability, "kind">[]
): Record<ZkLineAvailabilityKind, number> {
  const out: Record<ZkLineAvailabilityKind, number> = { stock: 0, transit: 0, ordered: 0, need: 0, unknown: 0 };
  for (const item of items) out[item.kind] += 1;
  return out;
}
