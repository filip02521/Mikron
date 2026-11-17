"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForMutation } from "@/lib/auth";
import { deleteMikranConnection } from "@/lib/mikran-shop/connection";
import { fetchOpenServiceTickets } from "@/lib/mikran-shop/helpdesk";
import { MikranAuthError } from "@/lib/mikran-shop/oauth";
import { polishPlural } from "@/lib/email/polish-plural";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export type MikranHelpdeskActionResult =
  | { ok: true; message: string }
  /** `reconnect` — sklep odrzucił zapisane połączenie (wygasło / cofnięte), nie chwilowy błąd sieci. */
  | { ok: false; message: string; reconnect?: boolean };

/** „Sprawdź połączenie” — jedno pobranie otwartych zgłoszeń serwisanta tym samym tokenem, którego używa panel serwisu. */
export async function actionTestMikranHelpdesk(): Promise<MikranHelpdeskActionResult> {
  // Jak „Test połączenia” Subiekta: z odświeżeniem tokenu zapisuje w bazie, więc nie w podglądzie innego panelu.
  await requireAdminForMutation();
  try {
    const { mode, tickets } = await fetchOpenServiceTickets();
    if (mode !== "live") return { ok: false, message: "Helpdesk nie jest połączony — panel serwisu pokazuje dane testowe albo nic." };
    return { ok: true, message: `Połączenie działa: ${polishPlural(tickets.length, "otwarte zgłoszenie", "otwarte zgłoszenia", "otwartych zgłoszeń")} serwisanta.` };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się pobrać zgłoszeń z mikran.pl."), reconnect: e instanceof MikranAuthError };
  }
}

/** Odłączenie: usuwa zapisane tokeny; panel serwisu przestaje pobierać zgłoszenia do ponownego połączenia. */
export async function actionDisconnectMikranHelpdesk(): Promise<MikranHelpdeskActionResult> {
  await requireAdminForMutation();
  try {
    await deleteMikranConnection();
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się odłączyć helpdesku.") };
  }
  revalidatePath("/admin");
  revalidatePath("/serwis/zlecenia");
  return { ok: true, message: "Helpdesk mikran.pl odłączony." };
}
