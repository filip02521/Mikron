"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireWarehouse, requireSupplierManagement } from "@/lib/auth";
import {
  countWarehouseCarrierUsage,
  fetchWarehouseCarriers,
  type WarehouseCarrierRow,
} from "@/lib/data/warehouse-carriers";
import { createAdminClient } from "@/lib/supabase/admin";
import { uniqueWarehouseCarrierSlug } from "@/lib/warehouse/carrier-slug";

function revalidateCarrierPaths() {
  revalidatePath("/kolejka");
  revalidatePath("/admin/dostawcy");
  revalidatePath("/admin/dostawcy/nieaktywni");
  revalidatePath("/zakupy/dostawcy");
  revalidatePath("/zakupy/dostawcy/nieaktywni");
}

export async function actionListWarehouseCarriers(): Promise<WarehouseCarrierRow[]> {
  await requireWarehouse();
  return fetchWarehouseCarriers();
}

export async function actionUpsertWarehouseCarrier(form: {
  slug?: string;
  label: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<{ success: true; slug: string } | { error: string }> {
  await requireSupplierManagement("mutate");

  const label = form.label.trim();
  if (!label) return { error: "Podaj nazwę kuriera." };
  if (label.length > 80) return { error: "Nazwa kuriera jest zbyt długa (max 80 znaków)." };

  const sortOrder =
    typeof form.sortOrder === "number" && Number.isFinite(form.sortOrder)
      ? Math.max(0, Math.floor(form.sortOrder))
      : 0;

  const supabase = createAdminClient();
  const existing = await fetchWarehouseCarriers();
  const taken = new Set(existing.map((carrier) => carrier.slug));

  const duplicateLabel = existing.find(
    (carrier) =>
      carrier.label.trim().toLowerCase() === label.toLowerCase() &&
      carrier.slug !== form.slug
  );
  if (duplicateLabel) {
    return { error: `Kurier „${duplicateLabel.label}" już jest na liście.` };
  }

  if (form.slug?.trim()) {
    const slug = form.slug.trim();
    const current = existing.find((carrier) => carrier.slug === slug);
    if (!current) return { error: "Nie znaleziono kuriera." };

    const { error } = await supabase
      .from("warehouse_carriers")
      .update({
        label,
        sort_order: sortOrder > 0 ? sortOrder : current.sortOrder,
        is_active: form.isActive ?? current.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", slug);

    if (error) return { error: error.message };
    revalidateCarrierPaths();
    return { success: true, slug };
  }

  const slug = uniqueWarehouseCarrierSlug(label, taken);
  const nextSort =
    sortOrder > 0
      ? sortOrder
      : Math.max(0, ...existing.map((carrier) => carrier.sortOrder)) + 10;

  const { error } = await supabase.from("warehouse_carriers").insert({
    slug,
    label,
    sort_order: nextSort,
    is_active: true,
  });

  if (error) return { error: error.message };
  revalidateCarrierPaths();
  return { success: true, slug };
}

export async function actionDeleteWarehouseCarrier(
  slug: string
): Promise<{ success: true } | { error: string }> {
  await requireSupplierManagement("mutate");

  const supabase = createAdminClient();
  const { data: carrier } = await supabase
    .from("warehouse_carriers")
    .select("label")
    .eq("slug", slug)
    .maybeSingle();

  if (!carrier) return { error: "Nie znaleziono kuriera." };

  const usage = await countWarehouseCarrierUsage(slug);
  if (usage > 0) {
    return {
      error: `Nie można usunąć „${carrier.label}" — użyty w ${usage} wpisach lub ustawieniach. Ukryj go zamiast usuwać.`,
    };
  }

  const { error } = await supabase.from("warehouse_carriers").delete().eq("slug", slug);
  if (error) return { error: error.message };

  revalidateCarrierPaths();
  return { success: true };
}

export async function actionSetWarehouseCarrierActive(
  slug: string,
  isActive: boolean
): Promise<{ success: true } | { error: string }> {
  await requireSupplierManagement("mutate");

  const supabase = createAdminClient();
  const { data: carrier } = await supabase
    .from("warehouse_carriers")
    .select("label")
    .eq("slug", slug)
    .maybeSingle();

  if (!carrier) return { error: "Nie znaleziono kuriera." };

  const { error } = await supabase
    .from("warehouse_carriers")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) return { error: error.message };
  revalidateCarrierPaths();
  return { success: true };
}

export async function assertWarehouseCarrierSlug(
  slug: string
): Promise<string> {
  const trimmed = slug.trim();
  const carriers = await fetchWarehouseCarriers();
  const match = carriers.find((carrier) => carrier.slug === trimmed);
  if (!match) {
    throw new Error(
      `Nieprawidłowy kurier „${slug}". Odśwież stronę i wybierz kuriera z listy.`
    );
  }
  return trimmed;
}

/** @deprecated Użyj assertWarehouseCarrierSlug — autouzupełnianie może zwracać ukryte slugi z historii. */
export async function assertActiveWarehouseCarrierSlug(
  slug: string
): Promise<string> {
  return assertWarehouseCarrierSlug(slug);
}
