/**
 * Teksty UI składów/promocji w szacunku ZD — poprawna polszczyzna, bez angielskich skrótów.
 */

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
  modalTitle: "Składy i promocje",
  modalHint:
    "Zestaw (np. promocja wewnętrzna) nie trafia na ZD. Jego sprzedaż — a opcjonalnie też stan magazynowy — doliczana jest do składników w jednostkach z karty towaru.",

  introTitle: "Zestaw i składniki",
  introBody:
    "Po zapisaniu lista przelicza się od razu: sprzedaż zestawu przechodzi na składniki, potem uwzględniane są pary montaż/demontaż. Stan magazynowy zestawu jest domyślnie wliczany do pokrycia składników.",

  seedHeading: "Zaznaczone towary — wskaż zestaw (promocję)",
  roleZestaw: "Zestaw (nie na ZD)",
  roleSkladnik: "Składnik ×1",

  stockAsCoverLabel: "Wliczaj stan zestawu do pokrycia składników",
  stockAsCoverHintSeed:
    "Jeśli na magazynie leży osobno zestaw i osobno składniki, pokrycie może się zdublować — wtedy wyłącz tę opcję świadomie.",
  stockAsCoverHintManual:
    "Domyślnie włączone. Wyłącz, gdy zestaw i składniki są trzymane osobno na magazynie.",

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
    "Dodaj promocję wewnętrzną (zestaw i składniki) albo zaznacz towary na liście szacunku i wybierz „Skład”.",

  needComponent: "Dodaj co najmniej jeden składnik.",
  listCoverOn: "stan zestawu w pokryciu",
  listCoverOff: "tylko sprzedaż zestawu",

  badgeZestawTitle:
    "Skład / promocja: ten towar nie idzie na ZD — popyt i pokrycie są na składnikach.",
  badgeZestawRole: "zestaw",
  badgeNieZamawiasz: "nie zamawiasz",
  badgeSkladnikRole: "składnik",
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

  bulkButton: "Skład",
  bulkTitleReady: "Utwórz skład / promocję — wskaż zestaw",
  bulkTitleNeed: "Zaznacz co najmniej 2 towary (zestaw i składniki)",
  selectNeedTwo:
    "Zaznacz co najmniej 2 towary (zestaw oraz składniki promocji).",

  flashSavedNoList:
    "Zapisano składy. Kliknij „Policz listę”, aby zobaczyć wkład na składnikach.",
  flashFetching: "Skład zapisany — dociągam brakujące towary z Subiekta…",
  flashOutsideList:
    "Skład zapisany, ale towar jest poza listą — kliknij „Policz listę”, aby dociągnąć dane.",
  flashUpdated: "Składy zaktualizowane — wkład i „Do ZD” przeliczone.",

  alertUnavailableTitle: "Składy i promocje niedostępne",
  alertUnavailableBody:
    "Bez listy składów zestaw (promocja) mógłby dostać własną ilość na ZD. Wczytaj listę przed szacunkiem.",
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
    `Lista nie została pokazana — bez listy składów zestawy (promocje) mogłyby dostać własną ilość na ZD. ${detail}`,

  loadError: "Nie udało się wczytać składów i promocji.",
  loadErrorShort: "Nie udało się wczytać składów.",
  saveError: "Nie udało się zapisać składu.",
  deleteError: "Nie udało się usunąć składu.",

  errBadParentId: "Nieprawidłowy identyfikator towaru zestawu.",
  errNeedComponent: "Skład musi mieć co najmniej jeden składnik.",
  errBadComponent: "Nieprawidłowy składnik (wymagane id. towaru oraz ilość ≥ 1).",
  errParentIsComponent: "Zestaw nie może być jednocześnie swoim składnikiem.",
  errDuplicateComponent: "Ten składnik jest już dodany do składu.",
  errParentInPair: (packLabel: string, pieceLabel: string) =>
    `Ten towar jest już w parze komplet (${packLabel} ↔ ${pieceLabel}) — nie może być zestawem w składzie.`,
  errReadBack: "Nie udało się odczytać zapisanego składu.",
  errPairIsBomParent: (label: string) =>
    `Towar ${label} jest zestawem w składzie / promocji — nie może wejść do pary.`,

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
