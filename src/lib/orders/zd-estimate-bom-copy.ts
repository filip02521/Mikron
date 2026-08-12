/**
 * Teksty UI składów/kompletów w kreatorze ZD — poprawna polszczyzna, bez angielskich skrótów.
 */

import type { BomPresetId } from "@/lib/orders/zd-estimate-bom-policy";

/** Odmiana: 1 skład, 2–4 składy, 5+ składów. */
export function formatZdBomCountLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return "Brak zapisanych składów";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "1 skład";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${n} składy`;
  }
  return `${n} składów`;
}

export function formatZdBomVisibleCountLabel(
  visible: number,
  total: number
): string {
  return `Widoczne ${visible} z ${total}`;
}

export const ZD_BOM_UI = {
  panelTitle: "Składy",
  modalTitle: "Składy i komplety",
  modalHint:
    "Trzy tryby: (1) Składamy — zestaw nie idzie na ZD, sprzedaż obciąża składniki; (2) Kupujemy K i części — komplet i składniki osobno; (3) Tylko komplet — na ZD wyłącznie zestaw. Pary karton↔sztuki to osobny mechanizm.",

  introTitle: "Zestaw i składniki",
  introBody:
    "Wybierz preset zakupu, zapisz — lista przelicza się od razu (potem pary montaż/demontaż). Przy „Składamy” stan zestawu domyślnie wlicza się w pokrycie składników.",

  seedHeading: "Zaznaczone towary — wskaż zestaw",
  roleZestaw: "Zestaw",
  roleSkladnik: "Składnik ×1",

  presetLegend: "Jak kupować zestaw?",
  presetAssemble: "Składamy (tylko składniki)",
  presetAssembleHint:
    "Zestaw nie trafia na ZD. Sprzedaż zestawu doliczana jest do składników.",
  presetBuySeparate: "Kupujemy K i części",
  presetBuySeparateHint:
    "Komplet i składniki zamawiane osobno — każdy wg własnej sprzedaży.",
  presetKitOnly: "Tylko komplet",
  presetKitOnlyHint:
    "Na ZD tylko zestaw. Składniki zablokowane (alert przy ich sprzedaży lub prośbie).",

  stockAsCoverLabel: "Wliczaj stan zestawu do pokrycia składników",
  stockAsCoverHintSeed:
    "Jeśli na magazynie leży osobno zestaw i osobno składniki, pokrycie może się zdublować — wtedy wyłącz tę opcję świadomie.",
  stockAsCoverHintManual:
    "Domyślnie włączone przy „Składamy”. Wyłącz, gdy zestaw i składniki są trzymane osobno na magazynie.",

  pieceWarningSeed: (twIds: number[]) =>
    `Jeden ze składników jest towarem „na sztuki” w parze (id. ${twIds.join(", ")}). Zamówienie i tak przejdzie na paczkę przez parę — lepiej wskazać karton (paczkę) jako składnik.`,
  pieceWarningManual:
    "Składnik jest towarem „na sztuki” w parze — lepiej wskazać paczkę (karton).",

  labelOptional: "Etykieta (opcjonalnie)",
  labelPlaceholder: "np. Castorit — masa + płyn",
  saveButton: "Zapisz skład",
  addComponent: "Dodaj składnik",
  removeBomTitle: "Usuń skład",

  fieldZestawId: "Id. zestawu (Subiekt)",
  fieldSkladnikId: "Id. składnika",
  fieldQtyPerZestaw: "Ilość na 1 zestaw",
  fieldSymbol: "Symbol",
  fieldLabel: "Etykieta",
  searchPlaceholder: "symbol, nazwa, id. towaru…",

  emptyTitle: "Brak składów",
  emptyDescription:
    "Dodaj komplet / promocję (zestaw i składniki) albo zaznacz towary na liście szacunku i wybierz „Skład”.",

  needComponent: "Dodaj co najmniej jeden składnik.",
  listCoverOn: "stan zestawu w pokryciu",
  listCoverOff: "bez wliczania stanu zestawu",
  listPresetAssemble: "składamy",
  listPresetBuySeparate: "kupujemy K i części",
  listPresetKitOnly: "tylko komplet",

  badgeZestawTitle:
    "Składamy: ten towar nie idzie na ZD — popyt i pokrycie są na składnikach.",
  badgeZestawRole: "zestaw",
  badgeNieZamawiasz: "nie zamawiasz",
  badgePurchasedKitTitle:
    "Komplet kupowany osobno: ten towar może iść na ZD wg własnej sprzedaży.",
  badgePurchasedKitRole: "komplet · kupowany",
  badgeKitOnlyTitle:
    "Tylko komplet: na ZD idzie zestaw; składniki są zablokowane.",
  badgeKitOnlyRole: "komplet · tylko zestaw",
  badgeSkladnikRole: "składnik",
  badgePurchaseBlockedRole: "składnik · nie kupujesz",
  badgePurchaseBlockedTitle:
    "Preset „Tylko komplet”: ten składnik nie idzie na ZD. Zamawiaj zestaw albo zmień preset.",
  badgeMissingShort: "Brak towaru w wyniku — ilość może być niepełna",
  badgeMissingTitle:
    "Brakuje towaru ze składu w wyniku szacunku — kliknij „Policz listę”, aby dociągnąć dane z Subiekta.",
  badgeContributionTitle: (parentIds: number[]) =>
    parentIds.length
      ? `Wkład ze składu (id. zestawu: ${parentIds.join(", ")}).`
      : "Wkład ze składu.",
  badgeSalesFromZestaw: (qtyLabel: string, parentId?: number) =>
    parentId != null
      ? `+${qtyLabel} z zestawu (id. ${parentId})`
      : `+${qtyLabel} z zestawu`,
  badgeSalesZero: "brak wkładu ze sprzedaży",
  badgeCoverExtra: (qtyLabel: string) => ` · pokrycie +${qtyLabel}`,

  alertKitOnlySalesTitle: "Składniki bez ścieżki zakupu",
  alertKitOnlySalesBody: (count: number) => {
    const noun = count === 1 ? "składnik ma" : "składniki mają";
    return `${count} ${noun} sprzedaż lub prośbę przy presecie „Tylko komplet” — na ZD nie wejdą jako pozycje katalogowe. Zmień preset albo zamów komplet.`;
  },
  alertExplodeIncompleteTitle: "Skład explode niekompletny",
  alertExplodeIncompleteBody:
    "Brakuje węzłów składu „Składamy” w wyniku — Do ZD / Create zablokowane, aż dociągniesz towary (Policz ponownie).",

  bulkButton: "Skład",
  bulkTitleReady: "Utwórz skład / komplet — wskaż zestaw",
  bulkTitleNeed: "Zaznacz co najmniej 2 towary (zestaw i składniki)",
  selectNeedTwo:
    "Zaznacz co najmniej 2 towary (zestaw oraz składniki promocji).",

  flashSavedNoList:
    "Zapisano składy. Kliknij „Policz listę”, aby zobaczyć efekt na liście.",
  flashFetching: "Skład zapisany — dociągam brakujące towary z Subiekta…",
  flashOutsideList:
    "Skład zapisany, ale towar jest poza listą — kliknij „Policz listę”, aby dociągnąć dane.",
  flashUpdated: "Składy zaktualizowane — wkład i „Do ZD” przeliczone.",

  alertUnavailableTitle: "Składy i komplety niedostępne",
  alertUnavailableBody:
    "Bez listy składów zestaw mógłby dostać niewłaściwą ilość na ZD. Wczytaj listę przed szacunkiem.",
  alertReload: "Wczytaj składy ponownie",
  alertReloadShort: "Wczytaj składy",
  alertMissingTitle: "Brak towaru ze składu w szacunku",
  alertMissingBody: (count: number) => {
    const noun = count === 1 ? "towaru" : "towarów";
    return `Nie udało się dociągnąć ${count} ${noun} ze składu — wkład na składniki może być niepełny.`;
  },

  refreshFailed: (detail: string) =>
    `Odświeżenie składów nie powiodło się (${detail}). Użyto listy z momentu szacunku.`,

  estimateBlockedTitle: "Składy niedostępne",
  estimateBlockedMessage: (detail: string) =>
    `Lista nie została pokazana — bez listy składów zestawy mogłyby dostać niewłaściwą ilość na ZD. ${detail}`,

  loadError: "Nie udało się wczytać składów i kompletów.",
  loadErrorShort: "Nie udało się wczytać składów.",
  saveError: "Nie udało się zapisać składu.",
  deleteError: "Nie udało się usunąć składu.",
  errBadPolicy: "Niedozwolona kombinacja presetu zakupu dla składu.",

  errBadParentId: "Nieprawidłowy identyfikator towaru zestawu.",
  errNeedComponent: "Skład musi mieć co najmniej jeden składnik.",
  errBadComponent: "Nieprawidłowy składnik (wymagane id. towaru oraz ilość ≥ 1).",
  errParentIsComponent: "Zestaw nie może być jednocześnie swoim składnikiem.",
  errDuplicateComponent: "Ten składnik jest już dodany do składu.",
  errParentInPair: (packLabel: string, pieceLabel: string) =>
    `Ten towar jest już w parze komplet (${packLabel} ↔ ${pieceLabel}) — nie może być zestawem w składzie.`,
  errReadBack: "Nie udało się odczytać zapisanego składu.",
  errPairIsBomParent: (label: string) =>
    `Towar ${label} jest zestawem w składzie / komplecie — nie może wejść do pary.`,

  settingsPart: (detail: string) => `składy (${detail})`,
  settingsNeedAll:
    "Brak wczytanych ustawień szacunku (wykluczenia, opakowania, pary, składy, zęby).",
  settingsFail: (parts: string) =>
    `Nie można przygotować ZD — ustawienia niedostępne: ${parts}. Odśwież stronę lub otwórz panele Wykluczenia / Opakowania / Pary / Składy.`,
  settingsEmptyHint:
    "Wczytaj wykluczenia, opakowania, pary, składy i katalog zębów, żeby zobaczyć bezpieczną listę do ZD.",
  copyNeedsSettings:
    "Wymaga wczytanych wykluczeń, opakowań, par, składów i zębów",
} as const;

export function zdBomPresetLabel(preset: BomPresetId): string {
  switch (preset) {
    case "buy_separate":
      return ZD_BOM_UI.presetBuySeparate;
    case "kit_only":
      return ZD_BOM_UI.presetKitOnly;
    case "assemble":
    default:
      return ZD_BOM_UI.presetAssemble;
  }
}

export function zdBomPresetListLabel(preset: BomPresetId): string {
  switch (preset) {
    case "buy_separate":
      return ZD_BOM_UI.listPresetBuySeparate;
    case "kit_only":
      return ZD_BOM_UI.listPresetKitOnly;
    case "assemble":
    default:
      return ZD_BOM_UI.listPresetAssemble;
  }
}
