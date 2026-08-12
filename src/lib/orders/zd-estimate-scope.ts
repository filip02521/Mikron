/**
 * Walidacja zakresu kreatora ZD: grupa XOR cecha — nigdy bez filtra.
 */

export type ZdEstimateRunMode = "grupa" | "cecha";

export type ZdEstimateScopeResolved =
  | { ok: true; mode: "grupa"; grupaId: number; cechaId: null }
  | { ok: true; mode: "cecha"; grupaId: null; cechaId: number }
  | { ok: false; message: string; title: string };

export function resolveZdEstimateRunScope(input: {
  mode?: string | null;
  grupaId?: number | null;
  cechaId?: number | null;
}): ZdEstimateScopeResolved {
  const modeRaw = String(input.mode ?? "").trim().toLowerCase();
  const mode: ZdEstimateRunMode | null =
    modeRaw === "grupa" || modeRaw === "cecha"
      ? modeRaw
      : null;

  const grupaId = Math.trunc(Number(input.grupaId));
  const cechaId = Math.trunc(Number(input.cechaId));
  const hasGrupa = Number.isFinite(grupaId) && grupaId > 0;
  const hasCecha = Number.isFinite(cechaId) && cechaId > 0;

  if (!mode) {
    // Backward compat: sam grupaId bez mode
    if (hasGrupa && !hasCecha) {
      return { ok: true, mode: "grupa", grupaId, cechaId: null };
    }
    return {
      ok: false,
      title: "Brak zakresu",
      message: "Wybierz tryb szacunku: grupa towarowa albo cecha.",
    };
  }

  if (mode === "grupa") {
    if (!hasGrupa) {
      return {
        ok: false,
        title: "Brak grupy",
        message: "Wybierz grupę towarową (np. Falcon, Ivoclar Technical).",
      };
    }
    if (hasCecha) {
      return {
        ok: false,
        title: "Konflikt zakresu",
        message: "Podaj albo grupę, albo cechę — nie obie naraz.",
      };
    }
    return { ok: true, mode: "grupa", grupaId, cechaId: null };
  }

  if (!hasCecha) {
    return {
      ok: false,
      title: "Brak cechy",
      message: "Wybierz cechę towaru (np. Ivoclar).",
    };
  }
  if (hasGrupa) {
    return {
      ok: false,
      title: "Konflikt zakresu",
      message: "Podaj albo grupę, albo cechę — nie obie naraz.",
    };
  }
  return { ok: true, mode: "cecha", grupaId: null, cechaId };
}

/**
 * Czy echo parametry z API potwierdza zastosowany filtr.
 * Brak / zły id = stary build lub ignorowany parametr → niebezpieczna pełna lista.
 */
export function assertZdEstimateFilterEcho(input: {
  mode: ZdEstimateRunMode;
  expectedGrupaId: number | null;
  expectedCechaId: number | null;
  parametry: { grupaId?: unknown; cechaId?: unknown } | null | undefined;
}): { ok: true } | { ok: false; title: string; message: string } {
  const p = input.parametry ?? {};
  if (input.mode === "grupa") {
    const got = Math.trunc(Number(p.grupaId));
    if (!(got > 0) || got !== input.expectedGrupaId) {
      return {
        ok: false,
        title: "Filtr grupy nie potwierdzony",
        message:
          "API nie zwróciło parametry.grupaId zgodnego z żądaniem — lista mogłaby być nieprzefiltrowana. Sprawdź SUBIEKT_API_ORDERS_BASE_URL (:5080/:5082).",
      };
    }
    return { ok: true };
  }

  const got = Math.trunc(Number(p.cechaId));
  if (!(got > 0) || got !== input.expectedCechaId) {
    return {
      ok: false,
      title: "Filtr cechy nie potwierdzony",
      message:
        "API nie zwróciło parametry.cechaId zgodnego z żądaniem (stary build albo brak wsparcia). Bez filtra szacunek zwróciłby cały katalog — lista zablokowana.",
    };
  }
  return { ok: true };
}
