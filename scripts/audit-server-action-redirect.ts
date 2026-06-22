/**
 * Wykrywa klientów, którzy wywołują server actions z redirect() bez runServerActionWithRedirect.
 * Użycie: npx tsx scripts/audit-server-action-redirect.ts
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "src");
const ACTIONS_DIR = join(ROOT, "app/actions");

/** Akcje kończące się redirect() — aktualizuj po dodaniu nowych. */
const REDIRECT_ACTIONS = new Set<string>();

function listFiles(dir: string, ext = ".ts"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full, ext));
    } else if (entry.endsWith(ext) || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function collectRedirectActions(): void {
  for (const file of listFiles(ACTIONS_DIR)) {
    const content = readFileSync(file, "utf-8");
    if (!content.includes("redirect(")) continue;

    const fnRegex = /export async function (action[A-Za-z0-9_]+)/g;
    let match: RegExpExecArray | null;
    while ((match = fnRegex.exec(content)) !== null) {
      const fnName = match[1];
      const start = match.index;
      const nextFn = content.indexOf("export async function", start + 1);
      const body = content.slice(start, nextFn === -1 ? undefined : nextFn);
      if (body.includes("redirect(")) {
        REDIRECT_ACTIONS.add(fnName);
      }
    }
  }
}

function main() {
  collectRedirectActions();

  if (!REDIRECT_ACTIONS.size) {
    console.log("✓ Brak server actions z redirect().");
    return;
  }

  const clientFiles = listFiles(ROOT).filter((file) => {
    const content = readFileSync(file, "utf-8");
    return content.includes('"use client"') || content.includes("'use client'");
  });

  const findings: string[] = [];

  for (const file of clientFiles) {
    const rel = file.replace(process.cwd() + "/", "");
    const content = readFileSync(file, "utf-8");

    for (const actionName of REDIRECT_ACTIONS) {
      if (!content.includes(actionName)) continue;
      if (!content.includes("runServerActionWithRedirect")) {
        findings.push(`${rel} — wywołuje ${actionName} bez runServerActionWithRedirect`);
        continue;
      }
      const directCall = new RegExp(`void\\s+${actionName}\\s*\\(`);
      if (directCall.test(content)) {
        findings.push(`${rel} — bezpośrednie void ${actionName}(…) zamiast runServerActionWithRedirect`);
      }
    }

    if (
      content.includes("isRedirectError") &&
      /isRedirectError\([^)]+\)\s*\)\s*return/.test(content.replace(/\s+/g, " "))
    ) {
      findings.push(`${rel} — isRedirectError połykany przez return (użyj throw)`);
    }
  }

  console.log(
    `Server actions z redirect(): ${[...REDIRECT_ACTIONS].sort().join(", ") || "(brak)"}\n`
  );

  if (!findings.length) {
    console.log("✓ Wszystkie wywołania klienta używają runServerActionWithRedirect.");
    return;
  }

  console.log("Znaleziono problemy:\n");
  for (const line of findings.sort()) {
    console.log(`  • ${line}`);
  }
  process.exit(1);
}

main();
