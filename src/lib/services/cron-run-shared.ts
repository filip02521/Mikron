/** Typy i stałe cron — bezpieczne dla klienta (bez Supabase). */

export type CronRunPayload = {
  ok: boolean;
  at: string;
  detail?: Record<string, unknown>;
  error?: string;
};

export type CronJobId =
  | "process_deliveries"
  | "morning_sync"
  | "morning_routine"
  | "catalog_zd_sync"
  | "zd_eta_sync"
  | "informacja_stock_sync"
  | "scheduled_mails"
  | "stock_watch"
  | "subiekt_lead_times"
  | "zd_sku_class"
  | "zd_kpi_weekly"
  | "rol_reports";

export const CRON_JOB_IDS: CronJobId[] = [
  "morning_routine",
  "process_deliveries",
  "zd_eta_sync",
  "informacja_stock_sync",
  "catalog_zd_sync",
  "stock_watch",
  "subiekt_lead_times",
  "zd_sku_class",
  "zd_kpi_weekly",
  "rol_reports",
  "scheduled_mails",
  "morning_sync",
];
