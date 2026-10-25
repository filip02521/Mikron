/**
 * Pilnuje reguł DESIGN.md, których nowy kod nie może łamać (Typography → Named Rules):
 * - wagi powyżej 600 (`font-bold`, `font-extrabold`, `font-black`, CSS `font-weight: 700+`);
 * - wersaliki poza nagłówkiem grupy menu (`uppercase`, `text-transform: uppercase`);
 * - rozmiar tekstu w px (`text-[11px]`) poza chrome Kreatora ZD — rem rośnie z ustawieniem
 *   „większy tekst” (`html[data-font-scale]`), px nie.
 * Uzasadniony wyjątek: komentarz `design-ok: <powód>` w tej samej linii albo do dwóch linii wyżej.
 * Szablony maili (`src/lib/email/`) piszą inline CSS dla klientów poczty — poza audytem.
 */
import { readFileSync } from "fs";
import { execFileSync } from "child_process";

const KREATOR_FILE = /zd-estimate|ZdEstimate/i;
const KREATOR_EXPORT = /zdEstimate|ZdEstimate/;
const EXCLUDED_DIRS = ["src/lib/email/"];

type Rule = { id: string; re: RegExp; css?: boolean; kreatorExempt?: boolean; message: string };

const RULES: Rule[] = [
  {
    id: "waga",
    re: /(?<![\w-])font-(bold|extrabold|black)(?![\w-])|font-weight:\s*(700|800|900|bold)\b/,
    css: true,
    message: "waga powyżej 600 — użyj font-semibold (DESIGN.md → Typography)",
  },
  {
    id: "wersaliki",
    re: /(?<![\w-])uppercase(?![\w-])|text-transform:\s*uppercase/,
    css: true,
    message: "wersaliki tylko w nagłówku grupy menu (DESIGN.md → „Wersaliki tylko w menu”)",
  },
  {
    id: "px",
    re: /(?<![\w-])text-\[\d+(\.\d+)?px\]/,
    kreatorExempt: true,
    message: "rozmiar tekstu w px — podaj rem, np. text-[0.6875rem] (DESIGN.md → Typography, Micro)",
  },
];

const isComment = (line: string) => /^\s*(\/\/|\/\*|\*|\{\s*\/\*)/.test(line) && !/className|class=/.test(line);

/** Linie objęte wyjątkiem Kreatora w ontime-theme: bloki eksportów zdEstimate*. */
function kreatorExportLines(src: string): Set<number> {
  const out = new Set<number>();
  let inKreator = false;
  src.split("\n").forEach((line, i) => {
    const m = line.match(/^export (?:const|function|type) (\w+)/);
    if (m) inKreator = KREATOR_EXPORT.test(m[1]!);
    if (inKreator) out.add(i);
  });
  return out;
}

export function auditFile(path: string, src: string): string[] {
  const lines = src.split("\n");
  const css = path.endsWith(".css");
  const kreatorFile = KREATOR_FILE.test(path);
  const kreatorLines = path.endsWith("ontime-theme.ts") ? kreatorExportLines(src) : new Set<number>();
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (!css && isComment(line)) return;
    for (const rule of RULES) {
      if (css && !rule.css) continue;
      if (!rule.re.test(line)) continue;
      if (rule.kreatorExempt && (kreatorFile || kreatorLines.has(i))) continue;
      if (lines.slice(Math.max(0, i - 2), i + 1).some((l) => l.includes("design-ok:"))) continue;
      out.push(`${path}:${i + 1} [${rule.id}] ${rule.message}`);
    }
  });
  return out;
}

function main() {
  const files = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f) && !EXCLUDED_DIRS.some((d) => f.startsWith(d)));
  const findings = files.flatMap((f) => auditFile(f, readFileSync(f, "utf8")));
  if (findings.length) {
    console.error(`audit-design-tokens: ${findings.length} naruszeń\n${findings.join("\n")}`);
    process.exit(1);
  }
  console.log(`audit-design-tokens: OK (${files.length} plików)`);
}

if (process.argv[1]?.endsWith("audit-design-tokens.ts")) main();
