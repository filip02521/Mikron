import { query } from "@/lib/db/pool";

export interface AppUserInvite {
  userId: string;
  salesPersonId: string | null;
  invitedBy: string | null;
  createdAt: Date;
}

interface AppUserInviteRow {
  user_id: string;
  sales_person_id: string | null;
  invited_by: string | null;
  created_at: Date | string;
}

function mapInvite(row: AppUserInviteRow): AppUserInvite {
  return {
    userId: row.user_id,
    salesPersonId: row.sales_person_id,
    invitedBy: row.invited_by,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

export async function upsertInvite(params: {
  userId: string;
  salesPersonId?: string | null;
  invitedBy?: string | null;
}): Promise<AppUserInvite> {
  const { rows } = await query<AppUserInviteRow>(
    `INSERT INTO app_user_invites (user_id, sales_person_id, invited_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET sales_person_id = EXCLUDED.sales_person_id,
           invited_by = EXCLUDED.invited_by
     RETURNING user_id, sales_person_id, invited_by, created_at`,
    [params.userId, params.salesPersonId ?? null, params.invitedBy ?? null]
  );
  return mapInvite(rows[0]);
}

export async function getInvite(userId: string): Promise<AppUserInvite | null> {
  if (!userId?.trim()) return null;

  const { rows } = await query<AppUserInviteRow>(
    `SELECT user_id, sales_person_id, invited_by, created_at
       FROM app_user_invites
      WHERE user_id = $1
      LIMIT 1`,
    [userId.trim()]
  );
  return rows[0] ? mapInvite(rows[0]) : null;
}

export async function deleteInvite(userId: string): Promise<void> {
  if (!userId?.trim()) return;
  await query(`DELETE FROM app_user_invites WHERE user_id = $1`, [userId.trim()]);
}
