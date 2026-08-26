/**
 * Budowa opcji chipów zakresu z ulubionych + opcjonalnego enrich z Subiekta/bootstrap.
 */

import type {
  ZdEstimateCechaOption,
  ZdEstimateGroupOption,
} from "@/app/actions/zd-estimate";
import type { ZdEstimateFavoriteRef } from "@/lib/orders/zd-estimate-prefs";

const EMPTY_SUPPLIER = {
  supplierId: null as string | null,
  supplierName: null as string | null,
  dniZapasu: null as number | null,
  stockLabel: null as string | null,
  subiektKhId: null as number | null,
  additionalSubiektKhIds: [] as number[],
  supplierMatchSource: null as "mapping" | "name" | null,
  supplierMappingUnresolved: false,
};

export function zdEstimateGroupOptionFromFavorite(
  fav: ZdEstimateFavoriteRef,
  enriched?: ZdEstimateGroupOption | null
): ZdEstimateGroupOption {
  if (enriched && enriched.grt_Id === fav.id) {
    return {
      ...enriched,
      grt_Nazwa: enriched.grt_Nazwa?.trim() || fav.label,
    };
  }
  return {
    grt_Id: fav.id,
    grt_Nazwa: fav.label,
    ...EMPTY_SUPPLIER,
  };
}

export function zdEstimateCechaOptionFromFavorite(
  fav: ZdEstimateFavoriteRef,
  enriched?: ZdEstimateCechaOption | null
): ZdEstimateCechaOption {
  if (enriched && enriched.ctw_Id === fav.id) {
    return {
      ...enriched,
      ctw_Nazwa: enriched.ctw_Nazwa?.trim() || fav.label,
    };
  }
  return {
    ctw_Id: fav.id,
    ctw_Nazwa: fav.label,
    ...EMPTY_SUPPLIER,
  };
}

export function resolveZdEstimateFavoriteGroupChips(
  favorites: readonly ZdEstimateFavoriteRef[],
  enrichById: ReadonlyMap<number, ZdEstimateGroupOption>
): ZdEstimateGroupOption[] {
  return favorites.map((f) =>
    zdEstimateGroupOptionFromFavorite(f, enrichById.get(f.id) ?? null)
  );
}

export function resolveZdEstimateFavoriteCechaChips(
  favorites: readonly ZdEstimateFavoriteRef[],
  enrichById: ReadonlyMap<number, ZdEstimateCechaOption>
): ZdEstimateCechaOption[] {
  return favorites.map((f) =>
    zdEstimateCechaOptionFromFavorite(f, enrichById.get(f.id) ?? null)
  );
}
