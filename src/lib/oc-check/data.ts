// @service-role-ok — wywoływane wyłącznie ze strony i akcji po requireOperations().

import { createAdminClient } from "@/lib/db/admin";
import type { OcImportCheck } from "./import";
import type { OcCheck, OcCheckLine, OcCheckStatus, OcLineKind } from "./types";

export type Db = ReturnType<typeof createAdminClient>;

type CheckRow = {
  id: string;
  mailbox: string;
  gmail_thread_id: string | null;
  supplier_name: string;
  zd_number: string;
  oc_number: string;
  oc_received_at: string | null;
  status: OcCheckStatus;
  priority: number;
  summary: string;
  next_step: string;
  lines_total: number | null;
  lines_ok: number | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string;
};

type LineRow = {
  check_id: string;
  position: number;
  symbol: string;
  name: string;
  qty_ordered: string | number | null;
  qty_confirmed: string | number | null;
  unit_ordered: string;
  unit_confirmed: string;
  price_ordered: string | number | null;
  price_confirmed: string | number | null;
  currency: string;
  delivery_date: string | null;
  kind: OcLineKind;
  note: string;
};

/** numeric z Postgresa przychodzi jako tekst. */
function toNum(value: string | number | null): number | null {
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Wyjaśnione starsze niż 30 dni nie wnoszą nic do codziennej pracy — nie ładujemy ich. */
const RESOLVED_HISTORY_DAYS = 30;

export async function loadOcChecks(db: Db): Promise<OcCheck[]> {
  const since = new Date(Date.now() - RESOLVED_HISTORY_DAYS * 86_400_000).toISOString();
  const [{ data: open, error: openError }, { data: resolved, error: resolvedError }] = await Promise.all([
    db.from("oc_checks").select("*").is("resolved_at", null).order("oc_received_at", { ascending: false }),
    db
      .from("oc_checks")
      .select("*")
      .gte("resolved_at", since)
      .order("resolved_at", { ascending: false }),
  ]);
  if (openError) throw new Error(openError.message);
  if (resolvedError) throw new Error(resolvedError.message);

  const rows = [...((open ?? []) as CheckRow[]), ...((resolved ?? []) as CheckRow[])];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const resolverIds = [...new Set(rows.map((r) => r.resolved_by).filter((v): v is string => Boolean(v)))];
  const [{ data: lines, error: linesError }, { data: resolvers }] = await Promise.all([
    db.from("oc_check_lines").select("*").in("check_id", ids).order("position", { ascending: true }),
    resolverIds.length
      ? db.from("profiles").select("id, email").in("id", resolverIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null }> }),
  ]);
  if (linesError) throw new Error(linesError.message);

  const linesByCheck = new Map<string, OcCheckLine[]>();
  for (const l of (lines ?? []) as LineRow[]) {
    const list = linesByCheck.get(l.check_id) ?? [];
    list.push({
      position: l.position,
      symbol: l.symbol,
      name: l.name,
      qtyOrdered: toNum(l.qty_ordered),
      qtyConfirmed: toNum(l.qty_confirmed),
      unitOrdered: l.unit_ordered,
      unitConfirmed: l.unit_confirmed,
      priceOrdered: toNum(l.price_ordered),
      priceConfirmed: toNum(l.price_confirmed),
      currency: l.currency,
      deliveryDate: l.delivery_date,
      kind: l.kind,
      note: l.note,
    });
    linesByCheck.set(l.check_id, list);
  }
  const resolverEmail = new Map(
    ((resolvers ?? []) as Array<{ id: string; email: string | null }>).map((p) => [p.id, p.email])
  );

  return rows.map((r) => ({
    id: r.id,
    mailbox: r.mailbox,
    gmailThreadId: r.gmail_thread_id,
    supplierName: r.supplier_name,
    zdNumber: r.zd_number,
    ocNumber: r.oc_number,
    ocReceivedAt: r.oc_received_at,
    status: r.status,
    priority: (r.priority === 1 || r.priority === 2 ? r.priority : 0) as 0 | 1 | 2,
    summary: r.summary,
    nextStep: r.next_step,
    linesTotal: r.lines_total,
    linesOk: r.lines_ok,
    resolvedAt: r.resolved_at,
    resolvedByName: r.resolved_by ? (resolverEmail.get(r.resolved_by) ?? null) : null,
    resolutionNote: r.resolution_note,
    lines: linesByCheck.get(r.id) ?? [],
  }));
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Dostawca z kartoteki, tylko gdy nazwa wskazuje jednoznacznie jednego. */
async function supplierIdsByName(db: Db, names: string[]): Promise<Map<string, string>> {
  const { data } = await db.from("suppliers").select("id, name");
  const byName = new Map<string, string[]>();
  for (const s of (data ?? []) as Array<{ id: string; name: string }>) {
    const key = normalizeName(s.name);
    byName.set(key, [...(byName.get(key) ?? []), s.id]);
  }
  const out = new Map<string, string>();
  for (const name of names) {
    const ids = byName.get(normalizeName(name));
    if (ids?.length === 1) out.set(name, ids[0]!);
  }
  return out;
}

