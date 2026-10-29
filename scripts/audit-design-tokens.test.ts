import { describe, expect, it } from "vitest";
import { auditFile } from "./audit-design-tokens";

const ids = (path: string, src: string) => auditFile(path, src).map((l) => l.match(/\[(\w+)\]/)![1]);

describe("audit-design-tokens", () => {
  it("łapie wagę, wersaliki i px", () => {
    expect(ids("src/components/A.tsx", `<p className="font-bold uppercase text-[11px]">x</p>`)).toEqual(["waga", "wersaliki", "px"]);
    expect(ids("src/app/globals.css", ".x {\n  font-weight: 700;\n  text-transform: uppercase;\n}")).toEqual(["waga", "wersaliki"]);
  });
  it("przepuszcza rem, semibold i podobne nazwy klas", () => {
    expect(ids("src/components/A.tsx", `<p className="font-semibold text-[0.6875rem] normal-case">x</p>`)).toEqual([]);
  });
  it("700 tylko z font-display w tej samej klasie", () => {
    expect(ids("src/components/A.tsx", `<h2 className="font-display text-lg font-bold">x</h2>`)).toEqual([]);
    expect(ids("src/components/A.tsx", `<h2 className="text-lg font-bold">x</h2>`)).toEqual(["waga"]);
  });
  it("px dozwolone w Kreatorze ZD: plik zd-estimate* i eksport zdEstimate* w ontime-theme", () => {
    expect(ids("src/components/zakupy/ZdEstimateTable.tsx", `"text-[11px]"`)).toEqual([]);
    const theme = `export const zdEstimateChipClass =\n  "text-[11px]";\nexport const salesClass =\n  "text-[11px]";`;
    expect(auditFile("src/lib/ui/ontime-theme.ts", theme)).toEqual([expect.stringContaining("ontime-theme.ts:4 [px]")]);
  });
  it("biel i scrim: powierzchnie przez tokeny ról, biel na wypełnieniu dozwolona", () => {
    expect(ids("src/components/A.tsx", `"rounded-md border bg-white hover:bg-white/80"`)).toEqual(["biel"]);
    expect(ids("src/components/A.tsx", `"ring-2 ring-white"`)).toEqual(["biel"]);
    expect(ids("src/components/A.tsx", `"after:from-white"`)).toEqual(["biel"]);
    expect(ids("src/components/A.tsx", `"bg-white/25 text-white ring-white/35"`)).toEqual([]);
    expect(ids("src/components/A.tsx", `"bg-card ring-card text-white whitespace-nowrap"`)).toEqual([]);
    expect(ids("src/components/A.tsx", `"fixed inset-0 bg-slate-900/40"`)).toEqual(["scrim"]);
    expect(ids("src/components/A.tsx", `"hover:bg-slate-900/5 bg-scrim/40 shadow-slate-900/20"`)).toEqual([]);
  });
  it("krok 600 tylko jako wypełnienie; fokus przez ring-focus", () => {
    expect(ids("src/components/A.tsx", `"text-indigo-600 hover:text-rose-600"`)).toEqual(["krok600"]);
    expect(ids("src/components/A.tsx", `"bg-indigo-600 text-white text-indigo-700 text-slate-600"`)).toEqual([]);
    expect(ids("src/components/A.tsx", `"focus-visible:ring-2 focus-visible:ring-indigo-600"`)).toEqual(["fokus"]);
    expect(ids("src/components/A.tsx", `"focus-visible:ring-focus focus:ring-indigo-500/20 ring-indigo-600"`)).toEqual([]);
  });
  it("wyjątek tylko z adnotacją design-ok do dwóch linii wyżej; komentarze pomija", () => {
    expect(ids("src/components/A.tsx", `{/* design-ok: kod */}\n<span className="uppercase">to</span>`)).toEqual([]);
    expect(ids("src/components/A.tsx", `// design-ok: x\n\n\nconst c = "uppercase";`)).toEqual(["wersaliki"]);
    expect(ids("src/lib/a.ts", `/** Kody walut (uppercase). */`)).toEqual([]);
  });
});
