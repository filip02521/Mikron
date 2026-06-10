/**
 * Kurierzy w dzienniku dostaw magazynu (ewidencja).
 * Wartości `value` muszą odpowiadać enum `warehouse_carrier` w Postgres.
 */
export const WAREHOUSE_CARRIERS = [
  { value: "dpd", label: "DPD" },
  { value: "dhl", label: "DHL" },
  { value: "dhl_express", label: "DHL Express" },
  { value: "ups", label: "UPS" },
  { value: "inpost", label: "InPost" },
  { value: "fedex", label: "FedEx" },
  { value: "gls", label: "GLS" },
  { value: "rhenus_naxco", label: "Rhenus / Naxco" },
  { value: "raben", label: "Raben" },
  { value: "poczta", label: "Poczta Polska" },
  { value: "psd", label: "PSD" },
  { value: "tnt", label: "TNT" },
  { value: "poltraf", label: "POLTRAF" },
  { value: "kuehne_nagel", label: "Kuehne + Nagel" },
  { value: "suus_logistics", label: "SUUS Logistics" },
  { value: "dachser", label: "Dachser" },
  { value: "db_schenker", label: "DB Schenker" },
  { value: "mikran_bartek", label: "Mikran Bartek" },
  { value: "geis", label: "Geis" },
  { value: "jasfbg", label: "JASFBG" },
  { value: "hellmann", label: "Hellmann" },
  { value: "kurier_dostawcy", label: "Kurier dostawcy" },
  { value: "odbior_wlasny", label: "Odbiór własny" },
  { value: "inne", label: "Inne" },
] as const;

export type WarehouseCarrier = (typeof WAREHOUSE_CARRIERS)[number]["value"];

export const WAREHOUSE_SHIPMENT_FORMS = [
  { value: "paczki", label: "Paczki" },
  { value: "palety", label: "Palety" },
  { value: "paczki_i_palety", label: "Paczki + palety" },
] as const;

export type WarehouseShipmentForm = (typeof WAREHOUSE_SHIPMENT_FORMS)[number]["value"];

export function warehouseCarrierLabel(value: string): string {
  return WAREHOUSE_CARRIERS.find((c) => c.value === value)?.label ?? value;
}

export function warehouseShipmentFormLabel(value: string): string {
  return WAREHOUSE_SHIPMENT_FORMS.find((f) => f.value === value)?.label ?? value;
}

/** Wszystkie wartości enum — do walidacji zapisu. */
export function isWarehouseCarrier(value: string): value is WarehouseCarrier {
  return WAREHOUSE_CARRIERS.some((c) => c.value === value);
}

export function isWarehouseShipmentForm(
  value: string
): value is WarehouseShipmentForm {
  return WAREHOUSE_SHIPMENT_FORMS.some((f) => f.value === value);
}

export function parseWarehouseCarrier(value: string): WarehouseCarrier {
  const trimmed = value.trim();
  if (!isWarehouseCarrier(trimmed)) {
    throw new Error(
      `Nieprawidłowy kurier „${value}”. Odśwież stronę i wybierz kuriera z listy.`
    );
  }
  return trimmed;
}

export function parseWarehouseShipmentForm(value: string): WarehouseShipmentForm {
  const trimmed = value.trim();
  if (!isWarehouseShipmentForm(trimmed)) {
    throw new Error(
      `Nieprawidłowa forma dostawy „${value}”. Wybierz paczki, palety lub obie.`
    );
  }
  return trimmed;
}

export function shipmentFormShowsPackages(form: WarehouseShipmentForm): boolean {
  return form === "paczki" || form === "paczki_i_palety";
}

export function shipmentFormShowsPallets(form: WarehouseShipmentForm): boolean {
  return form === "palety" || form === "paczki_i_palety";
}

/** Zeruje liczniki nieużywane przy danej formie (np. paczki przy samych paletach). */
export function normalizeShipmentCounts(
  shipmentForm: WarehouseShipmentForm,
  packageCount: number,
  palletCount: number
): { packageCount: number; palletCount: number } {
  const pkg = Math.max(0, Math.trunc(packageCount));
  const pal = Math.max(0, Math.trunc(palletCount));

  switch (shipmentForm) {
    case "paczki":
      return { packageCount: pkg, palletCount: 0 };
    case "palety":
      return { packageCount: 0, palletCount: pal };
    case "paczki_i_palety":
      return { packageCount: pkg, palletCount: pal };
  }
}

export function formatShipmentQuantitySuffix(
  shipmentForm: WarehouseShipmentForm,
  packageCount: number,
  palletCount: number
): string {
  const counts = normalizeShipmentCounts(shipmentForm, packageCount, palletCount);
  const parts: string[] = [];
  if (counts.packageCount > 0) parts.push(`${counts.packageCount} pacz.`);
  if (counts.palletCount > 0) parts.push(`${counts.palletCount} pal.`);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}
