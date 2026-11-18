import type { IndividualOrderStatus } from "@/types/database";

export type ServicePartStockState = "brak" | "ponizej_min" | "ok";

export type ServicePartRequest = {
  status: IndividualOrderStatus;
  quantity: string;
  createdAt: string;
};

export type ServicePartRow = {
  twId: number;
  symbol: string | null;
  name: string;
  groupName: string | null;
  onHand: number;
  reserved: number;
  /** Pobrane do zleceń serwisowych, a jeszcze bez RW — w Subiekcie wciąż na stanie. */
  takenWithoutRw: number;
  available: number;
  minStock: number | null;
  state: ServicePartStockState;
  /** Aktywne prośby (Nowe / Weryfikacja / Zamówione) — tylko one odblokowują towar w ZD. */
  requests: ServicePartRequest[];
  /** Dostawca, u którego zakupy dokupią do minimum (przypięty albo ostatni z historii ZD); null — nie wiadomo u kogo. */
  supplierName?: string | null;
};

/** Statusy prośby, przy których towar jest „zgłoszony” (jeszcze nie przyjęty w całości ani anulowany). */
export const SERVICE_PART_ACTIVE_REQUEST_STATUSES: readonly IndividualOrderStatus[] = [
  "Nowe",
  "Weryfikacja",
  "Zamowione",
  // Część sztuk dotarła, reszta wciąż zamówiona — prośba żyje, część nie jest „do zgłoszenia” drugi raz.
  "Czesciowo_zrealizowane",
];

function finite(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function servicePartStockState(available: number, minStock: number | null): ServicePartStockState {
  if (available <= 0) return "brak";
  if (minStock != null && minStock > 0 && available < minStock) return "ponizej_min";
  return "ok";
}

/** Dostępne do wzięcia: stan − rezerwacje − części pobrane do zleceń, a jeszcze bez RW (Subiekt ich nie odjął). */
export function servicePartAvailable(
  product: { tw_Stan?: number | null; tw_StanRez?: number | null },
  takenWithoutRw: number
): number {
  return finite(product.tw_Stan) - finite(product.tw_StanRez) - takenWithoutRw;
}

export function buildServicePartRows(input: {
  products: readonly {
    tw_Id: number;
    tw_Symbol?: string | null;
    tw_Nazwa?: string | null;
    grt_Nazwa?: string | null;
    tw_Stan?: number | null;
    tw_StanRez?: number | null;
  }[];
  minStockByTwId: ReadonlyMap<number, number>;
  requestsByTwId: ReadonlyMap<number, ServicePartRequest[]>;
  takenWithoutRwByTwId?: ReadonlyMap<number, number>;
  supplierNameByTwId?: ReadonlyMap<number, string>;
}): ServicePartRow[] {
  const seen = new Set<number>();
  const rows: ServicePartRow[] = [];
  for (const p of input.products) {
    const twId = Math.trunc(finite(p.tw_Id));
    if (twId <= 0 || seen.has(twId)) continue;
    seen.add(twId);
    const onHand = finite(p.tw_Stan);
    const reserved = finite(p.tw_StanRez);
    const takenWithoutRw = input.takenWithoutRwByTwId?.get(twId) ?? 0;
    const available = servicePartAvailable(p, takenWithoutRw);
    const minStock = input.minStockByTwId.get(twId) ?? null;
    rows.push({
      twId,
      symbol: p.tw_Symbol?.trim() || null,
      name: p.tw_Nazwa?.trim() || "-",
      groupName: p.grt_Nazwa?.trim() || null,
      onHand,
      reserved,
      takenWithoutRw,
      available,
      minStock,
      state: servicePartStockState(available, minStock),
      requests: input.requestsByTwId.get(twId) ?? [],
      // Bez mapy dostawców pole zostaje puste („nie sprawdzano”), a nie null („nie ma dostawcy”).
      ...(input.supplierNameByTwId ? { supplierName: input.supplierNameByTwId.get(twId) ?? null } : {}),
    });
  }
  const rank: Record<ServicePartStockState, number> = { brak: 0, ponizej_min: 1, ok: 2 };
  return rows.sort(
    (a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name, "pl")
  );
}

export type ServicePartsSummary = {
  total: number;
  missing: number;
  belowMin: number;
  requested: number;
  /** Bez stanu, bez minimum i bez aktywnej prośby — do zgłoszenia (część z minimum dokupi silnik ZD). */
  toRequest: number;
};

/** Minimum zamawia silnik ZD sam — o ile wiadomo, u kogo (`supplierName` null = nie wiadomo; brak pola = nie sprawdzano). */
export function autoRestocks(r: Pick<ServicePartRow, "minStock" | "supplierName">): boolean {
  return (r.minStock ?? 0) > 0 && r.supplierName !== null;
}

/** Brak albo mało, nikt nie prosił i silnik sam nie dokupi — bez zgłoszenia nikt tej części nie zamówi. */
export function needsReport(r: Pick<ServicePartRow, "state" | "requests" | "minStock" | "supplierName">): boolean {
  return r.state !== "ok" && r.requests.length === 0 && !autoRestocks(r);
}

export function summarizeServiceParts(rows: readonly ServicePartRow[]): ServicePartsSummary {
  let missing = 0;
  let belowMin = 0;
  let requested = 0;
  let toRequest = 0;
  for (const r of rows) {
    if (r.state === "brak") missing += 1;
    if (r.state === "ponizej_min") belowMin += 1;
    if (r.requests.length > 0) requested += 1;
    else if (needsReport(r)) toRequest += 1;
  }
  return { total: rows.length, missing, belowMin, requested, toRequest };
}
