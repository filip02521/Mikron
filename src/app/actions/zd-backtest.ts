"use server";

import { after } from "next/server";
import { requireZdEstimateAdmin } from "@/lib/auth";
import { listZdEstimateSupplierScopesFor } from "@/lib/data/zd-estimate-supplier-scopes";
import {
  createZdBacktestRun,
  fetchLatestZdBacktestRun,
  runZdBacktest,
  type ZdBacktestRun,
} from "@/lib/data/zd-backtest-run";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const int = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

/** Backtest automatu dla dostawcy — w tle; wynik i postęp czyta actionGetZdBacktestRun. */
export async function actionStartZdBacktest(input: {
  supplierId: string;
  targetDays: number;
  cycleDays: number;
}): Promise<{ ok: true; runId: string } | { ok: false; message: string }> {
  try {
    const user = await requireZdEstimateAdmin("mutate");
    const supplierId = String(input.supplierId ?? "").trim();
    if (!UUID.test(supplierId)) return { ok: false, message: "Nieprawidłowy dostawca." };
    const targetDays = int(input.targetDays, 1, 180);
    const cycleDays = int(input.cycleDays, 1, 60);
    if (targetDays == null) return { ok: false, message: "Cel: liczba dni od 1 do 180." };
    if (cycleDays == null) return { ok: false, message: "Co ile dni: od 1 do 60." };
    if (!(await listZdEstimateSupplierScopesFor(supplierId)).length) {
      return { ok: false, message: "Dostawca nie ma zakresu (grupy albo cechy) w Kreatorze ZD — backtest nie ma czego liczyć." };
    }
    const runId = await createZdBacktestRun({ supplierId, params: { targetDays, cycleDays }, userId: user.id });
    if (!runId) return { ok: false, message: "Backtest tego dostawcy już się liczy — poczekaj na wynik." };
    after(() => runZdBacktest(runId));
    return { ok: true, runId };
  } catch (e) {
    return { ok: false, message: userFacingErrorTextFromMessage(e instanceof Error ? e.message : String(e)) || "Nie udało się uruchomić backtestu." };
  }
}

export async function actionGetZdBacktestRun(input: {
  supplierId: string;
}): Promise<{ ok: true; run: ZdBacktestRun | null } | { ok: false; message: string }> {
  try {
    await requireZdEstimateAdmin("read");
    const supplierId = String(input.supplierId ?? "").trim();
    if (!UUID.test(supplierId)) return { ok: false, message: "Nieprawidłowy dostawca." };
    return { ok: true, run: await fetchLatestZdBacktestRun(supplierId) };
  } catch (e) {
    return { ok: false, message: userFacingErrorTextFromMessage(e instanceof Error ? e.message : String(e)) || "Nie udało się odczytać backtestu." };
  }
}
