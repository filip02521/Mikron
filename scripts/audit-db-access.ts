/**
 * Wymaga adnotacji @db-ok lub @service-role-ok przy createAdminClient w server actions.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ACTIONS_DIR = join(process.cwd(), "src/app/actions");
const TAGS = ["@service-role-ok", "@db-ok"];

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
    if (!TAGS.some((tag) => content.includes(tag))) {
      findings.push(`${rel}: createAdminClient bez ${TAGS.join(" / ")}`);
    }
  }

  if (findings.length) {
    console.error(findings.join("\n"));
    process.exit(1);
  }
  console.log("audit:db-access OK");
}

main();
