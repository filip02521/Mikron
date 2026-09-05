import pg from "pg";

/** Lokalny PG (Homebrew / docker) zwykle bez SSL; Supabase / cloud — SSL. */
export function isLocalPostgresUrl(connectionString: string): boolean {
  try {
    const u = new URL(connectionString);
    const host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "postgres" ||
      host.endsWith(".local")
    );
  } catch {
    return /localhost|127\.0\.0\.1/.test(connectionString);
  }
}

export function createVerifyPgClient(connectionString: string): pg.Client {
  const local = isLocalPostgresUrl(connectionString);
  return new pg.Client({
    connectionString,
    ...(local ? {} : { ssl: { rejectUnauthorized: false } }),
  });
}

/** Po cutoverze lokalnym (0002) RLS jest wyłączone — polityki mogą być puste. */
export async function isRlsDisabledOnPublic(
  client: pg.Client
): Promise<boolean> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity = true`
  );
  return Number(rows[0]?.n ?? 0) === 0;
}
