import type { IndividualOrder } from "@/types/database";

export const MAX_CLIENT_NAME_LEN = 80;

export type SalesClientAssignment = {
  clientName: string | null;
  clientKhId: number | null;
};

/** Normalizuje etykietę klienta (pusty → null). */
export function normalizeSalesClientName(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_CLIENT_NAME_LEN);
}

/** kh_Id z Subiekta — tylko gdy jest przypisana nazwa klienta. */
export function normalizeSalesClientKhId(
  clientName: string | null,
  clientKhId: number | null | undefined
): number | null {
  if (!clientName) return null;
  if (clientKhId == null || !Number.isFinite(clientKhId)) return null;
  const kh = Math.trunc(clientKhId);
  return kh > 0 ? kh : null;
}

export function normalizeSalesClientAssignment(input: {
  clientName: string | null | undefined;
  clientKhId?: number | null;
}): SalesClientAssignment {
  const clientName = normalizeSalesClientName(input.clientName);
  return {
    clientName,
    clientKhId: normalizeSalesClientKhId(clientName, input.clientKhId),
  };
}

export function clientNamesSummary(
  orders: Pick<IndividualOrder, "sales_client_name">[]
): string | null {
  const names = [
    ...new Set(
      orders
        .map((o) => normalizeSalesClientName(o.sales_client_name))
        .filter((n): n is string => Boolean(n))
    ),
  ];
  if (!names.length) return null;
  if (names.length === 1) return names[0]!;
  return `${names.length} różnych klientów`;
}

/** Skrót klientów z linii prośby (panel zakupów). */
export function clientNamesSummaryFromLines(
  lines: Pick<{ clientName?: string | null }, "clientName">[]
): string | null {
  return clientNamesSummary(
    lines.map((line) => ({ sales_client_name: line.clientName ?? null }))
  );
}

type OrderEmailBits = Pick<
  IndividualOrder,
  "products" | "symbol" | "sales_client_name"
> & {
  supplier?: { name?: string } | null;
};

function clientPrefix(order: OrderEmailBits): string {
  const client = normalizeSalesClientName(order.sales_client_name);
  return client ? `Dla klienta: ${client} · ` : "";
}

/** Linia w e-mailu o dostawie na magazyn (zamówienie). */
export function formatDeliveryEmailLine(
  order: OrderEmailBits,
  statusLabel: string
): string {
  return `${clientPrefix(order)}${order.supplier?.name ?? "Dostawca"}: ${order.products} — ${statusLabel}`;
}

/** Linia w e-mailu informacyjnym. */
export function formatInformacjaEmailLine(order: OrderEmailBits): string {
  const parts = [
    clientPrefix(order).replace(/ · $/, ""),
    order.supplier?.name ?? "Dostawca",
    order.products,
  ].filter(Boolean);
  if (order.symbol && order.symbol !== "-") {
    parts.push(`symbol: ${order.symbol}`);
  }
  return parts.join(" · ");
}
