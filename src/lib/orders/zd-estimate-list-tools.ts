import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";

export type ZdEstimateListToolsMode = "idle" | "selection";

export type ZdEstimateListToolKey =
  | "pair"
  | "bom"
  | "packagingSet"
  | "packagingClear"
  | "exclude"
  | "restore"
  | "onRequest"
  | "clearOnRequest"
  | "reviewAccept"
  | "reviewZero";

export type ZdEstimateListToolState = {
  enabled: boolean;
  title: string;
  /** Wyróżnienie wizualne — tylko gdy `enabled` (nie na disabled primary). */
  accent: boolean;
  labelSuffix: string;
};

export type ZdEstimateListToolStates = Record<
  ZdEstimateListToolKey,
  ZdEstimateListToolState
>;

export function resolveZdEstimateListToolsMode(
  selectedCount: number
): ZdEstimateListToolsMode {
  return selectedCount > 0 ? "selection" : "idle";
}

export function resolveZdEstimateListToolStates(input: {
  selectedCount: number;
  excludeEligibleCount: number;
  restoreEligibleCount: number;
  packagingClearEligibleCount: number;
  onRequestEligibleCount: number;
  clearOnRequestEligibleCount: number;
  reviewEligibleCount?: number;
  pairsTrusted: boolean;
  bomsTrusted: boolean;
  packagingTrusted: boolean;
  exclusionsTrusted: boolean;
  onRequestTrusted: boolean;
}): ZdEstimateListToolStates {
  const {
    selectedCount,
    excludeEligibleCount,
    restoreEligibleCount,
    packagingClearEligibleCount,
    onRequestEligibleCount,
    clearOnRequestEligibleCount,
    reviewEligibleCount = 0,
    pairsTrusted,
    bomsTrusted,
    packagingTrusted,
    exclusionsTrusted,
    onRequestTrusted,
  } = input;

  const pairOk = selectedCount === 2 && pairsTrusted;
  const bomOk = selectedCount >= 2 && bomsTrusted;
  const packagingSetOk = packagingTrusted && selectedCount > 0;
  const packagingClearOk =
    packagingTrusted && packagingClearEligibleCount > 0;
  const excludeOk = exclusionsTrusted && excludeEligibleCount > 0;
  const restoreOk = exclusionsTrusted && restoreEligibleCount > 0;
  // Mutual exclusivity z hard exclude — bez zaufanych wykluczeń nie wolno oznaczać.
  const onRequestOk =
    onRequestTrusted &&
    exclusionsTrusted &&
    onRequestEligibleCount > 0;
  const clearOnRequestOk =
    onRequestTrusted && clearOnRequestEligibleCount > 0;
  const reviewOk = reviewEligibleCount > 0;

  return {
    pair: {
      enabled: pairOk,
      title: !pairsTrusted
        ? "Wczytaj pary działu, żeby utworzyć parę z zaznaczenia"
        : selectedCount === 2
          ? "Utwórz parę montaż/demontaż: paczka kupowana na ZD ↔ sztuki sprzedawane"
          : "Zaznacz dokładnie 2 towary, żeby połączyć paczkę ze sztukami",
      accent: pairOk,
      labelSuffix: "",
    },
    bom: {
      enabled: bomOk,
      title: !bomsTrusted
        ? "Wczytaj składy działu, żeby utworzyć skład z zaznaczenia"
        : selectedCount >= 2
          ? ZD_BOM_UI.bulkTitleReady
          : ZD_BOM_UI.bulkTitleNeed,
      accent: bomOk && selectedCount >= 3,
      labelSuffix: "",
    },
    packagingSet: {
      enabled: packagingSetOk,
      title: !packagingTrusted
        ? "Wczytaj opakowania działu"
        : "Ustaw to samo opakowanie dla zaznaczonych (ile sztuk = 1 jednostka na ZD)",
      accent: packagingSetOk && selectedCount === 1,
      labelSuffix: "",
    },
    packagingClear: {
      enabled: packagingClearOk,
      title: !packagingTrusted
        ? "Wczytaj opakowania działu"
        : packagingClearEligibleCount > 0
          ? "Usuń opakowanie — zaznaczone wrócą do sztuk 1:1 w kolumnie Do ZD"
          : "Brak pozycji z opakowaniem w zaznaczeniu",
      accent: false,
      labelSuffix:
        packagingTrusted && packagingClearEligibleCount > 0
          ? ` (${packagingClearEligibleCount})`
          : "",
    },
    exclude: {
      enabled: excludeOk,
      title: !exclusionsTrusted
        ? "Wczytaj wykluczenia działu, żeby wykluczać z zaznaczenia"
        : excludeEligibleCount > 0
          ? "Wyklucz zaznaczone — nie trafią do Do ZD przy kolejnych „Policz listę”"
          : "Brak pozycji kwalifikujących się do wykluczenia",
      accent: excludeOk && selectedCount === 1,
      labelSuffix:
        exclusionsTrusted && excludeEligibleCount > 0
          ? ` (${excludeEligibleCount})`
          : "",
    },
    restore: {
      enabled: restoreOk,
      title: !exclusionsTrusted
        ? "Wczytaj wykluczenia działu, żeby przywracać z zaznaczenia"
        : restoreEligibleCount > 0
          ? "Przywróć zaznaczone wykluczone — wrócą na listę do zamówienia"
          : "Brak pozycji kwalifikujących się do przywrócenia",
      accent: restoreOk && selectedCount === 1,
      labelSuffix:
        exclusionsTrusted && restoreEligibleCount > 0
          ? ` (${restoreEligibleCount})`
          : "",
    },
    onRequest: {
      enabled: onRequestOk,
      title: !onRequestTrusted
        ? "Wczytaj listę „tylko na prośbę”"
        : !exclusionsTrusted
          ? "Wczytaj wykluczenia — „tylko na prośbę” nie może kasować niewczytanych wykluczeń"
          : onRequestEligibleCount > 0
            ? "Oznacz jako tylko na prośbę — poza Do ZD bez aktywnej prośby; z prośbą tylko ilość z prośby"
            : "Brak pozycji kwalifikujących się (już na liście / wykluczone)",
      accent: onRequestOk && selectedCount === 1,
      labelSuffix:
        onRequestTrusted &&
        exclusionsTrusted &&
        onRequestEligibleCount > 0
          ? ` (${onRequestEligibleCount})`
          : "",
    },
    clearOnRequest: {
      enabled: clearOnRequestOk,
      title: !onRequestTrusted
        ? "Wczytaj listę „tylko na prośbę”"
        : clearOnRequestEligibleCount > 0
          ? "Usuń „tylko na prośbę” — wraca zwykłe liczenie zapasu i tempa sprzedaży"
          : "Brak pozycji „tylko na prośbę” w zaznaczeniu",
      accent: false,
      labelSuffix:
        onRequestTrusted && clearOnRequestEligibleCount > 0
          ? ` (${clearOnRequestEligibleCount})`
          : "",
    },
    reviewAccept: {
      enabled: reviewOk,
      title: reviewOk
        ? "Zdejmuje oznaczenie „Do weryfikacji” tylko w tej sesji — nie zmienia ilości Do ZD"
        : "Brak pozycji „Do weryfikacji” w zaznaczeniu",
      accent: false,
      labelSuffix: reviewOk ? ` (${reviewEligibleCount})` : "",
    },
    reviewZero: {
      enabled: reviewOk,
      title: reviewOk
        ? "Ustawia Do ZD = 0 i zdejmuje „Do weryfikacji” w tej sesji"
        : "Brak pozycji „Do weryfikacji” w zaznaczeniu",
      accent: false,
      labelSuffix: "",
    },
  };
}

