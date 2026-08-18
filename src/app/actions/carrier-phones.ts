"use server";

// @service-role-ok — autoryzacja w warstwie aplikacji; service role z pełnym scope.

import { revalidatePath } from "next/cache";
import { getSessionUser, requireWarehouse } from "@/lib/auth";
import { canAccessCarrierPhones } from "@/lib/auth-roles";
import {
  fetchCarrierPhones,
  createCarrierPhone,
  updateCarrierPhone,
  deleteCarrierPhone,
  type CarrierPhoneRow,
} from "@/lib/data/carrier-phones";
import { userFacingErrorFromUnknown } from "@/lib/ui/user-facing-error";

function revalidatePhonePaths() {
  revalidatePath("/kolejka");
  revalidatePath("/kurierzy");
}

export type CarrierPhonesFetchResult =
  | { ok: true; phones: CarrierPhoneRow[] }
  | {
      ok: false;
      /** Krótki kod pod UI (Alert / toast). */
      code: "unauthorized" | "error";
      /** Już bezpieczny, ludzki opis — bez stacka. */
      message: string;
      title: string;
    };

function unauthorizedResult(): Extract<CarrierPhonesFetchResult, { ok: false }> {
  const copy = userFacingErrorFromUnknown(
    new Error("Brak uprawnień do numerów kurierów")
  );
  return {
    ok: false,
    code: "unauthorized",
    title: copy.title,
    message: copy.description,
  };
}

/** Odczyt numerów — wynik strukturalny (bez throw → bez surowych dumpów Next). */
export async function actionFetchCarrierPhones(
  carrierSlug?: string
): Promise<CarrierPhonesFetchResult> {
  try {
    const user = await getSessionUser();
    if (!user) {
      const copy = userFacingErrorFromUnknown(
        new Error("Brak sesji — zaloguj się ponownie.")
      );
      return {
        ok: false,
        code: "unauthorized",
        title: copy.title,
        message: copy.description,
      };
    }
    if (!canAccessCarrierPhones(user.role, user.assignedWorkspaces)) {
      return unauthorizedResult();
    }
    const phones = await fetchCarrierPhones(carrierSlug);
    return { ok: true, phones };
  } catch (e) {
    const copy = userFacingErrorFromUnknown(
      e,
      "Nie udało się wczytać numerów telefonów kurierów."
    );
    return {
      ok: false,
      code: copy.kind === "unauthorized" ? "unauthorized" : "error",
      title: copy.title,
      message: copy.description,
    };
  }
}

export async function actionCreateCarrierPhone(input: {
  carrierSlug: string;
  label: string;
  phone: string;
  sortOrder?: number;
}): Promise<{ success: true } | { error: string; title?: string }> {
  try {
    await requireWarehouse("mutate");
  } catch (e) {
    const copy = userFacingErrorFromUnknown(e);
    return { error: copy.description, title: copy.title };
  }

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
    const copy = userFacingErrorFromUnknown(
      e,
      "Nie udało się dodać numeru."
    );
    return { error: copy.description, title: copy.title };
  }
}

export async function actionUpdateCarrierPhone(input: {
  id: string;
  label: string;
  phone: string;
  sortOrder?: number;
}): Promise<{ success: true } | { error: string; title?: string }> {
  try {
    await requireWarehouse("mutate");
  } catch (e) {
    const copy = userFacingErrorFromUnknown(e);
    return { error: copy.description, title: copy.title };
  }

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
    const copy = userFacingErrorFromUnknown(
      e,
      "Nie udało się zapisać numeru."
    );
    return { error: copy.description, title: copy.title };
  }
}

export async function actionDeleteCarrierPhone(
  id: string
): Promise<{ success: true } | { error: string; title?: string }> {
  try {
    await requireWarehouse("mutate");
  } catch (e) {
    const copy = userFacingErrorFromUnknown(e);
    return { error: copy.description, title: copy.title };
  }

  try {
    await deleteCarrierPhone(id);
    revalidatePhonePaths();
    return { success: true };
  } catch (e) {
    const copy = userFacingErrorFromUnknown(
      e,
      "Nie udało się usunąć numeru."
    );
    return { error: copy.description, title: copy.title };
  }
}
