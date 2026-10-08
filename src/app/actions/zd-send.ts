"use server";

// Wysyłka ZD do dostawcy — kroki po mailu (termin realizacji, Główne tylko dla próśb z ZD).
// @service-role-ok — autoryzacja requireZdEstimateAdmin(); service role po warstwie aplikacji.
import { requireZdEstimateAdmin } from "@/lib/auth";
import { requestsCoveredByZd, type ZdSendRequest } from "@/lib/orders/zd-send-plan";
import { setSubiektOrdersZdTermin } from "@/lib/subiekt/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSupplierZd } from "@/lib/supplier-forms/prepare";
import { findSupplierFormTemplate } from "@/lib/supplier-forms/templates";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ZdSendPlan =
  | {
      ok: true;
      dokNr: string;
      /** Termin realizacji na ZD teraz (YYYY-MM-DD) i dzisiejsza data — różne = przed wydrukiem wraca na dziś. */
      termin: string | null;
      today: string;
      /** Dostawca dostaje swój formularz, nie wydruk ZD — termin na wydruku nie ma znaczenia. */
      usesSupplierForm: boolean;
      /** Prośby, których produkt jest w ZD — tylko te zostaną oznaczone jako Główne. */
      inZd: ZdSendRequest[];
      /** Prośby bez swojego produktu w ZD — zostają nietknięte. */
      notInZd: ZdSendRequest[];
    }
  | { ok: false; message: string };

/**
 * Co zrobi wysyłka dla tego ZD: aktualny termin i podział próśb na te z produktem w ZD i bez niego.
 * Czyta ZD prosto z Subiekta — po dopisaniu pozycji w Subiekcie wystarczy zawołać ponownie.
 */
export async function actionZdSendPlan(input: {
  dokId: number;
  supplierId: string;
  catalogOrderIds: string[];
}): Promise<ZdSendPlan> {
  await requireZdEstimateAdmin("read");
  const dokId = Math.trunc(Number(input.dokId));
  if (!(dokId > 0)) return { ok: false, message: "Brak numeru ZD." };
  try {
    const zd = await loadSupplierZd({ dokId, supplierId: String(input.supplierId ?? "") });
    if (!zd.ok) return zd;
    // Tylko poprawne id próśb (uuid) — śmieci z klienta nie mogą wywrócić zapytania.
    const ids = [
      ...new Set((input.catalogOrderIds ?? []).map((id) => String(id ?? "").trim()).filter((id) => UUID_RE.test(id))),
    ].slice(0, 500);
    let requests: ZdSendRequest[] = [];
    if (ids.length) {
      const { data, error } = await createAdminClient()
        .from("individual_orders")
        .select("id, subiekt_tw_id, products, symbol, quantity, supplier_id")
        .in("id", ids);
      if (error) return { ok: false, message: error.message };
      requests = ((data ?? []) as Array<{
        id: string;
        subiekt_tw_id: number | null;
        products: string | null;
        symbol: string | null;
        quantity: string | number | null;
        supplier_id: string | null;
      }>)
        .filter((r) => r.supplier_id === zd.supplier.id)
        .map((r) => ({
          orderId: r.id,
          twId: Math.trunc(Number(r.subiekt_tw_id) || 0) || null,
          label: [r.symbol, r.products].filter(Boolean).join(" · ") || "Prośba",
          quantity: r.quantity == null ? null : String(r.quantity),
        }));
    }
    const { inZd, notInZd } = requestsCoveredByZd(requests, zd.lines);
    return {
      ok: true,
      dokNr: zd.dokNr,
      termin: zd.termin ?? null,
      today: todayDateKeyInWarsaw(),
      usesSupplierForm: Boolean(findSupplierFormTemplate(zd.supplier.name)),
      inZd,
      notInZd,
    };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wczytać ZD z Subiekta.") };
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Najdalszy rozsądny termin dostawy — dalej to prawie na pewno pomyłka w dacie. */
const MAX_DAYS_AHEAD = 400;

/**
 * Po wysyłce: termin realizacji ZD = nasza przewidywana dostawa (nie dzisiejsza data z wydruku dla dostawcy).
 * Zwraca termin odczytany z Subiekta po zapisie.
 */
export async function actionSetZdTerminAfterSend(input: {
  dokId: number;
  supplierId: string;
  date: string;
}): Promise<{ ok: true; termin: string } | { ok: false; message: string }> {
  await requireZdEstimateAdmin("mutate");
  const dokId = Math.trunc(Number(input.dokId));
  const date = String(input.date ?? "").trim();
  if (!(dokId > 0)) return { ok: false, message: "Brak numeru ZD." };
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return { ok: false, message: "Podaj termin realizacji w formacie RRRR-MM-DD." };
  }
  const today = todayDateKeyInWarsaw();
  if (date < today) return { ok: false, message: "Termin realizacji nie może być wcześniejszy niż dziś." };
  const daysAhead = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  if (daysAhead > MAX_DAYS_AHEAD) return { ok: false, message: "Termin realizacji jest dalej niż rok - sprawdź datę." };
  try {
    // Ten sam dostawca co w oknie — nie ustawiamy terminu na cudzym ZD.
    const zd = await loadSupplierZd({ dokId, supplierId: String(input.supplierId ?? "") });
    if (!zd.ok) return zd;
    const after = await setSubiektOrdersZdTermin(dokId, date);
    if (after !== date) {
      return { ok: false, message: `Subiekt zapisał termin ${after ?? "pusty"} zamiast ${date}. Sprawdź ZD w Subiekcie.` };
    }
    return { ok: true, termin: after };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się ustawić terminu realizacji w Subiekcie.") };
  }
}
