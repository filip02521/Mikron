"use server";

import { requireAdmin } from "@/lib/auth";
import { getSubiektConfigSummary } from "@/lib/subiekt/config";
import { testSubiektConnection, type SubiektHealthResult } from "@/lib/subiekt/client";

export async function actionGetSubiektStatus() {
  await requireAdmin();
  return getSubiektConfigSummary();
}

export async function actionTestSubiektConnection(): Promise<SubiektHealthResult> {
  await requireAdmin();
  return testSubiektConnection();
}
