"use server";

// @service-role-ok — autoryzacja requireWarehouse(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireWarehouse } from "@/lib/auth";
import {
  fetchCarrierPhones,
  createCarrierPhone,
  updateCarrierPhone,
  deleteCarrierPhone,
  type CarrierPhoneRow,
} from "@/lib/data/carrier-phones";

function revalidatePhonePaths() {
  revalidatePath("/kolejka");
}

export async function actionFetchCarrierPhones(
  carrierSlug?: string
): Promise<CarrierPhoneRow[]> {
  await requireWarehouse();
  return fetchCarrierPhones(carrierSlug);
}

export async function actionCreateCarrierPhone(input: {
  carrierSlug: string;
  label: string;
  phone: string;
  sortOrder?: number;
}): Promise<{ success: true } | { error: string }> {
  await requireWarehouse("mutate");

  const phone = input.phone.trim();
  if (!phone) return { error: "Podaj numer telefonu." };
  if (phone.length > 40) return { error: "Numer telefonu jest zbyt długi (max 40 znaków)." };

  const label = input.label.trim();
  if (label.length > 80) return { error: "Etykieta jest zbyt długa (max 80 znaków)." };

  try {
    await createCarrierPhone({
      carrierSlug: input.carrierSlug,
      label,
      phone,
      sortOrder: input.sortOrder,
    });
    revalidatePhonePaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się dodać numeru." };
  }
}

export async function actionUpdateCarrierPhone(input: {
  id: string;
  label: string;
  phone: string;
  sortOrder?: number;
}): Promise<{ success: true } | { error: string }> {
  await requireWarehouse("mutate");

  const phone = input.phone.trim();
  if (!phone) return { error: "Podaj numer telefonu." };
  if (phone.length > 40) return { error: "Numer telefonu jest zbyt długi (max 40 znaków)." };

  const label = input.label.trim();
  if (label.length > 80) return { error: "Etykieta jest zbyt długa (max 80 znaków)." };

  try {
    await updateCarrierPhone({
      id: input.id,
      label,
      phone,
      sortOrder: input.sortOrder,
    });
    revalidatePhonePaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać numeru." };
  }
}

export async function actionDeleteCarrierPhone(
  id: string
): Promise<{ success: true } | { error: string }> {
  await requireWarehouse("mutate");

  try {
    await deleteCarrierPhone(id);
    revalidatePhonePaths();
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się usunąć numeru." };
  }
}
