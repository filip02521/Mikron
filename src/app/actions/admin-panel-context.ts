"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { resolvePreviewSalesPerson } from "@/lib/auth/resolve-preview-sales-person";
import {
  ADMIN_PANEL_COOKIE,
  type AdminPanelContext,
  clearPreviewSalesPersonCookieOptions,
  homePathForAdminPanelContext,
  parseAdminPanelContext,
  previewSalesPersonCookieOptions,
} from "@/lib/auth/admin-panel-context";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setPanelCookie(context: AdminPanelContext) {
  return {
    name: ADMIN_PANEL_COOKIE,
    value: context,
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/**
 * Przełącza kontekst podglądu panelu admina i nawiguje do strony startowej.
 * Po stronie klienta wywołuj przez `runServerActionWithRedirect`.
 */
export async function actionSetAdminPanelContext(context: AdminPanelContext) {
  await requireAdmin();
  if (!parseAdminPanelContext(context)) {
    throw new Error("Nieprawidłowy kontekst panelu");
  }
  const cookieStore = await cookies();
  cookieStore.set(setPanelCookie(context));
  if (context !== "sales") {
    cookieStore.set(clearPreviewSalesPersonCookieOptions());
  }
  redirect(homePathForAdminPanelContext(context));
}

/**
 * Ustawia kontekst handlowca i otwiera jego panel zamówień (podgląd tylko do odczytu).
 * Po stronie klienta wywołuj przez `runServerActionWithRedirect` — `redirect()` rzuca wyjątek.
 */
export async function actionOpenSalesPersonPreview(salesPersonId: string) {
  const user = await requireAdmin();
  const id = salesPersonId?.trim();
  if (!id) {
    throw new Error("Brak identyfikatora handlowca");
  }
  const preview = await resolvePreviewSalesPerson(id, user);
  if (!preview) {
    throw new Error("Nie znaleziono handlowca do podglądu");
  }
  const cookieStore = await cookies();
  cookieStore.set(setPanelCookie("sales"));
  cookieStore.set(previewSalesPersonCookieOptions(preview.id));
  redirect(`/moje?dla=${encodeURIComponent(preview.id)}`);
}

export async function actionClearAdminPanelContext() {
  const user = await requireAdmin().catch(() => null);
  if (!user) return;
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_PANEL_COOKIE,
    value: "",
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set(clearPreviewSalesPersonCookieOptions());
}
