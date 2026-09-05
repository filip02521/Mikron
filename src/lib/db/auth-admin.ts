import { randomBytes } from "crypto";
import {
  createAppUser,
  deleteAppUser,
  findUserByEmail,
  findUserById,
  normalizeEmail,
  updatePassword,
  type AppUser,
} from "@/lib/auth-local/users";
import { hashPassword } from "@/lib/auth-local/password";
import { createAuthToken, type AuthTokenType } from "@/lib/auth-local/tokens";
import { upsertInvite } from "@/lib/auth-local/invites";
import { query } from "@/lib/db/pool";
import {
  buildPasswordConfirmLink,
  emailOtpTypeFromVerification,
} from "@/lib/auth/password-link-redirect";
import { getAppUrl } from "@/lib/env/app-config";

type AuthError = { message: string } | null;

function ok<T>(data: T): { data: T; error: AuthError } {
  return { data, error: null };
}

function fail(message: string): { data: null; error: { message: string } } {
  return { data: null, error: { message } };
}

function toAuthUser(user: AppUser, metadata: Record<string, unknown> = {}) {
  return {
    id: user.id,
    email: user.email,
    email_confirmed_at: user.emailConfirmedAt?.toISOString() ?? null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
    is_anonymous: false,
    banned_until: null,
    user_metadata: metadata,
    raw_user_meta_data: metadata,
  };
}

async function metadataFor(userId: string): Promise<Record<string, unknown>> {
  const { rows } = await query<{ sales_person_id: string | null }>(
    `SELECT sales_person_id FROM app_user_invites WHERE user_id = $1`,
    [userId]
  );
  const salesPersonId = rows[0]?.sales_person_id;
  return salesPersonId ? { sales_person_id: salesPersonId } : {};
}

export function createLocalAuthAdmin() {
  return {
    async listUsers(opts?: { page?: number; perPage?: number }) {
      const page = Math.max(1, opts?.page ?? 1);
      const perPage = Math.min(1000, Math.max(1, opts?.perPage ?? 50));
      const offset = (page - 1) * perPage;
      const { rows } = await query<{
        id: string;
        email: string;
        password_hash: string;
        email_confirmed_at: Date | string | null;
        created_at: Date | string;
        updated_at: Date | string;
        sales_person_id: string | null;
      }>(
        `SELECT u.id, u.email, u.password_hash, u.email_confirmed_at, u.created_at, u.updated_at,
                i.sales_person_id
           FROM app_users u
           LEFT JOIN app_user_invites i ON i.user_id = u.id
          ORDER BY u.created_at
          LIMIT $1 OFFSET $2`,
        [perPage, offset]
      );
      const users = rows.map((row) =>
        toAuthUser(
          {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            emailConfirmedAt: row.email_confirmed_at
              ? new Date(row.email_confirmed_at)
              : null,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          },
          row.sales_person_id ? { sales_person_id: row.sales_person_id } : {}
        )
      );
      return ok({ users });
    },

    async getUserById(id: string) {
      const user = await findUserById(id);
      if (!user) return fail("User not found");
      return ok({ user: toAuthUser(user, await metadataFor(user.id)) });
    },

    async createUser(params: {
      email: string;
      password?: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, unknown>;
    }) {
      try {
        const existing = await findUserByEmail(params.email);
        if (existing) return fail("User already registered");
        const password = params.password?.trim() || randomBytes(18).toString("base64url");
        const user = await createAppUser({
          email: params.email,
          passwordHash: await hashPassword(password),
          emailConfirmedAt: params.email_confirm === false ? null : new Date(),
        });
        const salesPersonId = params.user_metadata?.sales_person_id;
        if (typeof salesPersonId === "string" && salesPersonId.trim()) {
          await upsertInvite({
            userId: user.id,
            salesPersonId: salesPersonId.trim(),
          });
        }
        return ok({ user: toAuthUser(user, params.user_metadata ?? {}) });
      } catch (error) {
        return fail(error instanceof Error ? error.message : "createUser failed");
      }
    },

    async updateUserById(
      id: string,
      patch: {
        password?: string;
        email?: string;
        user_metadata?: Record<string, unknown>;
        email_confirm?: boolean;
      }
    ) {
      const user = await findUserById(id);
      if (!user) return fail("User not found");
      if (patch.password) {
        await updatePassword(id, await hashPassword(patch.password));
      }
      if (patch.email) {
        await query(
          `UPDATE app_users SET email = $2, updated_at = now() WHERE id = $1`,
          [id, normalizeEmail(patch.email)]
        );
      }
      if (patch.email_confirm) {
        await query(
          `UPDATE app_users SET email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now() WHERE id = $1`,
          [id]
        );
      }
      const salesPersonId = patch.user_metadata?.sales_person_id;
      if (typeof salesPersonId === "string") {
        await upsertInvite({
          userId: id,
          salesPersonId: salesPersonId.trim() || null,
        });
      }
      const updated = await findUserById(id);
      if (!updated) return fail("User not found");
      return ok({ user: toAuthUser(updated, await metadataFor(id)) });
    },

    async deleteUser(id: string) {
      await deleteAppUser(id);
      return ok({});
    },

    async generateLink(params: {
      type: string;
      email: string;
      options?: { redirectTo?: string; data?: Record<string, unknown> };
    }) {
      const user = await findUserByEmail(params.email);
      if (!user) return fail("User not found");
      const type: AuthTokenType =
        params.type === "invite" || params.type === "signup" ? params.type : "recovery";
      const { rawToken } = await createAuthToken({ userId: user.id, type, ttlHours: 48 });
      const otpType = emailOtpTypeFromVerification(params.type);
      const baseUrl = getAppUrl();
      const next =
        params.options?.redirectTo?.includes("/ustaw-haslo")
          ? "/ustaw-haslo"
          : "/ustaw-haslo";
      return ok({
        properties: {
          hashed_token: rawToken,
          verification_type: params.type,
          action_link: buildPasswordConfirmLink(rawToken, otpType, next, baseUrl),
        },
        user: toAuthUser(user, await metadataFor(user.id)),
      });
    },

    async inviteUserByEmail(email: string) {
      return this.generateLink({ type: "invite", email });
    },
  };
}
