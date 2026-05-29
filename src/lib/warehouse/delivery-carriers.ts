export const WAREHOUSE_CARRIERS = [
  { value: "inpost", label: "InPost" },
  { value: "dhl", label: "DHL" },
  { value: "dpd", label: "DPD" },
  { value: "gls", label: "GLS" },
  { value: "fedex", label: "FedEx" },
  { value: "poczta", label: "Poczta / listy" },
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
