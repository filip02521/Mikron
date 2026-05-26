"use server";

import { requireAdmin, requireSubiektLookup } from "@/lib/auth";
import {
  searchSubiektProducts,
  searchSubiektSuppliers,
} from "@/lib/subiekt/api";
import { productSearchParams } from "@/lib/subiekt/product-pick";
import { getSubiektConfigSummary, isSubiektConfigured } from "@/lib/subiekt/config";
import { testSubiektConnection, type SubiektHealthResult } from "@/lib/subiekt/client";
import {
  getSubiektAvailability,
  isSubiektReachable,
  type SubiektAvailability,
} from "@/lib/subiekt/availability";
import {
  feedbackFromException,
  getSubiektFeedback,
  notFoundProductFeedback,
  notFoundSupplierFeedback,
  type SubiektFeedback,
} from "@/lib/subiekt/feedback";
import {
  formatSubiektKontrahentLabel,
  matchSubiektKontrahentToSupplier,
  type AppSupplierRef,
} from "@/lib/subiekt/match-supplier";
import type { SubiektKontrahent, SubiektProduct } from "@/lib/subiekt/types";

export async function actionGetSubiektStatus() {
  await requireAdmin();
  return getSubiektConfigSummary();
}

export async function actionTestSubiektConnection(): Promise<SubiektHealthResult> {
  await requireAdmin();
  return testSubiektConnection();
}

export type SubiektLookupResult<T> =
  | { ok: true; items: T[]; totalCount?: number; feedback?: SubiektFeedback }
  | { ok: false; feedback: SubiektFeedback };

function lookupFailure(e: unknown): { ok: false; feedback: SubiektFeedback } {
  return { ok: false, feedback: feedbackFromException(e) };
}

function validationFailure(code: "short_query" | "empty_query"): {
  ok: false;
  feedback: SubiektFeedback;
} {
  return { ok: false, feedback: getSubiektFeedback(code) };
}

/** Status Subiekt dla handlowca / zakupów (bez sekretów). */
export async function actionGetSubiektAvailability(options?: {
  force?: boolean;
}): Promise<SubiektAvailability> {
  await requireSubiektLookup();
  return getSubiektAvailability(options);
}

/** Czy podpowiedzi Subiekt są dostępne (LAN + env). */
export async function actionSubiektSuggestionsEnabled(): Promise<{
  enabled: boolean;
  feedback?: SubiektFeedback;
}> {
  await requireSubiektLookup();
  if (!isSubiektConfigured()) {
    return {
      enabled: false,
      feedback: getSubiektFeedback("not_configured"),
    };
  }
  const reachable = await isSubiektReachable();
  if (!reachable) {
    return {
      enabled: false,
      feedback: getSubiektFeedback("subiekt_unavailable", {
        hint: "Poza siecią firmową lub API Subiekta nie odpowiada — wpisz dane ręcznie.",
      }),
    };
  }
  return { enabled: true };
}

/** Wyszukiwanie towaru — panel admina. */
export async function actionSubiektLookupProduct(
  query: string
): Promise<SubiektLookupResult<SubiektProduct>> {
  await requireAdmin();
  return suggestProducts(query);
}

/** Podpowiedzi towaru przy prośbach. */
export async function actionSubiektSuggestProducts(
  query: string
): Promise<SubiektLookupResult<SubiektProduct>> {
  await requireSubiektLookup();
  return suggestProducts(query);
}

async function suggestProducts(query: string): Promise<SubiektLookupResult<SubiektProduct>> {
  const q = query.trim();
  if (q.length < 2) return validationFailure("short_query");
  if (!isSubiektConfigured()) {
    return { ok: false, feedback: getSubiektFeedback("not_configured") };
  }

  try {
    const res = await searchSubiektProducts(productSearchParams(q));
    if (res.data.length === 0) {
      return {
        ok: true,
        items: [],
        totalCount: res.pagination?.totalCount ?? 0,
        feedback: notFoundProductFeedback(q),
      };
    }
    return {
      ok: true,
      items: res.data,
      totalCount: res.pagination?.totalCount,
    };
  } catch (e) {
    return lookupFailure(e);
  }
}

export type SubiektSupplierSuggestion = {
  supplierId: string | null;
  label: string;
  detail?: string;
  source: "app" | "subiekt";
};

