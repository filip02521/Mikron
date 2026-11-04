import { getSubiektProduct } from "@/lib/subiekt/api";
import { SubiektRequestError } from "@/lib/subiekt/errors";

export type VerifiedSubiektProduct = { twId: number; symbol: string | null; name: string };

/**
 * Towar z formularza (tw_Id z przeglądarki) sprawdzony w Subiekcie. Symbol i nazwa pochodzą z Subiekta,
 * nie z formularza. `null` = Subiekt nie zna takiego towaru; brak połączenia rzuca błąd dalej.
 * Tylko serwer.
 */
export async function verifySubiektProduct(twId: number): Promise<VerifiedSubiektProduct | null> {
  try {
    const p = await getSubiektProduct(twId);
    if (!p || Math.trunc(Number(p.tw_Id)) !== twId) return null;
    return {
      twId,
      symbol: p.tw_Symbol?.trim() || null,
      name: p.tw_Nazwa?.trim() || p.tw_Symbol?.trim() || `Towar ${twId}`,
    };
  } catch (e) {
    if (e instanceof SubiektRequestError && e.status === 404) return null;
    throw e;
  }
}
