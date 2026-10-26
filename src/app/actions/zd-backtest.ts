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
import { fetchZdSupplierOrderPolicy, upsertZdSupplierOrderPolicy, type ZdAutoLevel, type ZdSupplierOrderPolicyRow } from "@/lib/data/zd-supplier-order-policy";
import { zdBacktestApplyBlock, zdBacktestCycleText } from "@/lib/orders/zd-automat-status";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Backtest automatu dla dostawcy — w tle sam szuka najlepszych ustawień; wynik i postęp czyta actionGetZdBacktestRun. */
export async function actionStartZdBacktest(input: {
  supplierId: string;
}): Promise<{ ok: true; runId: string } | { ok: false; message: string }> {
  try {
    const user = await requireZdEstimateAdmin("mutate");
    const supplierId = String(input.supplierId ?? "").trim();
    if (!UUID.test(supplierId)) return { ok: false, message: "Nieprawidłowy dostawca." };
    if (!(await listZdEstimateSupplierScopesFor(supplierId)).length) {
      return { ok: false, message: "Dostawca nie ma zakresu (grupy albo cechy) w Kreatorze ZD — backtest nie ma czego liczyć." };
    }
    const runId = await createZdBacktestRun({ supplierId, userId: user.id });
    if (runId === "busy") return { ok: false, message: "Liczą się już 3 backtesty — poczekaj, aż któryś skończy." };
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
    const run = await fetchLatestZdBacktestRun(supplierId);
    // Surowy błąd przebiegu (Subiekt, konfiguracja) nie idzie do przeglądarki bez filtra.
    return { ok: true, run: run?.error ? { ...run, error: userFacingErrorTextFromMessage(run.error) || "błąd po stronie serwera" } : run };
  } catch (e) {
    return { ok: false, message: userFacingErrorTextFromMessage(e instanceof Error ? e.message : String(e)) || "Nie udało się odczytać backtestu." };
  }
}

/**
 * Włącza automat (albo przestawia go) na ustawienia znalezione przez ostatni backtest dostawcy — jedyna droga do
 * cyklu i celu automatu. `runId` = przebieg, który człowiek widzi: gdy w międzyczasie policzył się nowszy, nic się
 * nie zapisuje (przycisk obiecywał inne ustawienia). Stopień: co najmniej 1 (propozycje), wyższy zostaje; godzina
 * odcięcia bez zmian.
 */
export async function actionApplyZdBacktestSettings(input: {
  supplierId: string;
  runId: string;
}): Promise<{ ok: true; policy: ZdSupplierOrderPolicyRow; message: string } | { ok: false; message: string }> {
  try {
    const user = await requireZdEstimateAdmin("mutate");
    const supplierId = String(input.supplierId ?? "").trim();
    if (!UUID.test(supplierId)) return { ok: false, message: "Nieprawidłowy dostawca." };
    const runId = String(input.runId ?? "").trim();
    if (!UUID.test(runId)) return { ok: false, message: "Nieprawidłowy backtest." };
    const run = await fetchLatestZdBacktestRun(supplierId);
    if (run && run.id !== runId) {
      return { ok: false, message: "Od otwarcia okna policzył się nowszy backtest - sprawdź jego wynik i włącz jeszcze raz." };
    }
    const b = run && {
      status: run.status,
      verdict: run.result?.verdict.kind ?? null,
      at: run.createdAt,
      params: run.result?.params ?? null,
      version: run.result?.version ?? null,
    };
    const blocked = zdBacktestApplyBlock(b);
    if (blocked || !b?.params) return { ok: false, message: blocked ?? "Za mało danych, żeby dobrać ustawienia." };
    const current = await fetchZdSupplierOrderPolicy(supplierId);
    const { policy, warning } = await upsertZdSupplierOrderPolicy({
      supplierId,
      strategy: "max30_90",
      targetDays: b.params.targetDays,
      cycleDays: b.params.cycleDays,
      autoProposals: true,
      autoLevel: Math.max(1, current.autoLevel) as ZdAutoLevel,
      cutoffTime: current.cutoffTime,
      updatedBy: user.id,
    });
    const settings = `${zdBacktestCycleText(b.params.cycleDays)}, cel ${b.params.targetDays} dni`;
    return {
      ok: true,
      policy,
      message:
        warning ??
        (current.strategy === "classic"
          ? `Automat włączony: ZD ${settings}. Pierwsza propozycja powstanie w nocnym przebiegu.`
          : `Automat przestawiony: ZD ${settings}. Działa od nocnego przebiegu.`),
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorTextFromMessage(e instanceof Error ? e.message : String(e)) || "Nie udało się włączyć automatu." };
  }
}
