/** Dostawca zamawiany tylko gdy coś jest potrzebne (kolumna I / zapas w arkuszach). */
const ON_DEMAND_RE = /w\s*razie\s*potrzeby/i;

export function hasOrderOnDemandMarker(text: string | null | undefined): boolean {
  return ON_DEMAND_RE.test((text ?? "").trim());
}

export function detectOrderOnDemandFromFields(fields: {
  stock_raw?: string | null;
  interval_raw?: string | null;
  extra_info?: string | null;
}): boolean {
  return (
    hasOrderOnDemandMarker(fields.stock_raw) ||
    hasOrderOnDemandMarker(fields.interval_raw) ||
    hasOrderOnDemandMarker(fields.extra_info)
  );
}

export type OrderOnDemandFields = {
  order_on_demand?: boolean | null;
  stock_raw?: string | null;
  interval_raw?: string | null;
  extra_info?: string | null;
};

/**
 * Aktywny gdy flaga w DB lub marker w polach arkusza.
 * (Domyślne `false` w DB nie blokuje wykrywania — ważne przed backfillem.)
 */
export function isSupplierOrderOnDemand(s: OrderOnDemandFields): boolean {
  if (s.order_on_demand === true) return true;
  return detectOrderOnDemandFromFields(s);
}

export function resolveOrderOnDemandForSave(form: {
  order_on_demand: boolean;
  stock_raw: string;
  interval_raw: string;
  extra_info: string;
}): boolean {
  return form.order_on_demand || detectOrderOnDemandFromFields(form);
}

export function defaultOrderOnDemandChecked(fields: OrderOnDemandFields): boolean {
  return isSupplierOrderOnDemand(fields);
}

/** Po zmianie zapasu / interwału — proponuj checkbox zgodnie z tekstem w arkuszu. */
export function suggestOrderOnDemandAfterFieldChange(
  prevChecked: boolean,
  fields: {
    stock_raw: string;
    interval_raw: string;
    extra_info: string;
  }
): boolean {
  if (detectOrderOnDemandFromFields(fields)) return true;
  return prevChecked;
}