export type OcImportSummary = { created: number; updated: number };

/**
 * Upsert po source_key. Ponowny import aktualizuje wynik porównania, ale nie rusza decyzji działu
 * (resolved_*), bo te zapadły w OnTime, a nie w źródle.
 */
export async function importOcChecks(db: Db, checks: OcImportCheck[]): Promise<OcImportSummary> {
  const suppliers = await supplierIdsByName(db, [...new Set(checks.map((c) => c.supplier_name))]);
  const { data: existing } = await db
    .from("oc_checks")
    .select("id, source_key")
    .in("source_key", checks.map((c) => c.source_key));
  const existingKeys = new Set(((existing ?? []) as Array<{ source_key: string }>).map((r) => r.source_key));

  const now = new Date().toISOString();
  const { data: saved, error } = await db
    .from("oc_checks")
    .upsert(
      checks.map((c) => ({
        source_key: c.source_key,
        source: "import",
        mailbox: c.mailbox,
        gmail_thread_id: c.gmail_thread_id,
        gmail_message_id: c.gmail_message_id,
        supplier_id: suppliers.get(c.supplier_name) ?? null,
        supplier_name: c.supplier_name,
        zd_number: c.zd_number,
        oc_number: c.oc_number,
        oc_received_at: c.oc_received_at,
        status: c.status,
        priority: c.priority,
        summary: c.summary,
        next_step: c.next_step,
        lines_total: c.lines_total,
        lines_ok: c.lines_ok,
        updated_at: now,
      })),
      { onConflict: "source_key" }
    )
    .select("id, source_key");
  if (error) throw new Error(error.message);

  const idByKey = new Map(((saved ?? []) as Array<{ id: string; source_key: string }>).map((r) => [r.source_key, r.id]));
  const ids = [...idByKey.values()];
  if (ids.length) {
    const { error: deleteError } = await db.from("oc_check_lines").delete().in("check_id", ids);
    if (deleteError) throw new Error(deleteError.message);
  }
  const lineRows = checks.flatMap((c) => {
    const checkId = idByKey.get(c.source_key);
    return checkId ? c.lines.map((l) => ({ ...l, check_id: checkId })) : [];
  });
  if (lineRows.length) {
    const { error: linesError } = await db.from("oc_check_lines").insert(lineRows);
    if (linesError) throw new Error(linesError.message);
  }

  const updated = checks.filter((c) => existingKeys.has(c.source_key)).length;
  return { created: checks.length - updated, updated };
}

export async function setOcCheckResolved(
  db: Db,
  input: { id: string; userId: string; resolved: boolean; note: string }
): Promise<void> {
  const patch = input.resolved
    ? {
        resolved_at: new Date().toISOString(),
        resolved_by: input.userId,
        resolution_note: input.note,
        updated_at: new Date().toISOString(),
      }
    : { resolved_at: null, resolved_by: null, resolution_note: "", updated_at: new Date().toISOString() };
  const { error } = await db.from("oc_checks").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
}
