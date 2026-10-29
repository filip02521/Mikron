import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Kontrast WCAG 2.x tokenów jasnych i ciemnych, liczony z globals.css (docs/plans/ciemny-tryb.md §3.3).

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const twTheme = readFileSync(createRequire(import.meta.url).resolve("tailwindcss/theme.css"), "utf8");

/** Treść bloków `{…}` zaczynających się od danego nagłówka (z zagnieżdżeniem nawiasów). */
function blocks(src: string, header: RegExp): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(header)) {
    let depth = 0;
    const start = m.index! + m[0].length;
    for (let i = start - 1; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) {
        out.push(src.slice(start, i));
        break;
      }
    }
  }
  return out;
}

const decls = (body: string) =>
  Object.fromEntries([...body.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const light: Record<string, string> = {
  ...decls(blocks(twTheme, /@theme[^{]*\{/g).join("\n")),
  ...decls(blocks(css, /@theme\s*\{/g).join("\n")),
  ...decls(blocks(css, /@theme inline\s*\{/g).join("\n")),
  ...decls(blocks(css, /(?:^|\n):root\s*\{/g).join("\n")),
};
const darkOnly = decls(blocks(css, /html\[data-theme="dark"\]\s*\{/g)[0] ?? "");
const dark = { ...light, ...darkOnly };
const lightScope = decls(blocks(css, /\.theme-light\s*\{/g)[0] ?? "");

function resolve(vars: Record<string, string>, value: string, depth = 0): string {
  if (depth > 10) throw new Error(`pętla var() przy ${value}`);
  return value.replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (_, name: string) => {
    if (!(name in vars)) throw new Error(`brak zmiennej ${name}`);
    return resolve(vars, vars[name], depth + 1);
  });
}

/** Luminancja względna; oklch → sRGB z przycięciem do gamutu (przeglądarka mapuje podobnie). */
function luminance(color: string): number {
  const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  let rgb: number[];
  if (hex) {
    rgb = [0, 2, 4].map((i) => toLin(parseInt(hex[1].slice(i, i + 2), 16) / 255));
  } else {
    const m = color.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/);
    if (!m) throw new Error(`nieznany kolor ${color}`);
    const [L, C, H] = [+m[1] / 100, +m[2], (+m[3] * Math.PI) / 180];
    const [a, b] = [C * Math.cos(H), C * Math.sin(H)];
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    rgb = [
      4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
    ].map((c) => Math.min(1, Math.max(0, c)));
  }
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function ratio(vars: Record<string, string>, fg: string, bg: string): number {
  const [x, y] = [fg, bg].map((v) => luminance(resolve(vars, v.startsWith("--") ? `var(${v})` : v))).sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const c = (step: string) => `--color-${step}`;
const WHITE = "#ffffff";
// [opis, tekst/obrys, tło, próg] — pary, które występują w kodzie (inwentarz w planie, §4).
const PAIRS: [string, string, string, number][] = [
  ["tekst główny / karta", c("slate-900"), "--card", 4.5],
  ["tekst główny / tło", c("slate-900"), "--background", 4.5],
  ["slate-800 / karta", c("slate-800"), "--card", 4.5],
  ["slate-700 / karta", c("slate-700"), "--card", 4.5],
  ["slate-700 / odznaka slate-100", c("slate-700"), c("slate-100"), 4.5],
  ["slate-600 / karta", c("slate-600"), "--card", 4.5],
  ["slate-600 / tło", c("slate-600"), "--background", 4.5],
  ["slate-600 / well", c("slate-600"), c("slate-50"), 4.5],
  ["slate-500 / karta", c("slate-500"), "--card", 4.5],
  ["slate-500 / nagłówek tabeli", c("slate-500"), c("slate-50"), 4.5],
  ["slate-500 / tło", c("slate-500"), "--background", 4.5],
  ["slate-500 / slate-100", c("slate-500"), c("slate-100"), 4.5],
  ["slate-500 / okno", c("slate-500"), "--surface-raised", 4.5],
  ["tekst główny / okno", c("slate-900"), "--surface-raised", 4.5],
  ["slate-400 ikona / karta", c("slate-400"), "--card", 3],
  ["slate-400 / well", c("slate-400"), c("slate-50"), 3],
  ["slate-400 / okno", c("slate-400"), "--surface-raised", 3],
  ["tekst główny / wybrany wiersz", c("slate-900"), c("indigo-50"), 4.5],
  ["slate-600 / indigo-50", c("slate-600"), c("indigo-50"), 4.5],
  ["tekst główny / indigo-100", c("slate-900"), c("indigo-100"), 4.5],
  ["link indigo-700 / karta", c("indigo-700"), "--card", 4.5],
  ["link indigo-700 / tło", c("indigo-700"), "--background", 4.5],
  ["Outline indigo-800 / indigo-50", c("indigo-800"), c("indigo-50"), 4.5],
  ["aktywne menu indigo-900 / indigo-50", c("indigo-900"), c("indigo-50"), 4.5],
  ["fokus pola indigo-500 / karta", c("indigo-500"), "--card", 3],
  ["biały / primary", WHITE, c("primary"), 4.5],
  ["biały / primary hover", WHITE, c("primary-hover"), 4.5],
  ["biały / primary pressed", WHITE, c("primary-pressed"), 4.5],
  ["biały / indigo-600", WHITE, c("indigo-600"), 4.5],
  ["primary / karta", c("primary"), "--card", 3],
  ["biały / red-600", WHITE, c("red-600"), 4.5],
  ["biały / emerald-600", WHITE, c("emerald-600"), 4.5],
  ["biały / amber-600", WHITE, c("amber-600"), 4.5],
  ["dymek: on-inverse / inverse", c("on-inverse"), c("inverse"), 4.5],
  ["biały / success hover", WHITE, c("success-hover"), 4.5],
  ["biały / success pressed", WHITE, c("success-pressed"), 4.5],
  ["biały / warning hover", WHITE, c("warning-hover"), 4.5],
  ["biały / danger hover", WHITE, c("danger-hover"), 4.5],
  ["biały / wypełnienie neutralne", WHITE, c("fill-neutral"), 4.5],
  ["biały / wypełnienie neutralne hover", WHITE, c("fill-neutral-hover"), 4.5],
  ["wypełnienie neutralne / karta", c("fill-neutral"), "--card", 3],
  ...["expired", "today", "tomorrow", "this-week", "for-someone"].flatMap((k): [string, string, string, number][] => [
    [`slate-900 / wiersz ${k}`, c("slate-900"), `--summary-${k}`, 4.5],
    [`slate-600 / wiersz ${k}`, c("slate-600"), `--summary-${k}`, 4.5],
  ]),
  ["emerald-800 / emerald-50", c("emerald-800"), c("emerald-50"), 4.5],
  ["emerald-700 / emerald-50", c("emerald-700"), c("emerald-50"), 4.5],
  ["emerald-700 / karta", c("emerald-700"), "--card", 4.5],
  ["emerald-800 / emerald-100", c("emerald-800"), c("emerald-100"), 4.5],
  ["emerald-600 ikona / karta", c("emerald-600"), "--card", 3],
  ["amber-900 / amber-50", c("amber-900"), c("amber-50"), 4.5],
  ["amber-800 / amber-50", c("amber-800"), c("amber-50"), 4.5],
  ["amber-700 / amber-50", c("amber-700"), c("amber-50"), 4.5],
  ["amber-700 / karta", c("amber-700"), "--card", 4.5],
  ["amber-800 / amber-100", c("amber-800"), c("amber-100"), 4.5],
  ["amber-950 / amber-100", c("amber-950"), c("amber-100"), 4.5],
  ["tekst główny / pas uwagi", c("slate-900"), c("amber-50"), 4.5],
  ["slate-600 / amber-50", c("slate-600"), c("amber-50"), 4.5],
  ["amber-500 sygnał / karta", c("amber-500"), "--card", 3],
  ["red-800 / red-50", c("red-800"), c("red-50"), 4.5],
  ["red-700 / red-50", c("red-700"), c("red-50"), 4.5],
  ["red-700 / karta", c("red-700"), "--card", 4.5],
  ["red-800 / red-100", c("red-800"), c("red-100"), 4.5],
  ["red-600 ikona / karta", c("red-600"), "--card", 3],
  ["fokus / karta", c("focus"), "--card", 3],
  ["fokus / tło", c("focus"), "--background", 3],
  ["fokus / okno", c("focus"), "--surface-raised", 3],
  ["fokus / wybrany chip", c("focus"), c("indigo-50"), 3],
  ["fokus / amber-50", c("focus"), c("amber-50"), 3],
  ["fokus / red-50", c("focus"), c("red-50"), 3],
];

// Jasny dług znany i opisany w planie (§4.3): kropka amber-500 stoi zawsze obok tekstu.
const LIGHT_DEBT = ["amber-500 sygnał / karta"];

const failing = (vars: Record<string, string>) =>
  PAIRS.filter(([, fg, bg, min]) => ratio(vars, fg, bg) + 1e-9 < min).map(([label, fg, bg, min]) => `${label}: ${ratio(vars, fg, bg).toFixed(2)} < ${min}`);

describe("kontrast motywów (globals.css)", () => {
  it("ciemny: każda para spełnia WCAG AA", () => {
    expect(Object.keys(darkOnly).length).toBeGreaterThan(50);
    expect(failing(dark)).toEqual([]);
  });

  it("jasny: tylko znany dług poniżej progu", () => {
    expect(failing(light).map((f) => f.split(":")[0])).toEqual(LIGHT_DEBT);
  });

  it(".theme-light przywraca każdą zmienną bloku ciemnego jasną wartością", () => {
    const missing = Object.keys(darkOnly).filter((k) => !(k in lightScope));
    expect(missing).toEqual([]);
    const norm = (v: string) => v.replace(/\s+/g, " ");
    const differs = Object.keys(lightScope).filter((k) => {
      const want = resolve(light, light[k] ?? "");
      const got = resolve(light, lightScope[k]);
      if (/^(#|oklch)/.test(want) && /^(#|oklch)/.test(got)) return Math.abs(luminance(want) - luminance(got)) > 1e-6;
      return norm(want) !== norm(got);
    });
    expect(differs).toEqual([]);
  });

  it("pomiar odróżnia zły token (kontrola)", () => {
    expect(failing({ ...dark, "--color-slate-500": "#3b434f" }).some((f) => f.startsWith("slate-500 / karta"))).toBe(true);
  });
});
