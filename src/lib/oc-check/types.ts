export const OC_STATUSES = ["zgodne", "rozbieznosci", "czeka_na_nas", "brak_oc", "nie_da_sie"] as const;
export type OcCheckStatus = (typeof OC_STATUSES)[number];

export const OC_LINE_KINDS = [
  "ok",
  "ilosc",
  "jednostka",
  "cena",
  "termin",
  "zamiennik",
  "brak",
  "dodatkowa",
  "koszt",
] as const;
export type OcLineKind = (typeof OC_LINE_KINDS)[number];

export const OC_STATUS_LABELS: Record<OcCheckStatus, string> = {
  zgodne: "Zgodne",
  rozbieznosci: "Rozbieżności",
  czeka_na_nas: "Czeka na nas",
  brak_oc: "Brak OC",
  nie_da_sie: "Nie da się porównać",
};

export const OC_LINE_KIND_LABELS: Record<OcLineKind, string> = {
  ok: "zgodne",
  ilosc: "ilość",
  jednostka: "jednostka",
  cena: "cena",
  termin: "termin",
  zamiennik: "zamiennik",
  brak: "brak",
  dodatkowa: "pozycja dodatkowa",
  koszt: "koszt dodatkowy",
};

export type OcCheckLine = {
  position: number;
  symbol: string;
  name: string;
  qtyOrdered: number | null;
  qtyConfirmed: number | null;
  unitOrdered: string;
  unitConfirmed: string;
  priceOrdered: number | null;
  priceConfirmed: number | null;
  currency: string;
  deliveryDate: string | null;
  kind: OcLineKind;
  note: string;
};

export type OcCheck = {
  id: string;
  mailbox: string;
  gmailThreadId: string | null;
  supplierName: string;
  zdNumber: string;
  ocNumber: string;
  ocReceivedAt: string | null;
  status: OcCheckStatus;
  priority: 0 | 1 | 2;
  summary: string;
  nextStep: string;
  linesTotal: number | null;
  linesOk: number | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string;
  lines: OcCheckLine[];
};
