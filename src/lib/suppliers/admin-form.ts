import type { SupplierWithSchedule } from "@/types/database";
import type { SupplierAdminFormState } from "@/components/admin/SupplierAdminForm";
import {
  defaultOrderOnDemandChecked,
} from "@/lib/orders/supplier-on-demand";
import { isSupplierActive } from "./active";

export function emptySupplierAdminForm(): SupplierAdminFormState {
  return {
    name: "",
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: "2 MIESIĄCE",
    stock_raw: "2 MIESIĄCE",
    stats_mode: "LACZNIE",
    order_on_demand: false,
    is_active: true,
    subiekt_kh_id: null,
    default_delivery_carrier: "",
    default_delivery_shipment_form: "",
  };
}

export function supplierToAdminForm(s: SupplierWithSchedule): SupplierAdminFormState {
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    pickup_mikran: s.pickup_mikran,
    pickup_pallet: s.pickup_pallet,
    notes: s.notes,
    mails: s.mails,
    extra_info: s.extra_info,
    interval_raw: s.interval_raw ?? "",
    stock_raw: s.stock_raw ?? (s.stock != null ? String(s.stock) : ""),
    stats_mode: s.stats_mode,
    order_on_demand: defaultOrderOnDemandChecked(s),
    is_active: isSupplierActive(s),
    subiekt_kh_id: s.subiekt_kh_id ?? null,
    default_delivery_carrier: s.default_delivery_carrier ?? "",
    default_delivery_shipment_form: s.default_delivery_shipment_form ?? "",
  };
}

/** Lokalna aktualizacja wiersza listy po zapisie formularza (bez pełnego refresh). */
export function applyAdminFormToSupplierRow(
  existing: SupplierWithSchedule,
  form: SupplierAdminFormState
): SupplierWithSchedule {
  return {
    ...existing,
    name: form.name.trim(),
    location: form.location,
    pickup_mikran: form.pickup_mikran,
    pickup_pallet: form.pickup_pallet,
    notes: form.notes,
    mails: form.mails,
    extra_info: form.extra_info,
    interval_raw: form.interval_raw.trim() || null,
    stock_raw: form.stock_raw.trim() || null,
    stats_mode: form.stats_mode,
    order_on_demand: form.order_on_demand,
    is_active: form.is_active,
    subiekt_kh_id: form.subiekt_kh_id,
    default_delivery_carrier: form.default_delivery_carrier.trim() || null,
    default_delivery_shipment_form: form.default_delivery_shipment_form.trim() || null,
  };
}
