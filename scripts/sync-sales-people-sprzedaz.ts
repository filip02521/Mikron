/**
 * Synchronizacja handlowców z arkusza SPRZEDAŻ (IMIĘ, EMAIL).
 * - Aktualizuje e-maile firmowe u kanonicznych kart
 * - Scala duplikaty „Handlowiec / klient” → jedna karta + sales_client_name
 * - Usuwa zbędne karty z importu historii
 *
 * Usage:
 *   npx tsx scripts/sync-sales-people-sprzedaz.ts [ścieżka.csv]           # podgląd
 *   npx tsx scripts/sync-sales-people-sprzedaz.ts [ścieżka.csv] --apply
 */
import { readFileSync, copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./lib/parse-csv";
import {
  normalizeSalesAlias,
  SALES_SHEET_ALIASES,
} from "./lib/sales-person-import";

const DEFAULT_CSV =
  "/Users/Filip/Downloads/System Dostaw v.9 Synchronizacja DK z HI, Częściowa realizacja - SPRZEDAŻ.csv";

function normalizeKey(name: string): string {
  return name.trim().toUpperCase();
}

function resolveCanonicalName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const upper = normalizeKey(trimmed);
  if (SALES_SHEET_ALIASES[upper]) return SALES_SHEET_ALIASES[upper];
  return normalizeSalesAlias(trimmed) ?? trimmed;
}

export function parseSalesPersonAndClient(raw: string): {
  salesName: string;
  clientName: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed.includes("/")) {
    return { salesName: resolveCanonicalName(trimmed), clientName: null };
  }
  const parts = trimmed.split("/").map((p) => p.trim());
  const salesName = resolveCanonicalName(parts[0] ?? "");
  const clientName = parts.slice(1).join(" / ").trim() || null;
  return { salesName, clientName };
}

type CanonicalRow = { name: string; email: string };

function loadSprzedazCsv(path: string): CanonicalRow[] {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const header = rows[0]?.map((c) => c.trim().toUpperCase()) ?? [];
  const nameI = header.findIndex((h) => h === "IMIĘ" || h === "IMIE" || h === "NAME");
  const emailI = header.findIndex((h) => h === "EMAIL" || h === "E-MAIL");
  if (nameI < 0 || emailI < 0) {
    throw new Error(`Brak kolumn IMIĘ / EMAIL w ${path}`);
  }
  const out: CanonicalRow[] = [];
  const seenEmail = new Set<string>();
  for (const row of rows.slice(1)) {
    const name = row[nameI]?.trim();
    const email = row[emailI]?.trim().toLowerCase();
    if (!name || !email) continue;
    if (seenEmail.has(email)) continue;
    seenEmail.add(email);
    out.push({ name, email });
  }
  return out;
}

