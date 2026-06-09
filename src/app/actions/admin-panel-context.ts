"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  ADMIN_PANEL_COOKIE,
  type AdminPanelContext,
  homePathForAdminPanelContext,
  parseAdminPanelContext,
} from "@/lib/auth/admin-panel-context";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setPanelCookie(context: AdminPanelContext) {
  return {
    name: ADMIN_PANEL_COOKIE,
    value: context,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function actionSetAdminPanelContext(context: AdminPanelContext) {
  await requireAdmin();
  if (!parseAdminPanelContext(context)) {
    throw new Error("Nieprawidłowy kontekst panelu");
  }
  const cookieStore = await cookies();
  cookieStore.set(setPanelCookie(context));
  redirect(homePathForAdminPanelContext(context));
}

export async function actionClearAdminPanelContext() {
  const user = await requireAdmin().catch(() => null);
  if (!user) return;
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_PANEL_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
