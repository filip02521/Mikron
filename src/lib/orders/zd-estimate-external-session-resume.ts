import {
  peekZdEstimateExternalSessionToken,
  type ZdEstimateExternalSessionToken,
} from "@/lib/orders/zd-estimate-external-session";

export const ZD_ESTIMATE_EXTERNAL_SESSION_RESUME_QUERY = "resume";

export function isZdEstimateExternalSessionResumeUrl(
  search: string | URLSearchParams | null | undefined
): boolean {
  if (search == null) return false;
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search
        )
      : search;
  return params.get(ZD_ESTIMATE_EXTERNAL_SESSION_RESUME_QUERY) === "1";
}

/** Użytkownik wraca z innej strony (CTA / timer away), nie zwykłe odświeżenie w kreatorze. */
export function isZdEstimateExternalSessionReturnNavigation(
  token: ZdEstimateExternalSessionToken | null,
  search?: string | null
): boolean {
  if (typeof window === "undefined") return false;
  const hrefSearch = search ?? window.location.search;
  if (isZdEstimateExternalSessionResumeUrl(hrefSearch)) return true;
  return token?.awayExpiresAtMs != null;
}

/**
 * Czy po wejściu na kreator pokazać pełnoekranowy gate wznowienia sesji.
 * Tylko realny powrót z innej strony — nie zwykłe odświeżenie na kreatorze.
 */
export function shouldShowZdEstimateSessionResumeLoading(input?: {
  token?: ZdEstimateExternalSessionToken | null;
  search?: string | null;
}): boolean {
  const token =
    input?.token !== undefined
      ? input.token
      : peekZdEstimateExternalSessionToken();
  if (!token) return false;

  const search =
    input?.search ??
    (typeof window !== "undefined" ? window.location.search : null);

  if (isZdEstimateExternalSessionResumeUrl(search)) return true;
  if (token.awayExpiresAtMs != null) return true;

  return false;
}

export function clearZdEstimateExternalSessionResumeQueryParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(ZD_ESTIMATE_EXTERNAL_SESSION_RESUME_QUERY)) return;
  url.searchParams.delete(ZD_ESTIMATE_EXTERNAL_SESSION_RESUME_QUERY);
  const qs = url.searchParams.toString();
  window.history.replaceState(
    {},
    "",
    `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`
  );
}
