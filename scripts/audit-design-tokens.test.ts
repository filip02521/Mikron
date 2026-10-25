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
  it("px dozwolone w Kreatorze ZD: plik zd-estimate* i eksport zdEstimate* w ontime-theme", () => {
    expect(ids("src/components/zakupy/ZdEstimateTable.tsx", `"text-[11px]"`)).toEqual([]);
    const theme = `export const zdEstimateChipClass =\n  "text-[11px]";\nexport const salesClass =\n  "text-[11px]";`;
    expect(auditFile("src/lib/ui/ontime-theme.ts", theme)).toEqual([expect.stringContaining("ontime-theme.ts:4 [px]")]);
  });
  it("wyjątek tylko z adnotacją design-ok do dwóch linii wyżej; komentarze pomija", () => {
    expect(ids("src/components/A.tsx", `{/* design-ok: kod */}\n<span className="uppercase">to</span>`)).toEqual([]);
    expect(ids("src/components/A.tsx", `// design-ok: x\n\n\nconst c = "uppercase";`)).toEqual(["wersaliki"]);
    expect(ids("src/lib/a.ts", `/** Kody walut (uppercase). */`)).toEqual([]);
  });
});
