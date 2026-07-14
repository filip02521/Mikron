import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type TeethOcrCleanupResult = {
  scanned: number;
  imagesRemoved: number;
  errors: string[];
};

/**
 * Usuwa zdjęcia OCR dla zamówień zębowych, które:
 * - zostały anulowane (sales_cancelled_at != null)
 * - są w statusie Weryfikacja z teeth_ocr_pending = true przez ponad 30 dni
 *
 * Zamówienia zatwierdzone (approveTeethOcr) już usuwają swoje zdjęcia.
 * Ta funkcja czyści pozostałości po anulowanych lub porzuconych prośbach.
 */
export async function cleanupStaleTeethOcrImages(): Promise<TeethOcrCleanupResult> {
  if (!hasSupabaseConfig()) {
    return { scanned: 0, imagesRemoved: 0, errors: [] };
  }

  const supabase = createAdminClient();
  const errors: string[] = [];
  let scanned = 0;
  let imagesRemoved = 0;

  // 1. Anulowane zamówienia zębowe ze zdjęciem OCR
  const { data: cancelledRows, error: cancelledErr } = await supabase
    .from("individual_orders")
    .select("id, teeth_ocr_image_path")
    .eq("is_teeth", true)
    .not("teeth_ocr_image_path", "is", null)
    .not("sales_cancelled_at", "is", null);

  if (cancelledErr) {
    errors.push(`cancelled query: ${cancelledErr.message}`);
  }

  // 2. Zaległe zamówienia w Weryfikacja z OCR pending > 30 dni
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - 30);
  const staleCutoffIso = staleCutoff.toISOString();

  const { data: staleRows, error: staleErr } = await supabase
    .from("individual_orders")
    .select("id, teeth_ocr_image_path")
    .eq("is_teeth", true)
    .eq("teeth_ocr_pending", true)
    .eq("status", "Weryfikacja")
    .not("teeth_ocr_image_path", "is", null)
    .is("sales_cancelled_at", null)
    .lt("created_at", staleCutoffIso);

  if (staleErr) {
    errors.push(`stale query: ${staleErr.message}`);
  }

  const allRows = [...(cancelledRows ?? []), ...(staleRows ?? [])];
  scanned = allRows.length;

  const imagePaths = allRows
    .map((r) => r.teeth_ocr_image_path)
    .filter((p): p is string => Boolean(p));

  if (imagePaths.length > 0) {
    const { error: rmError } = await supabase.storage
      .from("teeth-ocr-images")
      .remove(imagePaths);

    if (rmError) {
      errors.push(`storage remove: ${rmError.message}`);
    } else {
      imagesRemoved = imagePaths.length;

      // Wyczyść ścieżki w DB — ustaw null dla anulowanych i usuń pending dla zaległych
      const cancelledIds = (cancelledRows ?? []).map((r) => r.id);
      const staleIds = (staleRows ?? []).map((r) => r.id);

      if (cancelledIds.length > 0) {
        const { error: updErr } = await supabase
          .from("individual_orders")
          .update({ teeth_ocr_image_path: null })
          .in("id", cancelledIds);
        if (updErr) errors.push(`clear cancelled paths: ${updErr.message}`);
      }

      if (staleIds.length > 0) {
        const { error: updErr } = await supabase
          .from("individual_orders")
          .update({ teeth_ocr_image_path: null, teeth_ocr_pending: false })
          .in("id", staleIds);
        if (updErr) errors.push(`clear stale paths: ${updErr.message}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("[teeth-ocr-cleanup] Errors:", errors.join("; "));
  }

  return { scanned, imagesRemoved, errors };
}