/** Mikro-hint gdy część zaznaczenia jest poza aktualnym filtrem/szukaniem. */
export function zdEstimateSelectionOutsideVisibleHint(
  selectedCount: number,
  visibleSelectedCount: number
): string | null {
  const outside = selectedCount - visibleSelectedCount;
  if (outside <= 0 || selectedCount <= 0) return null;
  return outside === 1
    ? "1 poza filtrem/szukaniem"
    : `${outside} poza filtrem/szukaniem`;
}

/** Widoczna etykieta licznika zaznaczenia (1 / 2–4 / 5+). */
export function zdEstimateSelectionCountLabel(count: number): string {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  if (n === 1) return "1 zaznaczony produkt";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${n} zaznaczone produkty`;
  }
  return `${n} zaznaczonych produktów`;
}

export function filterZdEstimateLinesBySearch<
  T extends {
    tw_Symbol: string;
    tw_Nazwa: string;
    tw_Id?: number;
    tw_PLU?: string | null;
  },
>(lines: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return lines;
  return lines.filter((l) => {
    if (l.tw_Symbol.toLowerCase().includes(q)) return true;
    if (l.tw_Nazwa.toLowerCase().includes(q)) return true;
    const plu = l.tw_PLU?.trim().toLowerCase();
    if (plu && plu.includes(q)) return true;
    if (l.tw_Id != null && String(l.tw_Id).includes(q)) return true;
    return false;
  });
}
