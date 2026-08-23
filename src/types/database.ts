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
export type UserRole = "admin" | "zakupy" | "zakupy_zeby" | "magazyn" | "sales" | "sales_manager";

/** Obszary robocze przypisywane użytkownikom przez admina. */
export type Workspace = "dostawy" | "zeby" | "magazyn";

/** Dzień tygodnia dla harmonogramu zębów: 1=Pn, 2=Wt, 3=Śr, 4=Cz, 5=Pt. */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5;

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

/** Definicja flagi zakupów (panel dzienny). */
export interface ProcurementFlagDefinitionRow {
  id: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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
  /** Skąd zamknięto informację: ręcznie (magazyn) lub automatycznie (stan Subiekta). */
  informacja_arrived_source?: "manual" | "stock_auto" | null;
  status: IndividualOrderStatus;
  action_at: string;
  /** Kiedy rekord powstał w bazie (ISO). */
  created_at?: string;
  /** Moment wejścia prośby zębowej do kolejki działu zębów. */
  teeth_queue_entered_at?: string | null;
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
  /** Timestamp ostatniej zmiany uwag przez zakupy — do powiadomień handlowca. */
  sales_request_note_updated_at?: string | null;
  /** Kiedy handlowiec potwierdził przeczytanie uwag zaktualizowanych przez zakupy. */
  sales_request_note_seen_at?: string | null;
  /** Timestamp ostatniej zmiany wiadomości przy anuleniu — do powiadomień handlowca. */
  procurement_cancel_note_updated_at?: string | null;
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
  /** Wewnętrzna flaga zakupów (panel dzienny) — niewidoczna w UI handlowca. */
  procurement_flag?: string | null;
  /** Opcjonalny opis flagi zakupów. */
  procurement_flag_note?: string | null;
  procurement_flag_updated_at?: string | null;
  procurement_flag_updated_by?: string | null;
  /** Rozliczenie rezygnacji: to_stock | return */
  procurement_cancel_disposition?: string | null;
  procurement_cancel_disposition_note?: string | null;
  procurement_cancel_disposition_at?: string | null;
  /** Magazyn rozliczył rezygnację (stan / zwrot / zdjęcie z regału). */
  warehouse_cancel_fulfilled_at?: string | null;
  /** Fizyczna lokalizacja na magazynie (regał / strefa). */
  warehouse_shelf?: string | null;
  /** Magazyn zdjął pozycję z regału (ręcznie, nie potwierdzenie handlowca). */
  warehouse_cleared_at?: string | null;
  /** Kto zdjął z regału (email/ID z sesji magazynu). */
  warehouse_cleared_by?: string | null;
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
  /** Czy pozycja jest „zęby" (denormalizowane z prosba_teeth_products). */
  is_teeth?: boolean;
  /** Czy lista zębów została wczytana ze zdjęcia (OCR) i oczekuje weryfikacji. */
  teeth_ocr_pending?: boolean;
  /** Ścieżka do zdjęcia kartki w Supabase Storage (bucket teeth-ocr-images). */
  teeth_ocr_image_path?: string | null;
  /** Kto zamówił zęby (UUID profilu) — osoba z działu zębów lub głównego działu. */
  teeth_ordered_by?: string | null;
  /** Kiedy zęby zostały oznaczone jako zamówione. */
  teeth_ordered_at?: string | null;
  /** Planowana data dostawy dla zamówień zębowych (ręczna lub wyliczona z historii zębowej). */
  teeth_delivery_date?: string | null;
  /** Ścieżka do pliku zamówienia (XML/Excel/PDF) w Supabase Storage (bucket teeth-order-files). */
  teeth_order_file_path?: string | null;
  /** Oryginalna nazwa pliku zamówienia załączonego przez panel zębów. */
  teeth_order_file_name?: string | null;
  /** Szczegóły zębowe (kolor, wzór, rozmiar) per pozycja — dołączone przy pobieraniu. */
  teeth_details?: IndividualOrderTeethDetail[] | null;
  /** Przyjęte sztuki per linia spec (klucz: teethReceiveGroupKey). */
  teeth_line_delivered?: Record<string, number> | null;
  supplier?: Supplier;
  sales_person?: SalesPerson;
}

export type IndividualOrderTeethDetail = {
  id: string;
  order_id: string;
  position: number;
  color: string;
  mould: string | null;
  size: string | null;
  jaw: "upper" | "lower" | null;
  kind: "anterior" | "posterior" | null;
  ordered_at?: string | null;
};

export type SalesNoteColor = "default" | "yellow" | "green" | "blue" | "pink";

