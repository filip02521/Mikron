/**
 * Wykrywa server actions z requireAdmin() zamiast requireAdminForMutation().
 * Użycie: npx tsx scripts/audit-admin-mutations.ts
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ACTIONS_DIR = join(process.cwd(), "src/app/actions");

const READ_HINTS = [
  "Fetch",
  "Search",
  "Count",
  "List",
  "Read",
  "Get",
  "Status",
  "Stats",
  "Coverage",
  "Unmapped",
  "Availability",
  "Lookup",
  "Suggest",
  "Enabled",
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

function isLikelyReadOnlyAction(fnName: string): boolean {
  return READ_HINTS.some((hint) => fnName.includes(hint));
}

const EXCLUDED_FILES = ["src/app/actions/admin-panel-context.ts"];

function main() {
  const files = listActionFiles(ACTIONS_DIR).filter(
    (f) => !EXCLUDED_FILES.some((ex) => f.endsWith(ex))
  );
  const findings: string[] = [];

  for (const file of files) {
    const rel = file.replace(process.cwd() + "/", "");
    const content = readFileSync(file, "utf-8");
    const fnRegex = /export async function (action[A-Za-z0-9_]+)/g;
    let match: RegExpExecArray | null;

    while ((match = fnRegex.exec(content)) !== null) {
      const fnName = match[1];
      const start = match.index;
      const nextFn = content.indexOf("export async function", start + 1);
      const body = content.slice(start, nextFn === -1 ? undefined : nextFn);

      if (!body.includes("requireAdmin()")) continue;
      if (body.includes("requireAdminForMutation()")) continue;
      if (isLikelyReadOnlyAction(fnName)) continue;

      findings.push(`${rel} — ${fnName}`);
    }
  }

  if (!findings.length) {
    console.log("✓ Brak oczywistych mutacji z samym requireAdmin().");
    return;
  }

  console.log("Mutacje do przejrzenia (requireAdmin → requireAdminForMutation):\n");
  for (const line of findings.sort()) {
    console.log(`  • ${line}`);
  }
  process.exitCode = 1;
}

main();
