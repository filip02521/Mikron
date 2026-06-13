import { createHash, randomInt, timingSafeEqual } from "crypto";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  isAuthUserLoginEligible,
  loginDirectoryDisplayName,
} from "@/lib/auth/login-directory";
import { maskEmailForDisplay } from "@/lib/auth/mask-email";
import {
  emailOtpTypeFromVerification,
  passwordSetupConfirmUrl,
} from "@/lib/auth/password-link-redirect";
import { renderPasswordResetOtpEmail } from "@/lib/email/password-reset-email";
import { isEmailConfigured } from "@/lib/env/email-config";
import { isProductionRuntime } from "@/lib/env/app-config";
import { resolveAppUrl } from "@/lib/env/resolve-app-url.server";
import { sendHtmlEmail } from "@/lib/services/email";
import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

import {
  OTP_LENGTH,
  OTP_MAX_SENDS_PER_IP,
  OTP_MAX_SENDS_PER_USER,
  OTP_MAX_SENDS_WINDOW_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "@/lib/auth/password-reset-constants";

export type PasswordResetOtpRow = {
  id: string;
  user_id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  consumed_at: string | null;
  request_ip: string | null;
  created_at: string;
};

export type SendPasswordResetOtpResult =
  | { ok: true; maskedEmail: string; resendAvailableAt: string }
  | { ok: false; error: string; retryAfterSec?: number };

export type VerifyPasswordResetOtpResult =
  | { ok: true; tokenHash: string; otpType: EmailOtpType }
  | { ok: false; error: string; invalidateCode?: boolean };

function otpPepper(): string {
  const secret =
    process.env.PASSWORD_RESET_OTP_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (secret) return secret;

  if (isProductionRuntime()) {
    throw new Error("Brak PASSWORD_RESET_OTP_SECRET w produkcji.");
  }

  return "dev-password-reset-otp-pepper";
}

export function hashPasswordResetOtpCode(code: string, userId: string): string {
  return createHash("sha256")
    .update(`${otpPepper()}:${userId}:${code}`)
    .digest("hex");
}

export function verifyPasswordResetOtpHash(
  code: string,
  userId: string,
  storedHash: string
): boolean {
  const computed = hashPasswordResetOtpCode(code, userId);
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

export function generatePasswordResetOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

export function normalizePasswordResetEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidPasswordResetOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

function retryAfterSeconds(untilMs: number): number {
  return Math.max(1, Math.ceil((untilMs - Date.now()) / 1000));
}

export async function findEligiblePasswordResetUser(
  email: string
): Promise<{ id: string; email: string; displayName: string } | null> {
  if (!hasSupabaseConfig()) return null;

  const normalized = normalizePasswordResetEmail(email);
  if (!normalized) return null;

  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, sales_people(name)")
    .eq("email", normalized)
    .maybeSingle();

  if (profileError || !profile?.id) return null;

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(
    profile.id
  );
  const user = authData.user;
  if (authError || !user || !isAuthUserLoginEligible(user)) return null;

  const salesPerson = Array.isArray(profile.sales_people)
    ? profile.sales_people[0]
    : profile.sales_people;

  return {
    id: user.id,
    email: user.email?.trim().toLowerCase() ?? normalized,
    displayName: loginDirectoryDisplayName({
      email: normalized,
      salesPersonName: salesPerson?.name ?? null,
    }),
  };
}

export async function findEligiblePasswordResetUserByAccountId(
  accountId: string
): Promise<{ id: string; email: string; displayName: string } | null> {
  if (!hasSupabaseConfig()) return null;

  const id = accountId.trim();
  if (!id) return null;

  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(id);
  const user = authData.user;
  if (authError || !user || !isAuthUserLoginEligible(user)) return null;

  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("sales_people(name)")
    .eq("id", id)
    .maybeSingle();

  const salesPerson = Array.isArray(profile?.sales_people)
    ? profile.sales_people[0]
    : profile?.sales_people;

  return {
    id: user.id,
    email,
    displayName: loginDirectoryDisplayName({
      email,
      salesPersonName: salesPerson?.name ?? null,
    }),
  };
}

async function countRecentSends(params: {
  userId?: string;
  requestIp?: string | null;
  sinceIso: string;
}): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from("password_reset_otps")
    .select("id", { count: "exact", head: true })
    .gte("created_at", params.sinceIso);

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  }
  if (params.requestIp) {
    query = query.eq("request_ip", params.requestIp);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function latestOtpCreatedAt(userId: string): Promise<Date | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("password_reset_otps")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.created_at) return null;
  const parsed = Date.parse(data.created_at);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

async function invalidateActiveOtps(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("password_reset_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("consumed_at", null);

  if (error) throw new Error(error.message);
}

async function fetchActiveOtp(userId: string): Promise<PasswordResetOtpRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("password_reset_otps")
    .select("*")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PasswordResetOtpRow | null) ?? null;
}

