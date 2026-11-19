"use server";

import { revalidatePath } from "next/cache";
import { requireServicePanel } from "@/lib/auth";
import { reportServicePartShortage } from "@/lib/data/service-part-report";
import { parseServicePartReport, type ServicePartReportInput } from "@/lib/orders/service-part-report";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

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