export type SubiektSupplierSuggestResult =
  | {
      ok: true;
      suggestions: SubiektSupplierSuggestion[];
      feedback?: SubiektFeedback;
      subiektWarning?: SubiektFeedback;
    }
  | { ok: false; feedback: SubiektFeedback };

/** Wyszukiwanie dostawcy — panel admina. */
export async function actionSubiektLookupSupplier(
  query: string
): Promise<SubiektLookupResult<SubiektKontrahent>> {
  await requireAdmin();
  const q = query.trim();
  if (!q) return validationFailure("empty_query");
  if (!isSubiektConfigured()) {
    return { ok: false, feedback: getSubiektFeedback("not_configured") };
  }

  try {
    const res = await searchSubiektSuppliers({
      search: q,
      symbol: q,
      pageSize: 10,
      page: 1,
    });
    if (res.data.length === 0) {
      return {
        ok: true,
        items: [],
        totalCount: 0,
        feedback: notFoundSupplierFeedback(q),
      };
    }
    return { ok: true, items: res.data, totalCount: res.pagination?.totalCount };
  } catch (e) {
    return lookupFailure(e);
  }
}

/** Podpowiedzi dostawcy — lista app + Subiekt. */
export async function actionSubiektSuggestSuppliers(
  query: string,
  appSuppliers: AppSupplierRef[]
): Promise<SubiektSupplierSuggestResult> {
  await requireSubiektLookup();
  const q = query.trim().toLowerCase();
  if (!q) {
    return { ok: true, suggestions: [] };
  }

  const appMatches: SubiektSupplierSuggestion[] = appSuppliers
    .filter((s) => s.name.toLowerCase().includes(q))
    .slice(0, 12)
    .map((s) => ({
      supplierId: s.id,
      label: s.name,
      source: "app" as const,
    }));

  if (!isSubiektConfigured()) {
    if (appMatches.length === 0) {
      return {
        ok: true,
        suggestions: [],
        feedback: getSubiektFeedback("not_found_app_supplier"),
      };
    }
    return { ok: true, suggestions: appMatches };
  }

  try {
    const res = await searchSubiektSuppliers({
      search: query.trim(),
      pageSize: 8,
      page: 1,
    });

    const subiektSuggestions: SubiektSupplierSuggestion[] = [];
    const seenIds = new Set(appMatches.map((m) => m.supplierId));

    for (const k of res.data) {
      const matchedId = matchSubiektKontrahentToSupplier(k, appSuppliers);
      if (matchedId && !seenIds.has(matchedId)) {
        seenIds.add(matchedId);
        const appName = appSuppliers.find((s) => s.id === matchedId)?.name;
        subiektSuggestions.push({
          supplierId: matchedId,
          label: appName ?? formatSubiektKontrahentLabel(k),
          detail: "Dopasowano z Subiekta",
          source: "subiekt",
        });
      } else if (!matchedId) {
        subiektSuggestions.push({
          supplierId: null,
          label: formatSubiektKontrahentLabel(k),
          detail: "Brak w bazie aplikacji — wybierz ręcznie lub zostaw puste",
          source: "subiekt",
        });
      }
    }

    const suggestions = [...appMatches, ...subiektSuggestions].slice(0, 14);
    const feedback =
      suggestions.length === 0
        ? getSubiektFeedback("not_found_app_supplier", {
            message: `Brak dostawcy w systemie i w Subiekcie dla „${query.trim()}”.`,
          })
        : appMatches.length === 0 && res.data.length === 0
          ? notFoundSupplierFeedback(query.trim())
          : undefined;

    return { ok: true, suggestions, feedback };
  } catch (e) {
    const feedback = feedbackFromException(e);
    if (feedback.code === "not_configured") {
      return appMatches.length
        ? { ok: true, suggestions: appMatches }
        : { ok: true, suggestions: [], feedback: getSubiektFeedback("not_found_app_supplier") };
    }
    if (appMatches.length > 0) {
      return {
        ok: true,
        suggestions: appMatches,
        subiektWarning: getSubiektFeedback("subiekt_unavailable", {
          message: feedback.message,
          hint: feedback.hint,
        }),
      };
    }
    return { ok: false, feedback };
  }
}