export interface TeethSupplierSchedule {
  id: string;
  supplier_id: string;
  order_day_of_week: DayOfWeek;
  interval_weeks: number;
  last_order_date: string | null;
  shift_date: string | null;
  computed_next_date: string | null;
  vacation_note: VacationNote | null;
  /** Stałe dni robocze do dostawy; null = ETA z historii. */
  delivery_lead_business_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface TeethSupplierScheduleWithSupplier extends TeethSupplierSchedule {
  supplier_name: string;
}

/** Brak zębów u dostawcy — wariant katalogowy (linia + kolor + fason). */
export interface TeethSupplierShortage {
  id: string;
  supplier_id: string;
  manufacturer: string;
  product_line: string;
  color: string;
  mould: string;
  kind: "anterior" | "posterior" | null;
  available_from: string | null;
  note: string;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeethSupplierShortageWithSupplier extends TeethSupplierShortage {
  supplier_name: string;
}

/** Magazyn zewnętrzny (Gądki) — site konfiguracji stałych ZK. */
export interface ExternalWarehouseSite {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalWarehouseZkLink {
  id: string;
  site_id: string;
  subiekt_dok_id: number;
  zk_number: string;
  client_label: string;
  label: string | null;
  last_snapshot: Record<string, unknown> | null;
  line_summary: string | null;
  snapshot_hash: string | null;
  last_synced_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ExternalWarehouseLineMeta {
  id: string;
  zk_link_id: string;
  line_key: string;
  pallet_label: string | null;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

/** Udział ilości pozycji ZK na jednej nazwanej palecie. */
export interface ExternalWarehouseLinePalletShare {
  id: string;
  zk_link_id: string;
  line_key: string;
  pallet_label: string;
  qty: number;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface ExternalWarehouseNote {
  id: string;
  site_id: string;
  zk_link_id: string | null;
  body: string;
  created_by: string | null;
  updated_at: string;
  created_at: string;
  archived_at: string | null;
}

export type ExternalWarehouseChangeKind =
  | "zk_linked"
  | "zk_unlinked"
  | "lines_added"
  | "lines_removed"
  | "qty_changed"
  | "pallet_changed"
  | "pallet_renamed"
  | "pallet_shares_changed"
  | "line_note"
  | "site_note";

export interface ExternalWarehouseChangeLog {
  id: string;
  site_id: string;
  zk_link_id: string | null;
  kind: ExternalWarehouseChangeKind;
  summary: string;
  meta: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
}

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
  closed_by: string | null;
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

export interface DepartmentBoardThreadAttachment {
  id: string;
  thread_id: string;
  created_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  byte_size: number | null;
  sort_order: number;
  created_at: string;
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
  /**
   * Gdy true — przy tworzeniu/uzupełnianiu prośby z ZK dołącz `note` do
   * `sales_request_note` pozycji (zakupy zobaczą). Domyślnie false / brak = prywatna.
   */
  include_note_in_prosba?: boolean;
  line_summary: string | null;
  subiekt_snapshot: Record<string, unknown> | null;
  /** Stan odbioru pozycji — patrz ZkWatchLineCheckStored. */
  line_checks: unknown;
  /**
   * Szkice list zębów przed prośbą — mapa lineKey → ZkTeethLineDraft
   * (TeethLineDetail + meta). Patrz `src/lib/sales/zk-watch-teeth-draft.ts`.
   */
  teeth_drafts?: unknown;
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

export type VacationDelegation = {
  id: string;
  salesPersonId: string;
  salesPersonName: string;
  delegateProfileId: string;
  startDate: string;
  endDate: string;
  createdBy: string | null;
  createdAt: string;
};

/** Skład/komplet ZD (zd_product_boms) — policy v1. */
export type ZdProductBomDemandAllocation = "explode" | "separate";
export type ZdProductBomPurchaseTarget = "components" | "as_sold" | "kit_only";

export type ZdProductBom = {
  id: string;
  parent_tw_id: number;
  label: string | null;
  stock_as_cover: boolean;
  demand_allocation: ZdProductBomDemandAllocation;
  purchase_target: ZdProductBomPurchaseTarget;
  source: string | null;
  note: string | null;
  parent_symbol: string | null;
  parent_nazwa: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type ZdProductBomComponent = {
  id: string;
  bom_id: string;
  component_tw_id: number;
  qty_per_parent: number;
  component_symbol: string | null;
  component_nazwa: string | null;
};

export type MailJobRecipientRole = "to" | "cc" | "bcc";

export type MailSendTriggerKind = "cron" | "manual" | "test";

export type MailSendStatus =
  | "pending"
  | "generating"
  | "sent"
  | "failed"
  | "blocked"
  | "skipped";

export type MailSendIssueSeverity = "blocking" | "warning" | "info";

export type AdminModuleSlug = "ivoclar_weekly_mail_center";

export type UserAdminModule = {
  user_id: string;
  module_slug: AdminModuleSlug;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type MailJobDefinition = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  schedule_label: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MailJobRecipient = {
  id: string;
  job_id: string;
  email: string;
  display_name: string | null;
  recipient_role: MailJobRecipientRole;
  enabled: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MailSendLog = {
  id: string;
  job_id: string;
  period_key: string;
  attempt_no: number;
  trigger_kind: MailSendTriggerKind;
  triggered_by: string | null;
  status: MailSendStatus;
  period_from: string | null;
  period_to: string | null;
  subject: string | null;
  resend_message_ids: string[];
  recipient_snapshot: unknown;
  attachment_manifest: unknown;
  summary: Record<string, unknown>;
  events: MailSendEvent[];
  error_message: string | null;
  had_warnings: boolean;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type MailSendEvent = {
  at: string;
  kind: string;
  message?: string;
};

export type MailSendIssue = {
  id: string;
  send_log_id: string;
  severity: MailSendIssueSeverity;
  code: string;
  message: string;
  context: Record<string, unknown>;
  count: number;
};

export const LOCATION_FLAGS: Record<SupplierLocation, string> = {
  POLSKA: "🇵🇱 ",
  ZAGRANICA: "🌍 ",
  IMPORT: "🚢 ",
};
