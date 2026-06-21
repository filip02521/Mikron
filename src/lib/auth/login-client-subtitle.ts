import type { LoginSubtitleMode } from "@/lib/auth/login-form-copy";
import {
  canShowCachedQuickLogin,
  readLoginRecentAccountIds,
} from "@/lib/auth/login-account-preference";
import { loginFormModeFromParam } from "@/lib/auth/login-initial-mode";

export function resolveClientLoginSubtitleMode(input: {
  preloadedAccountCount: number;
  modeParam: string | null;
}): LoginSubtitleMode {
  if (input.preloadedAccountCount > 0) return "picker";

  const mode = loginFormModeFromParam(input.modeParam);
  if (mode === "email") return "manual";
  if (mode === "picker") return "picker";
  if (canShowCachedQuickLogin()) return "quick";
  if (readLoginRecentAccountIds().length > 0) return "picker";
  return "manual";
}
