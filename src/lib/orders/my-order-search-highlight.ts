import {
  normalizeMyOrderSearchText,
  searchQueryTokens,
} from "@/lib/orders/my-order-search";

export type SearchHighlightSegment = { text: string; match: boolean };

type NormIndexMap = { normalized: string; indexMap: number[] };

function buildNormIndexMap(text: string): NormIndexMap {
  const indexMap: number[] = [];
  let normalized = "";
  for (let i = 0; i < text.length; i++) {
    const folded = normalizeMyOrderSearchText(text[i] ?? "");
    for (let j = 0; j < folded.length; j++) {
      normalized += folded[j];
      indexMap.push(i);
    }
  }
  return { normalized, indexMap };
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur[0] <= last[1]) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      out.push(cur);
    }
  }
  return out;
}

function rangesFromTokens(text: string, tokens: string[]): Array<[number, number]> {
  if (!text || !tokens.length) return [];
  const { normalized, indexMap } = buildNormIndexMap(text);
  if (!normalized) return [];

  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    while (from < normalized.length) {
      const hit = normalized.indexOf(token, from);
      if (hit < 0) break;
      const startOrig = indexMap[hit] ?? 0;
      const endNorm = hit + token.length - 1;
      const endOrig = (indexMap[endNorm] ?? startOrig) + 1;
      ranges.push([startOrig, endOrig]);
      from = hit + 1;
    }
  }
  return mergeRanges(ranges);
}

/** Dzieli tekst na segmenty z/bez podświetlenia (zgodnie z logiką wyszukiwania). */
export function splitTextBySearchHighlight(
  text: string,
  query: string | null | undefined
): SearchHighlightSegment[] {
  if (!text) return [{ text: "", match: false }];
  const tokens = searchQueryTokens(query);
  if (!tokens.length) return [{ text, match: false }];

  const ranges = rangesFromTokens(text, tokens);
  if (!ranges.length) return [{ text, match: false }];

  const segments: SearchHighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: false });
    }
    if (end > start) {
      segments.push({ text: text.slice(start, end), match: true });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }
  return segments.length ? segments : [{ text, match: false }];
}
