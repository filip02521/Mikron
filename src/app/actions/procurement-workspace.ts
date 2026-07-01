"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  PROCUREMENT_WORKSPACE_COOKIE,
  buildProcurementWorkspaceCookie,
  homePathForProcurementWorkspace,
  parseProcurementWorkspace,
  hasProcurementFunction,
  type ProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";
import { isAdmin } from "@/lib/auth-roles";

function setWorkspaceCookie(workspace: ProcurementWorkspace) {
  return buildProcurementWorkspaceCookie(workspace);
}

export async function actionSetProcurementWorkspace(workspace: ProcurementWorkspace) {
  const user = await getSessionUser();
  if (!user || isAdmin(user.role)) {
    throw new Error("Brak uprawnień do zmiany obszaru pracy");
  }
  if (!parseProcurementWorkspace(workspace)) {
    throw new Error("Nieprawidłowy obszar pracy");
  }
  if (!hasProcurementFunction(user.role, workspace)) {
    throw new Error("Ten obszar nie jest dostępny na Twoim koncie");
  }

  const cookieStore = await cookies();
  cookieStore.set(setWorkspaceCookie(workspace));
  redirect(homePathForProcurementWorkspace(workspace));
}

export async function actionClearProcurementWorkspace() {
  const user = await getSessionUser();
  if (!user) return;
  const cookieStore = await cookies();
  cookieStore.set({
    name: PROCUREMENT_WORKSPACE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
