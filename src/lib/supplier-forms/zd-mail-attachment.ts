import { createHash } from "node:crypto";
import type { GmailAttachment } from "@/lib/google/gmail";
import { getSubiektOrdersZdPdf } from "@/lib/subiekt/api";
import type { SupplierZd } from "@/lib/supplier-forms/prepare";
import { renderSupplierForm } from "@/lib/supplier-forms/render";
import { findSupplierFormTemplate } from "@/lib/supplier-forms/templates";

/**
 * Załącznik maila ZD do dostawcy: jego formularz (Wiedent, Sirona…) albo wydruk ZD z Subiekta
 * (wszyscy pozostali, także zagraniczni). Ta sama funkcja buduje plik do podglądu i do wysyłki.
 */
export async function buildZdMailAttachment(
  zd: SupplierZd,
  dokId: number,
  opts: { fresh?: boolean } = {}
): Promise<Required<GmailAttachment>> {
  const template = findSupplierFormTemplate(zd.supplier.name);
  if (template) {
    const f = await renderSupplierForm({
      ok: true,
      template,
      lines: zd.lines,
      date: zd.date,
      dokNr: zd.dokNr,
      supplierName: zd.supplier.name,
    });
    return { filename: f.fileName, content: Buffer.from(f.bytes), contentType: f.contentType };
  }
  return {
    filename: `${zd.dokNr.replace(/[\\/:*?"<>|]+/g, "-")}.pdf`,
    content: await getSubiektOrdersZdPdf(dokId, { ...opts, version: zdPdfVersion(zd) }),
    contentType: "application/pdf",
  };
}

/** Odcisk treści wydruku — termin i pozycje (zmiana w Subiekcie po podglądzie nie wysyła starego pliku). */
export function zdPdfVersion(zd: Pick<SupplierZd, "termin" | "lines">): string {
  return createHash("sha1")
    .update(JSON.stringify([zd.termin ?? null, zd.lines.map((l) => [l.symbol, l.name, l.qty])]))
    .digest("hex")
    .slice(0, 12);
}