export async function sendPasswordResetOtp(params: {
  accountId: string;
  requestIp?: string | null;
}): Promise<SendPasswordResetOtpResult> {
  const maskedFallback = "k***@…";

  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Reset hasła jest chwilowo niedostępny." };
  }

  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: "Reset e-mailem jest chwilowo niedostępny. Skontaktuj się z administratorem.",
    };
  }

  let user: Awaited<ReturnType<typeof findEligiblePasswordResetUserByAccountId>> = null;
  try {
    user = await findEligiblePasswordResetUserByAccountId(params.accountId);
  } catch (error) {
    console.error("[password-reset] eligibility failed:", error);
    return { ok: false, error: "Nie udało się wysłać kodu. Spróbuj ponownie." };
  }

  const maskedEmail = user ? maskEmailForDisplay(user.email) : maskedFallback;

  if (!user) {
    console.info("[password-reset] send skipped — brak kwalifikującego się konta", {
      accountId: params.accountId,
    });
    return {
      ok: true,
      maskedEmail,
      resendAvailableAt: new Date(Date.now() + OTP_RESEND_COOLDOWN_MS).toISOString(),
    };
  }

  const sinceIso = new Date(Date.now() - OTP_MAX_SENDS_WINDOW_MS).toISOString();
  const [userSendCount, ipSendCount, lastCreatedAt] = await Promise.all([
    countRecentSends({ userId: user.id, sinceIso }),
    params.requestIp
      ? countRecentSends({ requestIp: params.requestIp, sinceIso })
      : Promise.resolve(0),
    latestOtpCreatedAt(user.id),
  ]);

  if (userSendCount >= OTP_MAX_SENDS_PER_USER) {
    return {
      ok: false,
      error: "Zbyt wiele prób resetu. Spróbuj ponownie za kilka minut.",
      retryAfterSec: Math.ceil(OTP_MAX_SENDS_WINDOW_MS / 1000),
    };
  }

  if (params.requestIp && ipSendCount >= OTP_MAX_SENDS_PER_IP) {
    return {
      ok: false,
      error: "Zbyt wiele prób resetu z tej sieci. Spróbuj ponownie za chwilę.",
      retryAfterSec: Math.ceil(OTP_MAX_SENDS_WINDOW_MS / 1000),
    };
  }

  if (lastCreatedAt) {
    const cooldownUntil = lastCreatedAt.getTime() + OTP_RESEND_COOLDOWN_MS;
    if (Date.now() < cooldownUntil) {
      return {
        ok: false,
        error: "Poczekaj chwilę przed ponowną wysyłką kodu.",
        retryAfterSec: retryAfterSeconds(cooldownUntil),
      };
    }
  }

  const code = generatePasswordResetOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const supabase = createAdminClient();

  await invalidateActiveOtps(user.id);

  const { error: insertError } = await supabase.from("password_reset_otps").insert({
    user_id: user.id,
    email: user.email,
    code_hash: hashPasswordResetOtpCode(code, user.id),
    expires_at: expiresAt,
    request_ip: params.requestIp ?? null,
  });

  if (insertError) {
    console.error("[password-reset] insert failed:", insertError.message);
    return { ok: false, error: "Nie udało się wysłać kodu. Spróbuj ponownie." };
  }

  const { subject, html } = renderPasswordResetOtpEmail({
    recipientName: user.displayName,
    code,
    validMinutes: OTP_TTL_MS / 60_000,
  });

  const sendResult = await sendHtmlEmail({
    to: user.email,
    subject,
    html,
  });

  if (!sendResult.ok) {
    await supabase
      .from("password_reset_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("consumed_at", null);

    console.error("[password-reset] email failed:", sendResult.error, { to: maskedEmail });
    return { ok: false, error: "Nie udało się wysłać kodu e-mailem. Spróbuj ponownie." };
  }

  console.info("[password-reset] code sent", {
    userId: user.id,
    email: maskedEmail,
    requestIp: params.requestIp ?? null,
  });

  return {
    ok: true,
    maskedEmail,
    resendAvailableAt: new Date(Date.now() + OTP_RESEND_COOLDOWN_MS).toISOString(),
  };
}

