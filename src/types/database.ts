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
export type UserRole = "admin" | "zakupy" | "magazyn" | "sales" | "sales_manager";

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
  /** false = ukryty w panelu dziennym; zarządzanie w Kartach / liście Nieaktywni. */
  is_active: boolean;
  /** Kontrahent-dostawca w Subiekcie (kh_Id) — jawne powiązanie zamiast dopasowania po nazwie. */
  subiekt_kh_id?: number | null;
  /** Domyślny kurier w dzienniku dostaw magazynu. */
  default_delivery_carrier?: string | null;
  default_delivery_shipment_form?: string | null;
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
  group_id?: string | null;
}

export type SalesBugReportStatus = "open" | "triaged" | "closed";

export interface SalesBugReport {
  id: string;
  profile_id: string;
  sales_person_id: string | null;
  reporter_name: string;
  reporter_email: string | null;
  page_path: string;
  message: string;
  user_agent: string | null;
  status: SalesBugReportStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
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
  /** Informacja: najpierw panel Dziś (Główne/Uzupełniające), potem kolejka magazynu. */
  informacja_queue_via_daily_panel?: boolean;
  /** Informacja: koniec stanu — tylko panel Dziś (zamówienie u dostawcy), bez powiadomienia handlowca. */
  informacja_stock_out_reorder?: boolean;
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
  /** Ilość wycofana przez handlowca (szt.); NULL = pełna rezygnacja wg dotychczasowych reguł. */
  sales_cancelled_quantity?: string | null;
  /** Etykieta klienta końcowego (opcjonalnie, ustawia handlowiec). */
  sales_client_name?: string | null;
  /** Uwagi handlowca do prośby — widoczne w panelu dziennym zakupów. */
  sales_request_note?: string | null;
  /** Wiadomość od działu dostaw przy anulowaniu — widoczna u handlowca w Moje zamówienia. */
  procurement_cancel_note?: string | null;
  /** kh_Id odbiorcy z Subiekta — powiązanie z ZK / wyszukiwanie. */
  sales_client_kh_id?: number | null;
  /** Karta ZK z notatnika (przycisk Prośba). */
  source_zk_watch_id?: string | null;
  /** Numer ZK przy złożeniu prośby. */
  source_zk_number?: string | null;
  /** Dział dostaw potwierdził zapoznanie z rezygnacją handlowca (panel dzienny). */
  procurement_sales_cancel_ack_at?: string | null;
  /** Zakupy zapoznały się z prośbą w panelu dziennym — ukrywa badge „Nowa”. */
  procurement_seen_at?: string | null;
  /** Rozliczenie rezygnacji: to_stock | return */
  procurement_cancel_disposition?: string | null;
  procurement_cancel_disposition_note?: string | null;
  procurement_cancel_disposition_at?: string | null;
  /** Magazyn rozliczył rezygnację (stan / zwrot / zdjęcie z regału). */
  warehouse_cancel_fulfilled_at?: string | null;
  /** Fizyczna lokalizacja na magazynie (regał / strefa). */
  warehouse_shelf?: string | null;
  /** ID towaru w Subiekcie (tw_Id) — wybor z kartoteki; brak = wpis ręczny. */
  subiekt_tw_id?: number | null;
  /** Kod Mikran (tw_PLU) — opcjonalnie przy prośbie. */
  mikran_code?: string | null;
  /** Termin realizacji z dokumentu ZD (YYYY-MM-DD). */
  zd_fulfillment_deadline?: string | null;
  /** Źródło terminu: zd = Subiekt ZD. */
  zd_fulfillment_source?: string | null;
  /** Numer pełny dopasowanego ZD. */
  zd_fulfillment_dok_nr?: string | null;
  /** Identyfikator dopasowanego dokumentu ZD (dok_Id). */
  zd_fulfillment_dok_id?: number | null;
  /** Ostatnia synchronizacja terminu z ZD. */
  zd_fulfillment_synced_at?: string | null;
  /** Poprzedni termin przed zmianą w ZD. */
  zd_fulfillment_previous_deadline?: string | null;
  /** Kiedy sync wykrył zmianę terminu ZD. */
  zd_fulfillment_deadline_changed_at?: string | null;
  /** Kiedy handlowiec potwierdził zmianę terminu. */
  zd_fulfillment_deadline_change_seen_at?: string | null;
  supplier?: Supplier;
  sales_person?: SalesPerson;
}

export type SalesNoteColor = "default" | "yellow" | "green" | "blue" | "pink";

export type OperationsDepartment = "zakupy" | "magazyn";
export type OperationsNoteVisibility = "private" | "public";

export interface OperationsNote {
  id: string;
  department: OperationsDepartment;
  visibility: OperationsNoteVisibility;
  created_by: string;
  title: string | null;
  body: string;
  color: SalesNoteColor;
  pinned: boolean;
  sort_order: number;
  archived_at: string | null;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  author?: { email: string | null } | null;
}

export type DepartmentBoardKind = "announcement" | "question";
export type DepartmentBoardStatus = "open" | "answered" | "archived";

export interface DepartmentBoardThread {
  id: string;
  kind: DepartmentBoardKind;
  status: DepartmentBoardStatus;
  created_by: string;
  sales_person_id: string | null;
  title: string;
  body: string;
  product_symbol: string | null;
  product_name: string | null;
  subiekt_tw_id: number | null;
  mikran_code: string | null;
  color: SalesNoteColor;
  pinned: boolean;
  published_at: string;
  expires_at: string | null;
  answered_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentBoardPost {
  id: string;
  thread_id: string;
  created_by: string;
  body: string;
  created_at: string;
}

export interface DepartmentBoardRead {
  thread_id: string;
  profile_id: string;
  read_at: string;
}

export interface SalesNote {
  id: string;
  sales_person_id: string;
  title: string | null;
  body: string;
  color: SalesNoteColor;
  pinned: boolean;
  sort_order: number;
  archived_at: string | null;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesZkWatch {
  id: string;
  sales_person_id: string;
  subiekt_dok_id: number;
  zk_number: string;
  client_label: string;
  client_kh_id: number | null;
  amount_net: number | null;
  amount_gross: number | null;
  zk_issued_at: string | null;
  note: string | null;
  line_summary: string | null;
  subiekt_snapshot: Record<string, unknown> | null;
  /** Stan odbioru pozycji — patrz ZkWatchLineCheckStored. */
  line_checks: unknown;
  follow_up_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
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
