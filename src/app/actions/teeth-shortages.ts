"use server";

// @service-role-ok — autoryzacja requireTeethPanel(); service role po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireTeethPanel } from "@/lib/auth";
import {
  fetchTeethShortages,
  setTeethShortageActive,
  upsertTeethShortageRow,
} from "@/lib/data/teeth-shortages";
import {
  TEETH_CHIP_OTHER,
  hasMouldsForKind,
  manufacturerForProductLine,
  mouldRequiredForKind,
  parseTeethKind,
  parseTeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { teethColorsForLine, toothMouldsForLine } from "@/lib/teeth/teeth-lines-data";
import { resolveSupplierForTeethManufacturer } from "@/lib/orders/teeth-ocr-prosba-prefill";
import { fetchSuppliersForForm } from "@/lib/data/queries";
import type { TeethSupplierShortageWithSupplier } from "@/types/database";

function revalidateShortagePaths() {
  revalidatePath("/zeby/braki");
  revalidatePath("/prosba");
  revalidatePath("/podsumowanie");
  revalidatePath("/moje");
  // AppShell ładuje aktywne braki w layoucie — bez tego ostrzeżenia zostają stale.
  revalidatePath("/", "layout");
}

export async function actionListTeethShortages(options?: {
  includeInactive?: boolean;
}): Promise<TeethSupplierShortageWithSupplier[]> {
  await requireTeethPanel("read");
  return fetchTeethShortages(options);
}

export type TeethShortageUpsertPayload = {
  id?: string | null;
  supplierId: string;
  productLine: string;
  color: string;
  mould?: string | null;
  kind?: string | null;
  availableFrom?: string | null;
  note?: string | null;
  dateUndetermined?: boolean;
};

export async function actionUpsertTeethShortage(
  payload: TeethShortageUpsertPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireTeethPanel("mutate");
  const productLine = parseTeethProductLine(payload.productLine);
  if (!productLine) return { ok: false, error: "Wybierz linię produktu z katalogu." };

  const manufacturer = manufacturerForProductLine(productLine);
  let supplierId = payload.supplierId?.trim() ?? "";
  if (!supplierId) {
    const suppliers = await fetchSuppliersForForm().catch(() => []);
    supplierId = resolveSupplierForTeethManufacturer(manufacturer, suppliers);
  }
  if (!supplierId) {
    return {
      ok: false,
      error:
        "Nie znaleziono dostawcy dla tej marki w kartach dostawców — dopisz dostawcę o nazwie producenta.",
    };
  }

  const color = payload.color?.trim() ?? "";
  if (!color || color === TEETH_CHIP_OTHER) {
    return { ok: false, error: "Wybierz kolor z katalogu (bez „inny”)." };
  }

  const palette = teethColorsForLine(productLine);
  if (palette.length > 0 && !palette.includes(color)) {
    return { ok: false, error: "Kolor nie należy do wybranej linii produktowej." };
  }

  const kind = parseTeethKind(payload.kind);
  const catalog = { productLine };

  let mould = (payload.mould ?? "").trim();
  if (mould === TEETH_CHIP_OTHER) {
    return { ok: false, error: "Wybierz fason z katalogu (bez „inny”)." };
  }

  if (kind) {
    if (mouldRequiredForKind(catalog, kind)) {
      if (!mould) return { ok: false, error: "Podaj fason dla tej linii." };
      const allowed = toothMouldsForLine(productLine, kind);
      if (allowed.length > 0 && !allowed.includes(mould)) {
        return { ok: false, error: "Fason nie należy do wybranej linii / typu." };
      }
    } else if (!hasMouldsForKind(catalog, kind)) {
      mould = "";
    }
  } else {
    // Bez kind — fason tylko gdy linia ma fasony; przy „bez rozróżnienia” zwykle pusty.
    const anterior = hasMouldsForKind(catalog, "anterior");
    const posterior = hasMouldsForKind(catalog, "posterior");
    if (!anterior && !posterior) {
      mould = "";
    } else if (mould) {
      const allowedAnt = toothMouldsForLine(productLine, "anterior");
      const allowedPost = toothMouldsForLine(productLine, "posterior");
      const ok =
        allowedAnt.includes(mould) ||
        allowedPost.includes(mould) ||
        (allowedAnt.length === 0 && allowedPost.length === 0);
      if (!ok) {
        return { ok: false, error: "Fason nie należy do wybranej linii." };
      }
    }
  }

  const availableFrom =
    payload.dateUndetermined || !payload.availableFrom?.trim()
      ? null
      : payload.availableFrom.trim();

  if (availableFrom && !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom)) {
    return { ok: false, error: "Nieprawidłowa data dostępności." };
  }

  try {
    await upsertTeethShortageRow({
      id: payload.id,
      supplierId,
      productLine,
      manufacturer,
      color,
      mould,
      kind,
      availableFrom,
      note: (payload.note?.trim() ?? "").slice(0, 500),
      actorUserId: user.id,
    });
    revalidateShortagePaths();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Nie udało się zapisać braku.",
    };
  }
}

export async function actionSetTeethShortageActive(input: {
  id: string;
  active: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireTeethPanel("mutate");
  const id = input.id?.trim();
  if (!id) return { ok: false, error: "Brak identyfikatora." };
  try {
    await setTeethShortageActive({
      id,
      active: input.active,
      actorUserId: user.id,
    });
    revalidateShortagePaths();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Nie udało się zaktualizować statusu.",
    };
  }
}
