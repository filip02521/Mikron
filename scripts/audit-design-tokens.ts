/**
 * Pilnuje reguł DESIGN.md, których nowy kod nie może łamać (Typography → Named Rules):
 * - wagi powyżej 600 (`font-bold`, `font-extrabold`, `font-black`, CSS `font-weight: 700+`),
 *   poza `font-bold` razem z `font-display` (tytuły w Inter Tight);
 * - wersaliki poza nagłówkiem grupy menu (`uppercase`, `text-transform: uppercase`);
 * - rozmiar tekstu w px (`text-[11px]`) poza chrome Kreatora ZD — rem rośnie z ustawieniem
 *   „większy tekst” (`html[data-font-scale]`), px nie.
 * - biała powierzchnia (`bg-white`, `ring-white` …) zamiast `bg-card` / `ring-card` i tło pod oknem `bg-slate-900/N`
 *   zamiast `bg-scrim/N` — w ciemnym motywie oba wyglądałyby jasno (docs/plans/ciemny-tryb.md).
 * Uzasadniony wyjątek: komentarz `design-ok: <powód>` w tej samej linii albo do dwóch linii wyżej.
 * Szablony maili (`src/lib/email/`) piszą inline CSS dla klientów poczty — poza audytem.
 */
import { readFileSync } from "fs";
import { execFileSync } from "child_process";

const KREATOR_FILE = /zd-estimate|ZdEstimate/i;
const KREATOR_EXPORT = /zdEstimate|ZdEstimate/;
const EXCLUDED_DIRS = ["src/lib/email/"];

type Rule = { id: string; re: RegExp; css?: boolean; kreatorExempt?: boolean; allowIf?: RegExp; message: string };

const RULES: Rule[] = [
  {
    id: "waga",
    re: /(?<![\w-])font-(bold|extrabold|black)(?![\w-])|font-weight:\s*(700|800|900|bold)\b/,
    css: true,
    // 700 tylko w kroju tytułów (Inter Tight), w tej samej klasie.
    allowIf: /(?<![\w-])font-display(?![\w-])/,
    message: "waga powyżej 600 — użyj font-semibold; 700 tylko z font-display (DESIGN.md → Typography)",
  },
  {
    id: "wersaliki",
    re: /(?<![\w-])uppercase(?![\w-])|text-transform:\s*uppercase/,
    css: true,
    message: "wersaliki tylko w nagłówku grupy menu (DESIGN.md → „Wersaliki tylko w menu”)",
  },
  {
    id: "biel",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*(bg|ring|border|from|via|to)-white(?![\w-])/,
    // Biel na wypełnieniu (licznik na głównym przycisku) zostaje białą w obu motywach.
    allowIf: /(?<![\w-])text-white(?![\w-])/,
    message: "biała powierzchnia — użyj bg-card / ring-card / border-card, żeby działał ciemny motyw (docs/plans/ciemny-tryb.md)",
  },
  {
    id: "scrim",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*bg-slate-(900|950)\/([2-9]\d|100)(?![\w\d])/,
    message: "tło pod oknem — użyj bg-scrim/N; slate-900 w ciemnym motywie jest jasny",
  },
  {
    id: "krok600",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*text-(indigo|violet|purple|fuchsia|pink|blue|cyan|teal|red|rose|emerald|green|lime|amber|orange|yellow)-600(?![\w-])/,
    message: "krok 600 Petrolu i stanów to wypełnienie — tekst od 700 (DESIGN.md, docs/plans/ciemny-tryb.md §2)",
  },
  {
    id: "fokus",
    // Tylko 600 (wskaźnik fokusu z klawiatury); poświata pola focus:ring-indigo-500/20 zostaje z palety.
    re: /(?<![\w-])(?:[a-z0-9-]+:)*(focus|focus-visible|focus-within):(ring|outline)-(indigo|violet)-600(?![\w-])/,
    message: "pierścień fokusu — użyj ring-focus / outline-focus (w ciemnym motywie Petrol 600 ma za mały kontrast)",
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
      if (rule.allowIf?.test(line)) continue;
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
