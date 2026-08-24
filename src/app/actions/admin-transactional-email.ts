"use server";

import { requireAdmin } from "@/lib/auth";
import {
  getTransactionalEmailLogById,
  listTransactionalEmailLogs,
} from "@/lib/services/transactional-email-log";
import type { TransactionalEmailKind, TransactionalEmailLog } from "@/types/database";

export type TransactionalEmailListFilters = {
  kind?: TransactionalEmailKind | "all";
  status?: "sent" | "failed" | "all";
  limit?: number;
  offset?: number;
};

export async function actionListTransactionalEmails(
  filters: TransactionalEmailListFilters = {}
): Promise<{ rows: TransactionalEmailLog[]; total: number }> {
  await requireAdmin();
  return listTransactionalEmailLogs({
    kind: filters.kind ?? "all",
    status: filters.status ?? "all",
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  });
}

export async function actionGetTransactionalEmailDetail(
  id: string
): Promise<{ ok: true; log: TransactionalEmailLog } | { ok: false }> {
  await requireAdmin();
  const log = await getTransactionalEmailLogById(id);
  if (!log) return { ok: false };
  return { ok: true, log };
}