async function main() {
  const csvPath = process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : DEFAULT_CSV;
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  const canonical = loadSprzedazCsv(csvPath);
  const supabase = createClient(url, key);

  console.log("=== SPRZEDAŻ → handlowcy ===");
  console.log("Źródło:", csvPath);
  console.log("Tryb:", apply ? "ZAPIS" : "PODGLĄD (dodaj --apply)");
  console.log("Kanonicznych z CSV:", canonical.length);
  for (const c of canonical) console.log(`  ${c.name} → ${c.email}`);

  const nameToId = new Map<string, string>();
  const canonicalIds = new Set<string>();

  for (const row of canonical) {
    const key = normalizeKey(row.name);

    const { data: byEmail } = await supabase
      .from("sales_people")
      .select("id, name, email")
      .eq("email", row.email)
      .maybeSingle();

    let targetId = byEmail?.id;

    if (!targetId) {
      const { data: byName } = await supabase
        .from("sales_people")
        .select("id, name, email")
        .ilike("name", row.name);
      const exact = (byName ?? []).find(
        (p) => normalizeKey(p.name) === key || resolveCanonicalName(p.name) === row.name
      );
      targetId = exact?.id;
    }

    if (!targetId) {
      if (!apply) {
        console.log(`[nowy] ${row.name} <${row.email}>`);
        nameToId.set(key, `pending:${row.email}`);
        continue;
      }
      const { data: created, error } = await supabase
        .from("sales_people")
        .insert({ name: row.name, email: row.email })
        .select("id")
        .single();
      if (error) throw error;
      targetId = created!.id;
      console.log(`Utworzono: ${row.name}`);
    } else if (apply) {
      const { error } = await supabase
        .from("sales_people")
        .update({ name: row.name, email: row.email })
        .eq("id", targetId);
      if (error) throw error;
      console.log(`Zaktualizowano: ${row.name} <${row.email}>`);
    } else {
      console.log(`[match] ${row.name} → istniejąca karta ${targetId.slice(0, 8)}…`);
    }

    if (targetId) {
      canonicalIds.add(targetId);
      nameToId.set(key, targetId);
    }
  }

  if (!apply) {
    console.log("\n(Podgląd merge — uruchom z --apply)");
  }

  const { data: allPeople, error: allErr } = await supabase
    .from("sales_people")
    .select("id, name, email");
  if (allErr) throw allErr;

  const merges: {
    from: { id: string; name: string };
    toId: string;
    toName: string;
    clientName: string | null;
    orderCount: number;
  }[] = [];

  for (const person of allPeople ?? []) {
    if (canonicalIds.has(person.id)) continue;

    const { salesName, clientName } = parseSalesPersonAndClient(person.name);
    const toId = nameToId.get(normalizeKey(salesName));
    if (!toId || toId.startsWith("pending:")) {
      console.warn(`  ⚠ Nie mapuje: "${person.name}" → brak karty "${salesName}"`);
      continue;
    }

    const { count } = await supabase
      .from("individual_orders")
      .select("id", { count: "exact", head: true })
      .eq("sales_person_id", person.id);

    merges.push({
      from: { id: person.id, name: person.name },
      toId,
      toName: canonical.find((c) => nameToId.get(normalizeKey(c.name)) === toId)?.name ?? salesName,
      clientName,
      orderCount: count ?? 0,
    });
  }

  console.log("\n=== Scalanie duplikatów ===");
  console.log("Kart do usunięcia:", merges.length);
  let orderMoves = 0;
  for (const m of merges) {
    console.log(
      `  "${m.from.name}" → ${m.toName} (${m.orderCount} zam.)` +
        (m.clientName ? ` · klient: ${m.clientName}` : "")
    );
    orderMoves += m.orderCount;

    if (!apply) continue;

    if (m.orderCount > 0) {
      const { data: orders } = await supabase
        .from("individual_orders")
        .select("id, sales_client_name")
        .eq("sales_person_id", m.from.id);

      for (const o of orders ?? []) {
        const patch: { sales_person_id: string; sales_client_name?: string } = {
          sales_person_id: m.toId,
        };
        if (m.clientName && !o.sales_client_name?.trim()) {
          patch.sales_client_name = m.clientName;
        }
        const { error } = await supabase.from("individual_orders").update(patch).eq("id", o.id);
        if (error) throw error;
      }
    }

    const { error: delErr } = await supabase.from("sales_people").delete().eq("id", m.from.id);
    if (delErr) throw delErr;
  }

  if (apply) {
    try {
      const dataDir = resolve(process.cwd(), "data");
      mkdirSync(dataDir, { recursive: true });
      copyFileSync(csvPath, resolve(dataDir, "sprzedaz.csv"));
    } catch {
      /* opcjonalna kopia */
    }
    const { count } = await supabase
      .from("sales_people")
      .select("id", { count: "exact", head: true });
    console.log("\nGotowe. Kart handlowców w bazie:", count);
    console.log(`Przeniesiono powiązań zamówień: ${orderMoves}`);
  } else {
    console.log(`\nZamówień do przeniesienia: ${orderMoves}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
