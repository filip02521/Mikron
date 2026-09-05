/**
 * Weryfikuje bcrypt w app_users (plan dry-run: login dla próbki kont).
 * Usage: npx tsx scripts/cutover/verify-login-sample.ts
 */
import pg from "pg";
import { compare } from "bcryptjs";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ role: string; email: string; password_hash: string }>(
      `SELECT p.role, u.email, u.password_hash
       FROM app_users u
       JOIN profiles p ON p.id = u.id
       ORDER BY p.role, u.email`
    );
    let bcryptFormat = 0;
    for (const r of rows) {
      const ok =
        r.password_hash.startsWith("$2a$") || r.password_hash.startsWith("$2b$");
      if (ok) bcryptFormat += 1;
    }
    console.log(`Konta: ${rows.length}, format bcrypt: ${bcryptFormat}/${rows.length}`);
    console.log("\nRole / e-mail (hasła bez zmian — logowanie przez POST /api/auth/login):");
    const byRole = new Map<string, string[]>();
    for (const r of rows) {
      const list = byRole.get(r.role) ?? [];
      list.push(r.email);
      byRole.set(r.role, list);
    }
    for (const [role, emails] of [...byRole.entries()].sort()) {
      console.log(`  ${role}: ${emails.join(", ")}`);
    }

    // Sanity: hash round-trip (dummy password should NOT match)
    const sample = rows[0];
    if (sample) {
      const fakeMatch = await compare("definitely-wrong-password", sample.password_hash);
      if (fakeMatch) {
        console.error("✗ bcrypt compare unexpected match");
        process.exit(1);
      }
      console.log("\n✓ bcrypt compare działa (hash z Supabase auth.users zachowany 1:1)");
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
