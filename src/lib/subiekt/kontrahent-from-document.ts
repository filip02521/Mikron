import { formatSubiektKontrahentLabel } from "@/lib/subiekt/match-supplier";
import type { SubiektDocument, SubiektKontrahent } from "@/lib/subiekt/types";

function normalizeKhId(value: unknown): number | null {
  if (value == null) return null;
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function kontrahentBlocks(doc: SubiektDocument): SubiektKontrahent[] {
  const raw = doc as SubiektDocument & {
    kh__Kontrahent?: SubiektKontrahent | null;
    kh__Kontrahent_Platnik?: SubiektKontrahent | null;
    kh__Kontrahent_Odbiorca?: SubiektKontrahent | null;
    kontrahent?: SubiektKontrahent | null;
  };
  return [raw.kh__Kontrahent_Platnik, raw.kh__Kontrahent_Odbiorca, raw.kh__Kontrahent, raw.kontrahent].filter(
    (k): k is SubiektKontrahent => k != null && normalizeKhId(k.kh_Id) != null
  );
}

/** Nazwa kontrahenta z pełnego dokumentu ZD (bez dodatkowego GET /kontrahenci). */
export function extractKhLabelFromDocument(
  doc: SubiektDocument,
  khId: number
): string | null {
  const target = Math.trunc(khId);
  for (const k of kontrahentBlocks(doc)) {
    if (normalizeKhId(k.kh_Id) === target) {
      return formatSubiektKontrahentLabel(k);
    }
  }
  return null;
}

/** Pierwsza dostępna etykieta z embedów w dokumencie (gdy kh_Id bez nazwy). */
export function extractAnyKhLabelFromDocument(doc: SubiektDocument): string | null {
  for (const k of kontrahentBlocks(doc)) {
    const label = formatSubiektKontrahentLabel(k);
    if (label.trim()) return label;
  }
  return null;
}

export function resolveKhLabelForZdDocument(
  doc: SubiektDocument,
  storedKhId: number | null,
  khIds: number[]
): string | null {
  if (storedKhId != null) {
    const direct = extractKhLabelFromDocument(doc, storedKhId);
    if (direct) return direct;
  }
  for (const id of khIds) {
    const label = extractKhLabelFromDocument(doc, id);
    if (label) return label;
  }
  return extractAnyKhLabelFromDocument(doc);
}
