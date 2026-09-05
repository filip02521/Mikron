/**
 * @deprecated Supabase Management API nie jest używane.
 * Zastąpione przez: npm run db:migrate
 */
console.error(
  "apply-migration-supabase-mgmt.ts zostało wycofane.\n" +
    "Użyj: npm run db:migrate  (lub DATABASE_URL=.../ontime_staging npm run db:migrate:staging)"
);
process.exit(1);
