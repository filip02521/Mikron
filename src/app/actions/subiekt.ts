"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSubiektLookup, requireSupplierManagement } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchSubiektProducts } from "@/lib/subiekt/api";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import { searchSubiektSuppliersCached } from "@/lib/subiekt/subiekt-runtime-cache";
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
import { lookupSupplierForSubiektProduct } from "@/lib/subiekt/product-supplier";
import { expandSupplierSearchQueries } from "@/lib/subiekt/supplier-search-tokens";
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

export type SubiektResolveSupplierResult =
  | {
      ok: true;
      supplierId: string;
      supplierName: string;
      documentNumber: string | null;
    }
  | { ok: false; feedback: SubiektFeedback };

/** Po wyborze towaru z Subiekta — dostawca z ostatniego ZD z tą pozycją. */
export async function actionSubiektResolveSupplierForProduct(
  product: SubiektProduct,
  appSuppliers: AppSupplierRef[]
): Promise<SubiektResolveSupplierResult> {
  await requireSubiektLookup();
  if (!isSubiektConfigured()) {
    return { ok: false, feedback: getSubiektFeedback("not_configured") };
  }

  try {
    const lookup = await lookupSupplierForSubiektProduct(product, appSuppliers);

    if (lookup.status === "mapped") {
      return {
        ok: true,
        supplierId: lookup.supplierId,
        supplierName: lookup.supplierName,
        documentNumber: lookup.documentNumber,
      };
    }

    if (lookup.status === "unmapped") {
      const nr = lookup.documentNumber ? ` (${lookup.documentNumber})` : "";
      return {
        ok: false,
        feedback: getSubiektFeedback("supplier_from_product_unmapped", {
          message: `W Subiekcie: ${lookup.subiektLabel}${nr} — wybierz odpowiednika w polu dostawcy.`,
        }),
      };
    }

    return {
      ok: false,
      feedback: getSubiektFeedback("not_found_supplier", {
        message: "Nie znaleziono ZD z tym towarem — wybierz dostawcę ręcznie lub zostaw puste.",
      }),
    };
  } catch (e) {
    return { ok: false, feedback: feedbackFromException(e) };
  }
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
    const res = await searchSubiektSuppliersCached({
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
export async function actionSetSupplierSubiektKhId(
  supplierId: string,
  subiektKhId: number | null
): Promise<{ ok: true } | { ok: false; feedback: SubiektFeedback }> {
  await requireSupplierManagement();

  if (subiektKhId != null && (!Number.isFinite(subiektKhId) || subiektKhId <= 0)) {
    return {
      ok: false,
      feedback: getSubiektFeedback("unknown", {
        message: "Nieprawidłowy identyfikator kontrahenta Subiekt.",
      }),
    };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("suppliers")
    .update({
      subiekt_kh_id: subiektKhId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", supplierId);

  if (error) {
    if (error.message?.includes("subiekt_kh_id")) {
      return {
        ok: false,
        feedback: getSubiektFeedback("unknown", {
          message: "Brak kolumny subiekt_kh_id — uruchom migrację 026_supplier_subiekt_kh_id.sql w Supabase.",
        }),
      };
    }
    return {
      ok: false,
      feedback: feedbackFromException(new Error(error.message)),
    };
  }

  revalidatePath("/admin/dostawcy");
  revalidatePath("/zakupy/dostawcy");
  revalidatePath("/podsumowanie");
  revalidatePath("/prosba");

  return { ok: true };
}

/**
 * Podpowiedzi z Subiekta (dopasowania i brak w bazie).
 * Lista „W systemie” filtruje klient — bez wysyłania całej bazy na serwer.
 */
export async function actionSubiektSuggestSuppliers(
  query: string
): Promise<SubiektSupplierSuggestResult> {
  await requireSubiektLookup();
  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  if (q.length < 2) {
    return { ok: true, suggestions: [] };
  }

  if (!isSubiektConfigured()) {
    return { ok: true, suggestions: [] };
  }

  const reachable = await isSubiektReachable();
  if (!reachable) {
    return {
      ok: true,
      suggestions: [],
      subiektWarning: getSubiektFeedback("subiekt_unavailable", {
        hint: "Wyszukiwanie w systemie działa — Subiekt jest offline.",
      }),
    };
  }

  try {
    const appSuppliers = await getAppSupplierRefsCached();
    const queries = expandSupplierSearchQueries(trimmed);
    const mergedKontrahenci: SubiektKontrahent[] = [];
    const seenKh = new Set<number>();

    for (const searchPhrase of queries) {
      const res = await searchSubiektSuppliersCached({
        search: searchPhrase,
        pageSize: 8,
        page: 1,
      });
      for (const k of res.data) {
        const khId = k.kh_Id;
        if (khId != null && Number.isFinite(khId)) {
          if (seenKh.has(khId)) continue;
          seenKh.add(khId);
        }
        mergedKontrahenci.push(k);
        if (mergedKontrahenci.length >= 12) break;
      }
      if (mergedKontrahenci.length >= 12) break;
    }

    const subiektSuggestions: SubiektSupplierSuggestion[] = [];
    const seenIds = new Set<string>();

    for (const k of mergedKontrahenci) {
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

    const feedback =
      subiektSuggestions.length === 0 && mergedKontrahenci.length === 0
        ? notFoundSupplierFeedback(trimmed)
        : undefined;

    return { ok: true, suggestions: subiektSuggestions, feedback };
  } catch (e) {
    return { ok: false, feedback: feedbackFromException(e) };
  }
}
