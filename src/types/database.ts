export type SupplierLocation = "POLSKA" | "ZAGRANICA" | "IMPORT";
export type StatsMode = "LACZNIE" | "OSOBNO";
export type IndividualOrderStatus =
  | "Nowe"
  | "Weryfikacja"
  | "Zamowione"
  | "Czesciowo_zrealizowane"
  | "Zrealizowane"
  | "Anulowane";
export type OrderType = "Glowne" | "Poboczne" | "None";
/** zamowienie = standardowa prośba; informacja = tylko powiadom gdy dotarło na magazyn */
export type IndividualRequestKind = "zamowienie" | "informacja";
export type VacationNote =
  | "PRZESUNIETE_PO"
  | "PRZYSPIESZONE_PRZED"
  | "OSTATNIE_ZAMOWIENIE";
export type UserRole = "admin" | "zakupy" | "sales" | "sales_manager";

export interface Supplier {
  id: string;
  name: string;
  location: SupplierLocation;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  notes: string;
  mails: string;
  extra_info: string;
  interval_raw: string | null;
  interval_weeks: number | null;
  stock_raw: string | null;
  stock: number | null;
  stats_mode: StatsMode;
  /** Zamówienia tylko na zgłoszenie — bez stałego wpisu w planie tygodnia. */
  order_on_demand: boolean;
}

export interface SupplierSchedule {
  id: string;
  supplier_id: string;
  order_date: string | null;
  shift_date: string | null;
  computed_next_date: string | null;
  vacation_note: VacationNote | null;
}

export interface SupplierWithSchedule extends Supplier {
  schedule: SupplierSchedule | null;
}

export interface Vacation {
  id: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
}

export interface SalesPerson {
  id: string;
  name: string;
  email: string;
}

export interface IndividualOrder {
  id: string;
  supplier_id: string | null;
  sales_person_id: string;
  symbol: string;
  products: string;
  quantity: string;
  delivered_quantity: string;
  order_type: OrderType;
  request_kind: IndividualRequestKind;
  status: IndividualOrderStatus;
  action_at: string;
  /** Moment oznaczenia Główne/Uzupełniające — start liczenia czasu realizacji. */
  ordered_at: string | null;
  /** Wspólne ID pozycji z jednego formularza / jednego zapisu. */
  submission_group_id?: string | null;
  /** Wspólne ID pozycji zamówionych jedną akcją w panelu dziennym. */
  placement_group_id?: string | null;
  delivery_at: string | null;
  /** Handlowiec potwierdził anulowanie lub odbiór — ukryte w „Moje zamówienia”. */
  sales_acknowledged_at?: string | null;
  /** Handlowiec wycofał prośbę — informacja dla działu dostaw. */
  sales_cancelled_at?: string | null;
  /** before_order | in_transit | on_stock */
  sales_cancel_phase?: string | null;
  /** Etykieta klienta końcowego (opcjonalnie, ustawia handlowiec). */
  sales_client_name?: string | null;
  /** Dział dostaw potwierdził zapoznanie z rezygnacją handlowca (panel dzienny). */
  procurement_sales_cancel_ack_at?: string | null;
  /** Rozliczenie rezygnacji: to_stock | return */
  procurement_cancel_disposition?: string | null;
  procurement_cancel_disposition_note?: string | null;
  procurement_cancel_disposition_at?: string | null;
  supplier?: Supplier;
  sales_person?: SalesPerson;
}

export interface DeliveryStats {
  supplier_id: string;
  main_sum: number | null;
  main_count: number | null;
  main_avg: number | null;
  side_sum: number | null;
  side_count: number | null;
  side_avg: number | null;
}

export const SUMMARY_COLORS = {
  expired: "#fff1f2",
  today: "#eff6ff",
  tomorrow: "#fffde7",
  thisWeek: "#e3f2fd",
  forSomeone: "#e8f5e9",
  forSomeoneText: "#1e8e3e",
  informacja: "#e0f2fe",
  informacjaText: "#0369a1",
  vacationWarning: "#fff3e0",
  historyNew: "#fafafa",
  historyVerification: "#fef3c7",
  historyMain: "#e8f5e9",
  historySide: "#e3f2fd",
  historyShift: "#fff8e1",
  historyCompleted: "#f5f5f5",
  historyCancelled: "#eeeeee",
  historyPartial: "#fff3cd",
  historyPending: "#e3f2fd",
} as const;

export const LOCATION_FLAGS: Record<SupplierLocation, string> = {
  POLSKA: "🇵🇱 ",
  ZAGRANICA: "🌍 ",
  IMPORT: "🚢 ",
};
