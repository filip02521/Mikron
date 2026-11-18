import { query } from "@/lib/db/pool";

/**
 * Decyzje serwisu dla karty „Sprzęt klienta” (migracja 215): czy model jest urządzeniem i do którego towaru na
 * dokumencie należy numer seryjny. Model z katalogu serwisu (zlecenie, lista części, okres gwarancji) jest urządzeniem
 * z definicji — ktoś go już przyjął albo skonfigurował; wpis „Nie” w `service_device_models` ma pierwszeństwo.
 */
export async function fetchDeviceModelDecisions(): Promise<Map<number, boolean>> {
  const [catalog, decided] = await Promise.all([
    query<{ tw_id: number }>(
      `SELECT device_tw_id AS tw_id FROM service_orders WHERE device_tw_id IS NOT NULL
       UNION SELECT model_tw_id FROM service_model_parts
       UNION SELECT model_tw_id FROM service_model_warranty`
    ),
    query<{ tw_id: number; is_device: boolean }>(`SELECT tw_id, is_device FROM service_device_models`),
  ]);
  const out = new Map<number, boolean>();
  for (const r of catalog.rows) out.set(Number(r.tw_id), true);
  for (const r of decided.rows) out.set(Number(r.tw_id), r.is_device);
  return out;
}

/** Przypisania numerów dla dokumentów: klucz `${docId}|${serialKey}` → tw_Id albo null („do żadnej pozycji”). */
export async function fetchSerialAssignments(docIds: readonly number[]): Promise<Map<string, number | null>> {
  const ids = [...new Set(docIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) return new Map();
  const res = await query<{ doc_id: number; serial_key: string; tw_id: number | null }>(
    `SELECT doc_id, serial_key, tw_id FROM service_serial_assignments WHERE doc_id = ANY($1::int[])`,
    [ids]
  );
  return new Map(res.rows.map((r) => [`${r.doc_id}|${r.serial_key}`, r.tw_id == null ? null : Number(r.tw_id)]));
}

export async function saveDeviceModelDecision(
  input: { twId: number; symbol: string | null; name: string; isDevice: boolean },
  userId: string | null
): Promise<void> {
  await query(
    `INSERT INTO service_device_models (tw_id, symbol, name, is_device, decided_at, decided_by)
     VALUES ($1, $2, $3, $4, now(), $5)
     ON CONFLICT (tw_id) DO UPDATE SET symbol = EXCLUDED.symbol, name = EXCLUDED.name, is_device = EXCLUDED.is_device,
       decided_at = now(), decided_by = EXCLUDED.decided_by`,
    [input.twId, input.symbol, input.name, input.isDevice, userId]
  );
}

/** Numer → towar na dokumencie; wskazanie towaru to też decyzja „ten model jest urządzeniem”. */
export async function saveSerialAssignment(
  input: { docId: number; serial: string; serialKey: string; model: { twId: number; symbol: string | null; name: string } | null },
  userId: string | null
): Promise<void> {
  await query(
    `INSERT INTO service_serial_assignments (doc_id, serial_key, serial, tw_id, decided_at, decided_by)
     VALUES ($1, $2, $3, $4, now(), $5)
     ON CONFLICT (doc_id, serial_key) DO UPDATE SET serial = EXCLUDED.serial, tw_id = EXCLUDED.tw_id, decided_at = now(),
       decided_by = EXCLUDED.decided_by`,
    [input.docId, input.serialKey, input.serial, input.model?.twId ?? null, userId]
  );
  if (input.model) await saveDeviceModelDecision({ ...input.model, isDevice: true }, userId);
}
