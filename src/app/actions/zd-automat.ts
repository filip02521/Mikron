"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdminForMutation, requireZdEstimateAdmin } from "@/lib/auth";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { warsawCronContext } from "@/lib/time/warsaw-cron";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import { findZdSkuClassTw, runZdSkuClassSync, setZdSkuClassOverride } from "@/lib/data/zd-sku-class-sync";
import { runZdKpiWeekly } from "@/lib/data/zd-kpi-weekly";
import type { ZdAbc, ZdXyz } from "@/lib/orders/zd-automat-contract";

export type ZdAutomatActionResult = { ok: true; message?: string } | { ok: false; message: string };

const PAGE_PATH = "/zakupy/automat";
const ABC = new Set<ZdAbc>(["A", "B", "C"]);
const XYZ = new Set<ZdXyz>(["X", "Y", "Z", "N"]);
const NOTE_MAX = 500;

function fail(e: unknown, fallback: string): { ok: false; message: string } {
  const raw = e instanceof Error ? e.message : String(e);
  return { ok: false, message: userFacingErrorTextFromMessage(raw) || fallback };
}

/** „Przelicz” (admin): klasy, potem KPI minionego tygodnia — w tle po odpowiedzi, jak cron. */
export async function actionStartZdAutomatRecompute(): Promise<ZdAutomatActionResult> {
  try {
    await requireAdminForMutation();
  } catch (e) {
    return fail(e, "Przeliczenie uruchamia tylko administrator.");
  }
  after(async () => {
    try {
      const classes = await runZdSkuClassSync();
      if ("skipped" in classes) return;
      const { ok, error, ...detail } = classes;
      await recordCronRun("zd_sku_class", { ok, detail: { ...detail, manual: true, ...warsawCronContext() }, error });
      const kpi = await runZdKpiWeekly();
      if ("skipped" in kpi) return;
      const { ok: kpiOk, error: kpiError, ...kpiDetail } = kpi;
      await recordCronRun("zd_kpi_weekly", {
        ok: kpiOk,
        detail: { ...kpiDetail, manual: true, ...warsawCronContext() },
        error: kpiError,
      });
    } catch (e) {
      console.error("[zd-automat] przeliczenie", e);
    }
  });
  return { ok: true };
}

function parseClass<T extends string>(raw: unknown, allowed: Set<T>): T | null | undefined {
  if (raw == null || raw === "") return null;
  return allowed.has(raw as T) ? (raw as T) : undefined;
}

/** Ręczne nadpisanie klasy towaru z powodem. Towar musi być w zmapowanym zakresie (wiersz w zd_sku_class). */
export async function actionSetZdSkuClassOverride(input: {
  product: string;
  abc: string;
  xyz: string;
  note: string;
}): Promise<ZdAutomatActionResult> {
  try {
    await requireZdEstimateAdmin("mutate");
    const abc = parseClass(input.abc, ABC);
    const xyz = parseClass(input.xyz, XYZ);
    if (abc === undefined || xyz === undefined) return { ok: false, message: "Nieznana klasa." };
    if (abc == null && xyz == null) return { ok: false, message: "Wybierz klasę ABC albo XYZ do nadpisania." };
    const note = String(input.note ?? "").trim().slice(0, NOTE_MAX);
    if (!note) return { ok: false, message: "Wpisz powód nadpisania — zobaczy go każdy na tej stronie." };
    const tw = await findZdSkuClassTw(String(input.product ?? ""));
    if (!tw) {
      return {
        ok: false,
        message: "Nie ma takiego towaru w zmapowanych zakresach dostawców. Wpisz symbol z Subiekta albo tw_Id.",
      };
    }
    await setZdSkuClassOverride({ twId: tw.twId, abc, xyz, note });
    revalidatePath(PAGE_PATH);
    return { ok: true, message: `Nadpisano klasę: ${tw.symbol ?? tw.twId} ${tw.name}`.trim() };
  } catch (e) {
    return fail(e, "Nie udało się zapisać nadpisania.");
  }
}

export async function actionClearZdSkuClassOverride(twId: number): Promise<ZdAutomatActionResult> {
  try {
    await requireZdEstimateAdmin("mutate");
    const id = Math.trunc(Number(twId));
    if (!(id > 0)) return { ok: false, message: "Nieprawidłowy towar." };
    await setZdSkuClassOverride({ twId: id, abc: null, xyz: null, note: null });
    revalidatePath(PAGE_PATH);
    return { ok: true };
  } catch (e) {
    return fail(e, "Nie udało się usunąć nadpisania.");
  }
}
