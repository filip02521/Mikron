/**
 * Decyzje karty „Sprzęt klienta” (migracja 215) między bazami: eksport z jednej, import do drugiej.
 * Typowo: serwisant rozstrzygnął pytania na lokalnym dev, a te same decyzje mają trafić na produkcję.
 *
 *   npx tsx scripts/service-equipment-decisions.ts export <plik.json>   — z bazy DATABASE_URL do pliku
 *   npx tsx scripts/service-equipment-decisions.ts import <plik.json>   — z pliku do bazy DATABASE_URL
 *
 * Import nie nadpisuje decyzji, które baza docelowa już ma (ta baza wygrywa), i pomija autora (konta różnią się między
 * bazami). Plik zawiera numery seryjne sprzętu klientów — nie zapisuj go w repozytorium (jest publiczne): skrypt odmawia
 * ścieżki wewnątrz katalogu projektu.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { Client } from "pg";
import { requireDatabaseUrl } from "./lib/db-client";

type ModelRow = { tw_id: number; symbol: string | null; name: string; is_device: boolean };
type AssignmentRow = { doc_id: number; serial_key: string; serial: string; tw_id: number | null };
type Dump = { version: 1; exportedAt: string; models: ModelRow[]; assignments: AssignmentRow[] };

function outsideRepo(file: string): string {
  const abs = resolve(file);
  const rel = relative(process.cwd(), abs);
  if (!rel.startsWith("..") && !isAbsolute(rel)) throw new Error(`Plik ${file} jest w katalogu projektu — podaj ścieżkę poza repozytorium.`);
  return abs;
}

function validDump(raw: unknown): Dump {
  const d = raw as Partial<Dump>;
  const int = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0;
  if (d?.version !== 1 || !Array.isArray(d.models) || !Array.isArray(d.assignments)) throw new Error("To nie jest plik decyzji (version 1).");
  for (const m of d.models) if (!int(m.tw_id) || typeof m.name !== "string" || typeof m.is_device !== "boolean") throw new Error(`Zły wpis modelu: ${JSON.stringify(m)}`);
  for (const a of d.assignments)
    if (!int(a.doc_id) || !a.serial_key || typeof a.serial !== "string" || !(a.tw_id === null || int(a.tw_id))) throw new Error(`Zły wpis numeru: ${JSON.stringify(a)}`);
  return d as Dump;
}

async function main() {
  const [mode, file] = process.argv.slice(2);
  if ((mode !== "export" && mode !== "import") || !file) throw new Error("Użycie: export|import <plik.json> (poza katalogiem projektu)");
  const path = outsideRepo(file);
  const c = new Client({ connectionString: requireDatabaseUrl() });
  await c.connect();
  try {
    if (mode === "export") {
      const models = (await c.query<ModelRow>(`SELECT tw_id, symbol, name, is_device FROM service_device_models ORDER BY tw_id`)).rows;
      const assignments = (await c.query<AssignmentRow>(`SELECT doc_id, serial_key, serial, tw_id FROM service_serial_assignments ORDER BY doc_id, serial_key`)).rows;
      const dump: Dump = { version: 1, exportedAt: new Date().toISOString(), models, assignments };
      writeFileSync(path, JSON.stringify(dump, null, 2));
      console.log(`OK: ${models.length} decyzji o modelach i ${assignments.length} przypisań numerów → ${path}`);
      return;
    }
    const dump = validDump(JSON.parse(readFileSync(path, "utf-8")));
    await c.query("BEGIN");
    let models = 0;
    let assignments = 0;
    for (const m of dump.models) {
      const r = await c.query(
        `INSERT INTO service_device_models (tw_id, symbol, name, is_device) VALUES ($1, $2, $3, $4) ON CONFLICT (tw_id) DO NOTHING`,
        [m.tw_id, m.symbol, m.name, m.is_device]
      );
      models += r.rowCount ?? 0;
    }
    for (const a of dump.assignments) {
      const r = await c.query(
        `INSERT INTO service_serial_assignments (doc_id, serial_key, serial, tw_id) VALUES ($1, $2, $3, $4) ON CONFLICT (doc_id, serial_key) DO NOTHING`,
        [a.doc_id, a.serial_key, a.serial, a.tw_id]
      );
      assignments += r.rowCount ?? 0;
    }
    await c.query("COMMIT");
    console.log(
      `OK: dodano ${models}/${dump.models.length} decyzji o modelach i ${assignments}/${dump.assignments.length} przypisań (reszta już była w bazie).`
    );
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
