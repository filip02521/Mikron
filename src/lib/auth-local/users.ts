import { randomUUID } from "crypto";
import { query } from "@/lib/db/pool";

export interface AppUser {
  id: string;
  email: string;
  passwordHash: string;
  emailConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AppUserRow {
  id: string;
  email: string;
  password_hash: string;
  email_confirmed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const SELECT_COLUMNS =
  "id, email, password_hash, email_confirmed_at, created_at, updated_at";

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function mapUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    emailConfirmedAt: toDate(row.email_confirmed_at),
    createdAt: toDate(row.created_at) ?? new Date(0),
    updatedAt: toDate(row.updated_at) ?? new Date(0),
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const { rows } = await query<AppUserRow>(
    `SELECT ${SELECT_COLUMNS} FROM app_users WHERE lower(email) = $1 LIMIT 1`,
    [normalized]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  if (!id?.trim()) return null;

  const { rows } = await query<AppUserRow>(
    `SELECT ${SELECT_COLUMNS} FROM app_users WHERE id = $1 LIMIT 1`,
    [id.trim()]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function createAppUser(params: {
  id?: string;
  email: string;
  passwordHash: string;
  emailConfirmedAt?: Date | null;
}): Promise<AppUser> {
  const { rows } = await query<AppUserRow>(
    `INSERT INTO app_users (id, email, password_hash, email_confirmed_at)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_COLUMNS}`,
    [
      params.id?.trim() || randomUUID(),
      normalizeEmail(params.email),
      params.passwordHash,
      params.emailConfirmedAt?.toISOString() ?? null,
    ]
  );
  return mapUser(rows[0]);
}

export async function updatePassword(
  userId: string,
  passwordHash: string
): Promise<AppUser | null> {
  const { rows } = await query<AppUserRow>(
    `UPDATE app_users
        SET password_hash = $2, updated_at = now()
      WHERE id = $1
      RETURNING ${SELECT_COLUMNS}`,
    [userId, passwordHash]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function confirmUserEmail(userId: string): Promise<void> {
  await query(
    `UPDATE app_users
        SET email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now()
      WHERE id = $1`,
    [userId]
  );
}

export async function deleteAppUser(userId: string): Promise<void> {
  if (!userId?.trim()) return;
  await query(`DELETE FROM app_users WHERE id = $1`, [userId.trim()]);
}