export async function verifyPasswordResetOtp(params: {
  accountId: string;
  code: string;
}): Promise<VerifyPasswordResetOtpResult> {
  const code = params.code.trim();

  if (!params.accountId.trim() || !isValidPasswordResetOtpCode(code)) {
    return { ok: false, error: "Nieprawidłowy kod. Sprawdź e-mail lub wyślij kod ponownie." };
  }

  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Reset hasła jest chwilowo niedostępny." };
  }

  const user = await findEligiblePasswordResetUserByAccountId(params.accountId);
  if (!user) {
    return { ok: false, error: "Nieprawidłowy kod. Sprawdź e-mail lub wyślij kod ponownie." };
  }

  const row = await fetchActiveOtp(user.id);
  if (!row) {
    return { ok: false, error: "Kod wygasł. Wyślij nowy kod." };
  }

  if (Date.parse(row.expires_at) <= Date.now()) {
    await markOtpConsumed(row.id);
    return { ok: false, error: "Kod wygasł. Wyślij nowy kod.", invalidateCode: true };
  }

  if (row.attempts >= row.max_attempts) {
    await markOtpConsumed(row.id);
    return {
      ok: false,
      error: "Zbyt wiele błędnych prób. Wyślij nowy kod.",
      invalidateCode: true,
    };
  }

  if (!verifyPasswordResetOtpHash(code, user.id, row.code_hash)) {
    const supabase = createAdminClient();
    const nextAttempts = row.attempts + 1;
    await supabase
      .from("password_reset_otps")
      .update({ attempts: nextAttempts })
      .eq("id", row.id);

    if (nextAttempts >= row.max_attempts) {
      await markOtpConsumed(row.id);
      return {
        ok: false,
        error: "Zbyt wiele błędnych prób. Wyślij nowy kod.",
        invalidateCode: true,
      };
    }

    return { ok: false, error: "Nieprawidłowy kod. Sprawdź e-mail lub wyślij kod ponownie." };
  }

  await markOtpConsumed(row.id);

  const supabase = createAdminClient();
  const appUrl = await resolveAppUrl();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
    options: {
      redirectTo: passwordSetupConfirmUrl(appUrl),
    },
  });

  if (error || !data.properties?.hashed_token) {
    console.error("[password-reset] generateLink failed:", error?.message);
    return { ok: false, error: "Nie udało się przygotować resetu hasła. Spróbuj ponownie." };
  }

  console.info("[password-reset] code verified", {
    userId: user.id,
    email: maskEmailForDisplay(user.email),
  });

  return {
    ok: true,
    tokenHash: data.properties.hashed_token,
    otpType: emailOtpTypeFromVerification(data.properties.verification_type),
  };
}

async function markOtpConsumed(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("password_reset_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
