/**
 * Minimum / darmowa dostawa propozycji ZD (zadanie 5) — czyste funkcje bez I/O, serwer i klient:
 * format kwot, waluta minimum i komunikat w panelu propozycji (`ZdProposalMinimumNotice`).
 */
import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";
import { polishPluralWord } from "@/lib/email/polish-plural";

/** Dopełniamy do darmowej dostawy tylko, gdy brakuje najwyżej tyle progu. */
export const ZD_TOP_UP_MAX_GAP_SHARE = 0.15;

export const formatZdMinimumZl = (v: number) =>
  `${(Math.round(v * 100) / 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`;

/** Minimum w złotych: waluta pusta albo PLN. */
export function isPlnCurrency(currency: string | null | undefined): boolean {
  const c = String(currency ?? "").trim();
  return !c || /^(pln|zł|zl)$/i.test(c);
}

export type ZdMinimumNoticeItem = { tone: "warning" | "info" | "muted"; text: string };

const poz = (n: number) => `${n} ${polishPluralWord(n, "pozycja", "pozycje", "pozycji")}`;

/**
 * Komunikat panelu: odłożona / dopełniona / poniżej minimum lub progu / bez ceny.
 * `value` i `lines` = stan po poprawkach w panelu (domyślnie: propozycja jak policzona).
 */
export function zdProposalMinimumNotice(
  p: Pick<ZdAutoProposal, "status" | "deferredReason" | "lines" | "valueNet" | "supplierTerms">,
  value = p.valueNet,
  lines = p.lines
): ZdMinimumNoticeItem[] {
  const zl = formatZdMinimumZl;
  const out: ZdMinimumNoticeItem[] = [];
  const t = p.supplierTerms;
  const thr = t?.freeShippingThreshold ?? null;
  if (p.status === "deferred") {
    out.push({ tone: "warning", text: p.deferredReason ?? "Odłożona na kolejny cykl." });
  }
  const topped = lines.filter((l) => (l.topUpUnits ?? 0) > 0);
  if (topped.length) {
    const added = topped.reduce(
      (a, l) => a + (l.priceNet != null && l.zdUnits > 0 ? l.priceNet * (l.pieces / l.zdUnits) * (l.topUpUnits ?? 0) : 0),
      0
    );
    out.push({
      tone: "info",
      text: `Dopełniona do darmowej dostawy${thr ? ` od ${zl(thr)}` : ""}: ${poz(topped.length)} za ${zl(added)}.`,
    });
  }
  if (p.status !== "deferred" && t) {
    const min = t.minOrderValue;
    if (min != null && !isPlnCurrency(t.minOrderCurrency)) {
      out.push({ tone: "muted", text: `Minimum dostawcy ${min} ${t.minOrderCurrency} - nie porównuję z wartością w zł.` });
    } else if (min != null && value < min) {
      out.push({ tone: "warning", text: `Poniżej minimum dostawcy ${zl(min)}: propozycja ${zl(value)}.` });
    }
    if (thr != null && value < thr) {
      out.push({ tone: "muted", text: `Do darmowej dostawy od ${zl(thr)} brakuje ${zl(thr - value)}.` });
    }
  }
  const unpriced = lines.filter((l) => l.priceNet == null).length;
  if (unpriced) out.push({ tone: "muted", text: `${poz(unpriced)} bez ceny - wartość niepełna.` });
  return out;
}
