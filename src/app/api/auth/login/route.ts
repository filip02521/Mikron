import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, sessionCookieOptions } from "@/lib/auth-local/cookies";
import { verifyPassword } from "@/lib/auth-local/password";
import { createSession } from "@/lib/auth-local/session";
import { findUserByEmail } from "@/lib/auth-local/users";
import {
  ADMIN_PANEL_COOKIE,
  resolveAdminPanelContext,
} from "@/lib/auth/admin-panel-context";
import {
  authRateLimitBucket,
  authRateLimitHttpResponse,
  checkAuthRateLimit,
  recordAuthRateLimitEvent,
  sleepMs,
} from "@/lib/auth/auth-rate-limit";
import { isAdmin, redirectPathAfterLogin } from "@/lib/auth-roles";
import { fetchEnabledAdminModulesForUserId } from "@/lib/admin-modules";
import {
  PROCUREMENT_WORKSPACE_COOKIE,
  buildProcurementWorkspaceCookie,
  grantedProcurementFunctions,
  resolveProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";
import { fetchProfileByUserId } from "@/lib/auth/profile";
import { resolveLoginEmailFromAccountId } from "@/lib/auth/resolve-login-account";
import { translateAuthError } from "@/lib/auth-errors";
import type { UserRole } from "@/types/database";

type LoginBody = {
  accountId?: string;
  email?: string;
  password?: string;
  next?: string | null;
};

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_DELAY_MS = 300;

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Nieprawidłowe żądanie." },
      { status: 400 }
    );
  }

  const password = body.password ?? "";
  const next = body.next ?? null;
  let email = body.email?.trim().toLowerCase() ?? "";
  const ip = clientIp(request);

  if (body.accountId?.trim()) {
    const resolved = await resolveLoginEmailFromAccountId(body.accountId.trim());
    if (!resolved) {
      await sleepMs(LOGIN_FAIL_DELAY_MS);
      if (ip) {
        await recordAuthRateLimitEvent({
          bucketKey: authRateLimitBucket("login:ip", ip),
        });
      }
      return NextResponse.json(
        { ok: false as const, error: translateAuthError("Invalid login credentials") },
        { status: 401 }
      );
    }
    email = resolved.email;
  }

  if (!email || !password) {
    return NextResponse.json(
      { ok: false as const, error: "Podaj e-mail i hasło." },
      { status: 400 }
    );
  }

  if (ip) {
    const ipLimit = await checkAuthRateLimit({
      bucketKey: authRateLimitBucket("login:ip", ip),
      maxEvents: 10,
      windowMs: LOGIN_WINDOW_MS,
    });
    if (!ipLimit.ok) {
      const limited = authRateLimitHttpResponse(ipLimit);
      return NextResponse.json(
        { ok: false as const, error: limited.error },
        { status: limited.status }
      );
    }
  }

  const emailLimit = await checkAuthRateLimit({
    bucketKey: authRateLimitBucket("login:email", email),
    maxEvents: 5,
    windowMs: LOGIN_WINDOW_MS,
  });
  if (!emailLimit.ok) {
    const limited = authRateLimitHttpResponse(emailLimit);
    return NextResponse.json(
      { ok: false as const, error: limited.error },
      { status: limited.status }
    );
  }

  const user = await findUserByEmail(email);
  const passwordOk = user
    ? await verifyPassword(password, user.passwordHash)
    : false;

  if (!user || !passwordOk) {
    await sleepMs(LOGIN_FAIL_DELAY_MS);
    if (ip) {
      await recordAuthRateLimitEvent({
        bucketKey: authRateLimitBucket("login:ip", ip),
      });
    }
    await recordAuthRateLimitEvent({
      bucketKey: authRateLimitBucket("login:email", email),
    });
    return NextResponse.json(
      { ok: false as const, error: translateAuthError("Invalid login credentials") },
      { status: 401 }
    );
  }

  const userId = user.id;

  const profile = await fetchProfileByUserId(userId);
  if (!profile) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "Brak profilu użytkownika — skontaktuj się z administratorem.",
      },
      { status: 403 }
    );
  }

  const { rawToken, expiresAt } = await createSession(userId, {
    userAgent: request.headers.get("user-agent"),
    ip,
  });

  let redirectTo: string;
  if (profile.must_change_password) {
    redirectTo = "/ustaw-haslo?wymagane=1";
  } else {
    const role = profile.role as UserRole;
    const adminPanelContext = isAdmin(role)
      ? resolveAdminPanelContext(request.cookies.get(ADMIN_PANEL_COOKIE)?.value)
      : null;
    const adminModules = isAdmin(role)
      ? []
      : await fetchEnabledAdminModulesForUserId(userId);
    redirectTo = redirectPathAfterLogin(role, next, {
      adminPanelContext,
      procurementWorkspace: resolveProcurementWorkspace(
        role,
        request.cookies.get(PROCUREMENT_WORKSPACE_COOKIE)?.value,
        profile.assigned_workspaces
      ),
      workspaces: profile.assigned_workspaces,
      adminModules,
    });
  }

  const jsonResponse = NextResponse.json({ ok: true as const, redirectTo, accountId: userId });
  jsonResponse.cookies.set(COOKIE_NAME, rawToken, {
    ...sessionCookieOptions(),
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });

  if (!profile.must_change_password) {
    const role = profile.role as UserRole;
    if (grantedProcurementFunctions(role, profile.assigned_workspaces).length > 0) {
      const workspace = resolveProcurementWorkspace(
        role,
        request.cookies.get(PROCUREMENT_WORKSPACE_COOKIE)?.value,
        profile.assigned_workspaces
      );
      if (workspace) {
        jsonResponse.cookies.set(buildProcurementWorkspaceCookie(workspace));
      }
    }
  }

  return jsonResponse;
}
