/**
 * Hierarchia chipów kolumny Status w liście szacunku ZD:
 * wykluczenie (manual / auto / soft) > prośba > para > BOM > statusy sesji / lifted.
 * UI pokazuje chipy w kolejności priorytetu (kilka naraz; +N tylko przy rzadkim overflow).
 */

export type ZdEstimateNameMetaKind =
  | "excluded"
  | "individual"
  | "pair"
  | "bom"
  | "session_include"
  | "name_auto_exclude"
  | "soft_on_request"
  | "lifted_extra_only";

/** Wyższa liczba = ważniejsze (primary). */
export const ZD_ESTIMATE_NAME_META_PRIORITY: Record<
  ZdEstimateNameMetaKind,
  number
> = {
  excluded: 100,
  /** Auto-wykluczenie = ten sam „tier” co exclude (nad parą / prośbą). */
  name_auto_exclude: 98,
  soft_on_request: 96,
  /** Wyjątek sesji — ważne nad meta pary/BOM. */
  session_include: 85,
  individual: 80,
  pair: 60,
  bom: 50,
  lifted_extra_only: 25,
};

export type ZdEstimateNameMetaCandidate = {
  kind: ZdEstimateNameMetaKind;
  /** Krótka etykieta do tooltipa overflow (+N). */
  summary: string;
};

export function compareZdEstimateNameMetaPriority(
  a: ZdEstimateNameMetaKind,
  b: ZdEstimateNameMetaKind
): number {
  return (
    ZD_ESTIMATE_NAME_META_PRIORITY[b] - ZD_ESTIMATE_NAME_META_PRIORITY[a]
  );
}

/** Sortuje malejąco po priorytecie; stabilnie względem kolejności wejścia. */
export function sortZdEstimateNameMetaCandidates<
  T extends { kind: ZdEstimateNameMetaKind },
>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byPri = compareZdEstimateNameMetaPriority(a.item.kind, b.item.kind);
      if (byPri !== 0) return byPri;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export type ZdEstimateNameMetaStatusInput = {
  excluded: boolean;
  sessionIncluded: boolean;
  hasNameAutoExclude: boolean;
  softOnRequest: boolean;
  liftedExtraOnly: boolean;
};

/**
 * Jeden chip statusowy (wzajemnie wykluczające się gałęzie jak w workbenchu).
 * Meta pary / BOM / prośby dokładane osobno.
 */
export function resolveZdEstimateNameMetaStatus(
  input: ZdEstimateNameMetaStatusInput
): ZdEstimateNameMetaCandidate | null {
  if (input.sessionIncluded && input.hasNameAutoExclude) {
    return {
      kind: "session_include",
      summary: "dołączone (sesja)",
    };
  }
  if (input.hasNameAutoExclude) {
    return {
      kind: "name_auto_exclude",
      summary: "auto wykluczenie",
    };
  }
  if (input.softOnRequest) {
    return {
      kind: "soft_on_request",
      summary: "tylko na prośbę",
    };
  }
  if (input.liftedExtraOnly) {
    return {
      kind: "lifted_extra_only",
      summary: "na prośbę · w Do ZD",
    };
  }
  if (input.excluded) {
    return {
      kind: "excluded",
      summary: "wykluczone",
    };
  }
  return null;
}

export function buildZdEstimateNameMetaOverflowTitle(
  overflow: ZdEstimateNameMetaCandidate[]
): string {
  if (overflow.length === 0) return "";
  const lines = overflow.map((o) => `· ${o.summary}`);
  return [`Jeszcze ${overflow.length}:`, ...lines].join("\n");
}
