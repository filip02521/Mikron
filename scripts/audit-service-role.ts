/**
 * Wymaga adnotacji @service-role-ok w plikach server actions używających createAdminClient().
 * Użycie: npx tsx scripts/audit-service-role.ts
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ACTIONS_DIR = join(process.cwd(), "src/app/actions");
const TAG = "@service-role-ok";

const EXCLUDED_FILES = [
  "src/app/actions/admin-panel-context.ts",
  "src/app/actions/sales-onboarding.ts",
  "src/app/actions/my-orders.ts",
];

function listActionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listActionFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = listActionFiles(ACTIONS_DIR).filter(
    (f) => !EXCLUDED_FILES.some((ex) => f.endsWith(ex))
  );
  const findings: string[] = [];

  for (const file of files) {
    const rel = file.replace(process.cwd() + "/", "");
    const content = readFileSync(file, "utf-8");
    if (!content.includes("createAdminClient")) continue;
    if (!content.includes(TAG)) {
      findings.push(rel);
    }
  }

  if (!findings.length) {
    console.log(`✓ Wszystkie server actions z createAdminClient() mają ${TAG}.`);
    return;
  }

  console.log(`Pliki bez ${TAG} (dodaj komentarz z uzasadnieniem):\n`);
  for (const line of findings.sort()) {
    console.log(`  • ${line}`);
  }
  process.exitCode = 1;
}

main();
