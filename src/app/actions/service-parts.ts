"use server";

import { revalidatePath } from "next/cache";
import { requireServicePanel } from "@/lib/auth";
import { reportServicePartShortage } from "@/lib/data/service-part-report";
import { parseServicePartReport, type ServicePartReportInput } from "@/lib/orders/service-part-report";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { fetchServicePartTwIds, resolveServicePartsCecha } from "@/lib/data/service-parts";
import { fetchZdEstimateMinStockOne, upsertZdEstimateMinStock } from "@/lib/data/zd-estimate-min-stock";
import { getSubiektProduct } from "@/lib/subiekt/api";

/** Najwyższe minimum, które serwisant może ustawić na Częściach (wyżej — w Kreatorze ZD). */
const SERVICE_MIN_STOCK_MAX = 500;

export type ServicePartReportResult = { ok: true; message: string } | { ok: false; message: string };

export async function actionReportServicePartShortage(
  input: ServicePartReportInput
): Promise<ServicePartReportResult> {
  const user = await requireServicePanel("mutate");
  const parsed = parseServicePartReport(input);
  if (!parsed.ok) return parsed;
  try {
    const res = await reportServicePartShortage(parsed, user);
    if (res.ok) revalidatePath("/serwis");
    return res;
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zgłosić braku. Spróbuj ponownie.") };
  }
}

/**
 * Minimum części na stanie z ekranu Części: silnik ZD (Kreator i Automat) dokupi do niego sam
 * (minimum − dostępne − otwarte ZD), bez prośby. 0 = bez minimum — część wraca do „tylko po zgłoszeniu”.
 * Tylko towar z cechą „Części serwisowe”; nazwa i grupa z Subiekta, nie z przeglądarki.
 */
/** Notatka minimum zapisanego z panelu serwisu — po niej poznajemy, czyje jest minimum. */
const SERVICE_MIN_NOTE_PREFIX = "Serwis:";

export async function actionSetServicePartMinStock(input: { twId: number; minStock: number }): Promise<ServicePartReportResult> {
  const user = await requireServicePanel("mutate");
  const twId = Math.trunc(Number(input.twId));
  const min = Number(input.minStock);
  if (!Number.isSafeInteger(twId) || twId <= 0) return { ok: false, message: "Wybierz część z listy." };
  if (!Number.isInteger(min) || min < 0 || min > SERVICE_MIN_STOCK_MAX) {
    return { ok: false, message: `Minimum: liczba całkowita od 0 do ${SERVICE_MIN_STOCK_MAX} szt.` };
  }
  try {
    const cecha = await resolveServicePartsCecha();
    if (!cecha || !(await fetchServicePartTwIds(cecha.cechaId)).includes(twId)) {
      return { ok: false, message: "To nie jest część serwisowa — minimum ustawiają zakupy w Kreatorze ZD." };
    }
    // Minimum ustawione przez zakupy (notatka bez „Serwis:”) zostaje ich — serwis go nie nadpisuje ani nie kasuje.
    const existing = await fetchZdEstimateMinStockOne(twId);
    if (existing && !existing.note.startsWith(SERVICE_MIN_NOTE_PREFIX)) {
      return {
        ok: false,
        message: `Minimum ${existing.minStockSzt} szt. ustawiły zakupy — zmienić je mogą zakupy w Kreatorze ZD.`,
      };
    }
    const p = await getSubiektProduct(twId);
    const name = p.tw_Nazwa?.trim() || p.tw_Symbol?.trim() || `Towar ${twId}`;
    await upsertZdEstimateMinStock({
      subiektTwId: twId,
      twSymbol: p.tw_Symbol ?? null,
      twNazwa: name,
      grtId: p.tw_IdGrupa ?? null,
      grtNazwa: p.grt_Nazwa ?? null,
      minStockSzt: min,
      note: `${SERVICE_MIN_NOTE_PREFIX} ${user.email.split("@")[0]}`,
      createdBy: user.id === "dev" ? null : user.id,
    });
    revalidatePath("/serwis");
    return {
      ok: true,
      message: min > 0 ? `${name}: minimum ${min} szt. — zakupy dokupią przy najbliższym ZD.` : `${name}: bez minimum — zamawiane tylko po zgłoszeniu.`,
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zapisać minimum. Spróbuj ponownie.") };
  }
}
