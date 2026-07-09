/**
 * Wspólne komunikaty UI — nagłówek + treść, spójny język polski.
 * Używaj z NoticeToast, FormNoticeMessage i stanem toastu.
 */

import type { FormMessage, NoticeToastPayload } from "@/lib/ui/notice-content";
import { undoWindowLongLabel } from "@/lib/orders/daily-panel-undo";
import { TEETH_LIST_INCOMPLETE_MESSAGE } from "@/lib/teeth/teeth-validation";

export type { FormMessage };

export type ToastNotice = NoticeToastPayload & {
  tone: "success" | "error" | "warning";
};

export function toastSuccess(title: string, text?: string): ToastNotice {
  return { title, text: text ?? "", tone: "success" };
}

export function toastError(title: string, text?: string): ToastNotice {
  return { title, text: text ?? "", tone: "error" };
}

export function toastWarning(title: string, text?: string): ToastNotice {
  return { title, text: text ?? "", tone: "warning" };
}

/** Błąd z serwera lub wyjątku — szczegóły w treści. */
export function toastFromError(
  detail: string | undefined,
  fallback = "Spróbuj ponownie za chwilę.",
): ToastNotice {
  return toastError("Operacja nie powiodła się", detail?.trim() || fallback);
}

export function formError(title: string, text: string): FormMessage {
  return { title, text, tone: "error" };
}

export function formWarning(title: string, text: string): FormMessage {
  return { title, text, tone: "warning" };
}

export function formSuccess(title: string, text: string): FormMessage {
  return { title, text, tone: "success" };
}

/** Toast z komunikatu formularza (np. walidacja prośby). */
export function formMessageToToast(
  message: FormMessage,
  tone: ToastNotice["tone"] = message.tone === "info" ? "error" : message.tone
): ToastNotice {
  return {
    title: message.title,
    text: message.text,
    tone,
  };
}

// ——— Tryb podglądu ———

export const ADMIN_PREVIEW_NOTICE = formWarning(
  "Tryb podglądu panelu",
  "Zmiany są wyłączone. Wróć do administracji, aby edytować.",
);

export const ADMIN_PREVIEW_TOAST = toastError(
  "Tryb podglądu panelu",
  "Zmiany są wyłączone. Wróć do administracji, aby edytować.",
);

/** Toast panelu admina — nagłówek + treść zamiast samego stringa. */
export function adminPanelNotice(
  text: string,
  tone: ToastNotice["tone"] = "success",
  title = "Panel administracyjny",
): ToastNotice {
  if (tone === "success") return toastSuccess(title, text);
  if (tone === "warning") return toastWarning(title, text);
  return toastError(title, text);
}

export function catalogAdminError(error: unknown, fallback: string): ToastNotice {
  return toastFromError(error instanceof Error ? error.message : undefined, fallback);
}

export function catalogAdminNotice(
  text: string,
  tone: ToastNotice["tone"],
): ToastNotice {
  return adminPanelNotice(text, tone, "Katalog produktów");
}

export const CATALOG_ADMIN_TOAST = {
  noPausedImport: toastError("Import ZD", "Brak wstrzymanego importu do wznowienia."),
  importPausedUseContinue: toastError(
    "Import ZD",
    "Import jest wstrzymany — użyj Kontynuuj, żeby nie stracić postępu.",
  ),
  importPausedFromSupplierRow: toastError(
    "Import ZD",
    "Import wstrzymany — użyj Kontynuuj w sekcji importu.",
  ),
  resumeImportSupplier: toastSuccess(
    "Import ZD",
    "Wznawiam import ZD dla wybranego dostawcy…",
  ),
  startImportSupplier: toastSuccess(
    "Import ZD",
    "Start importu z ZD — uruchamiam przetwarzanie…",
  ),
  importStopped: toastSuccess(
    "Import ZD",
    "Import wstrzymany — jutro użyj Kontynuuj (postęp zostaje w bazie).",
  ),
  noPausedIndex: toastError("Indeks ZD", "Brak wstrzymanego indeksowania do wznowienia."),
  indexPausedUseContinue: toastError(
    "Indeks ZD",
    "Indeksowanie jest wstrzymane — użyj Kontynuuj, żeby nie stracić postępu.",
  ),
  startIndex: toastSuccess("Indeks ZD", "Start indeksowania ZD — uruchamiam…"),
  indexStopped: toastSuccess(
    "Indeks ZD",
    "Indeksowanie wstrzymane — użyj Kontynuuj, żeby wznowić od bieżącej strony.",
  ),
  noPausedAutopilot: toastError("Autopilot ZD", "Brak wstrzymanego autopilota do wznowienia."),
  autopilotPausedUseContinue: toastError(
    "Autopilot ZD",
    "Autopilot jest wstrzymany — użyj Kontynuuj, żeby nie stracić postępu.",
  ),
  startAutopilot: toastSuccess("Autopilot ZD", "Autopilot: start importu po dostawcach…"),
  autopilotStopped: toastSuccess(
    "Autopilot ZD",
    "Autopilot wstrzymany — jutro użyj Kontynuuj (postęp zostaje w bazie).",
  ),
  savedNote: toastSuccess("Zapisano", "Notatka produktu została zaktualizowana."),
  subiektOfflineBackfill: toastError(
    "Subiekt niedostępny",
    "Subiekt offline lub poza LAN — nie da się teraz uzupełnić po symbolu.",
  ),
  nightlySyncAlreadyDone: toastSuccess(
    "Synchronizacja nocna",
    "Synchronizacja na dziś już zakończona (użyj restartu, aby zacząć od nowa).",
  ),
} as const;

// ——— Urlopy i zastępstwa ———

export const VACATION_TOAST = {
  missingDates: toastError(
    "Brak dat",
    "Podaj datę rozpoczęcia i zakończenia urlopu.",
  ),
  invalidDateRange: toastError(
    "Nieprawidłowy zakres dat",
    "Data rozpoczęcia musi być wcześniejsza niż data zakończenia.",
  ),
  missingSalesPerson: toastError("Brak handlowca", "Wybierz handlowca z listy."),
  missingDelegate: toastError(
    "Brak zastępcy",
    "Wybierz osobę zastępującą w tym okresie.",
  ),
  savedPeriod: toastSuccess("Zapisano", "Okres urlopu został dodany."),
  savedDelegation: toastSuccess("Zapisano", "Zastępstwo zostało przypisane."),
  savedDelegationToVacation: toastSuccess(
    "Zapisano",
    "Zastępca został przypisany do urlopu.",
  ),
  removedPeriod: toastSuccess("Usunięto", "Okres urlopu został usunięty."),
  removedDelegation: toastSuccess("Usunięto", "Zastępstwo zostało usunięte."),
  removedDelegateFromVacation: toastSuccess(
    "Usunięto",
    "Zastępca został odłączony od urlopu.",
  ),
  removedVacationEntry: (name: string) =>
    toastSuccess("Usunięto", `Wpis urlopu (${name}) został usunięty.`),
  incompleteFields: toastError(
    "Uzupełnij pola",
    "Wypełnij wszystkie wymagane pola urlopu.",
  ),
} as const;

// ——— Konta i uprawnienia ———

export const USERS_TOAST = {
  savedPermissions: toastSuccess("Zapisano", "Uprawnienia konta zostały zaktualizowane."),
  deletedAccount: toastSuccess("Usunięto", "Konto użytkownika zostało usunięte."),
  updatedPassword: toastSuccess("Zapisano", "Hasło zostało zaktualizowane."),
  createdAccount: toastSuccess("Utworzono", "Konto użytkownika zostało utworzone."),
} as const;

// ——— Handlowcy i grupy ———

export const SALES_TOAST = {
  savedSalesPerson: toastSuccess("Zapisano", "Dane handlowca zostały zaktualizowane."),
  deletedSalesPerson: toastSuccess("Usunięto", "Handlowiec został usunięty z systemu."),
  missingGroup: toastError("Brak grupy", "Wybierz grupę z listy przypisanych."),
  savedGroup: toastSuccess("Zapisano", "Grupa została zaktualizowana."),
  addedGroup: toastSuccess("Dodano", "Nowa grupa została utworzona."),
  deletedGroup: toastSuccess("Usunięto", "Grupa została usunięta."),
} as const;

// ——— Dostawcy ———

export const SUPPLIER_TOAST = {
  missingName: toastError("Brak nazwy", "Podaj nazwę dostawcy."),
  deleted: toastSuccess("Usunięto", "Dostawca został usunięty."),
  savedCard: toastSuccess("Zapisano", "Karta dostawcy została zaktualizowana."),
  saveFailed: toastError("Nie udało się zapisać", "Sprawdź dane i spróbuj ponownie."),
} as const;

// ——— Katalog zębów ———

export const TEETH_CATALOG_TOAST = {
  savedProductLine: toastSuccess("Zapisano", "Linia produktowa została zaktualizowana."),
  savedKind: toastSuccess("Zapisano", "Typ zęba został zaktualizowany."),
  addedProduct: toastSuccess("Dodano", "Produkt trafił na listę zębów."),
  savedNote: toastSuccess("Zapisano", "Notatka została zapisana."),
  savedManufacturer: toastSuccess("Zapisano", "Producent został zaktualizowany."),
  removedFromList: toastSuccess("Usunięto", "Produkt został usunięty z listy zębów."),
  refreshFailed: toastError(
    "Nie udało się odświeżyć",
    "Lista produktów nie została przeładowana.",
  ),
} as const;

export const TEETH_SCHEDULE_TOAST = {
  loadFailed: toastError(
    "Nie udało się wczytać",
    "Cykl zamówień zębów nie został pobrany.",
  ),
  saved: toastSuccess("Zapisano", "Cykl zamówień zębów został zaktualizowany."),
  saveFailed: toastError("Nie udało się zapisać", "Cykl zamówień zębów nie został zapisany."),
  disabled: toastSuccess("Wyłączono", "Cykl zębów u tego dostawcy został wyłączony."),
  removeFailed: toastError("Nie udało się usunąć", "Cykl zębów nie został wyłączony."),
  shiftRestored: toastSuccess(
    "Przywrócono",
    "Automatyczny termin cyklu został przywrócony.",
  ),
  shiftToDate: (date: string) =>
    toastSuccess("Przesunięto", `Następny termin ustawiono na ${date}.`),
  shiftUpdated: toastSuccess("Zapisano", "Termin cyklu został zaktualizowany."),
  shiftFailed: toastError(
    "Nie udało się przesunąć",
    "Termin cyklu zębów nie został zmieniony.",
  ),
} as const;

// ——— Magazyn i kolejka ———

export const WAREHOUSE_TOAST = {
  undoReceiveSuccess: toastSuccess("Cofnięto", "Przyjęcie towaru zostało cofnięte."),
  undoReceiveExpired: toastError(
    "Czas minął",
    "Nie można już cofnąć tego przyjęcia towaru.",
  ),
  undoReceiveFailed: toastError(
    "Nie udało się cofnąć",
    "Przyjęcie towaru nie zostało wycofane.",
  ),
  savedShelfLocation: toastSuccess("Zapisano", "Lokalizacja regału została zaktualizowana."),
  savedDeliveryEntry: toastSuccess("Zapisano", "Możesz wpisać kolejną dostawę."),
  deletedCarrier: toastSuccess("Usunięto", "Kurier został usunięty z listy."),
  subiektOffline: toastWarning(
    "Subiekt częściowo niedostępny",
    "Użyto danych z lokalnego indeksu.",
  ),
  batchNoQuantity: toastError(
    "Brak ilości",
    "Wpisz ilość w polu dostawy lub użyj menu grupy „Całość”.",
  ),
  cancelDispositionDone: toastSuccess("Rozliczono", "Pozycja rozliczona."),
  cancelDispositionFailed: toastFromError(undefined, "Nie udało się rozliczyć pozycji."),
  deliverySaveFailed: toastFromError(undefined, "Nie udało się zapisać dostawy."),
} as const;

/** Krótka adnotacja przy zapisie — mail po oknie cofania. */
export function receiveQueueEmailQueuedSuffix(emailQueued: boolean): string {
  return emailQueued ? " · powiadomienie e-mail za chwilę" : "";
}

export function receiveQueueDeliverySavedToast(opts: {
  person: string;
  emailQueued: boolean;
  emailError?: string;
  fulfilled?: boolean;
  fractionLabel?: string;
  remaining?: number;
}): ToastNotice {
  const emailNote = receiveQueueEmailQueuedSuffix(opts.emailQueued);
  if (opts.emailError) {
    return toastError(
      "Zapisano dostawę",
      `E-mail nie poszedł: ${opts.emailError}`
    );
  }
  if (opts.fulfilled) {
    return toastSuccess("Zrealizowano", `${opts.person}${emailNote}`);
  }
  if (
    opts.fractionLabel &&
    opts.remaining != null &&
    opts.remaining > 0
  ) {
    return toastSuccess(
      "Częściowa dostawa",
      `${opts.fractionLabel} · ${opts.person} · brakuje ${opts.remaining} szt.${emailNote}`
    );
  }
  if (emailNote) {
    return toastSuccess("Zapisano", emailNote.replace(/^ · /, ""));
  }
  return toastSuccess("Zapisano", opts.person);
}

export function receiveQueueSingleLineSavedToast(opts: {
  person: string;
  emailQueued: boolean;
  emailError?: string;
}): ToastNotice {
  if (opts.emailError) {
    return toastError("Zapisano dostawę", `E-mail: ${opts.emailError}`);
  }
  return toastSuccess(
    "Zapisano",
    `${opts.person}${receiveQueueEmailQueuedSuffix(opts.emailQueued)}`
  );
}

export const TEETH_RECEIVE_TOAST = {
  undoSuccess: toastSuccess("Cofnięto", "Przyjęcie zębów zostało cofnięte."),
  undoExpired: toastError(
    "Czas minął",
    "Nie można już cofnąć tego przyjęcia zębów.",
  ),
  undoFailed: toastError(
    "Nie udało się cofnąć",
    "Przyjęcie zębów nie zostało wycofane.",
  ),
  batchNoQuantity: toastError(
    "Brak ilości",
    "Wpisz przyjęte ilości w tabeli lub użyj „Całość”.",
  ),
  lineSaved: (person: string) =>
    toastSuccess("Przyjęto zęby", person),
  saveFailed: toastFromError(undefined, "Nie udało się zapisać przyjęcia zębów."),
  cancellationAckSuccess: (count: number) =>
    toastSuccess(
      "Rozliczono anulację",
      count === 1
        ? "Pozycja została usunięta z kolejki przyjęcia."
        : `${count} pozycje zostały usunięte z kolejki przyjęcia.`,
    ),
  cancellationAckFailed: toastFromError(
    undefined,
    "Nie udało się rozliczyć anulacji.",
  ),
} as const;

// ——— Wspólne komunikaty cofania ———

export const UNDO_TOAST = {
  expired: toastError(
    "Czas minął",
    `Nie można już cofnąć tej akcji — masz ${undoWindowLongLabel()} od wykonania operacji.`,
  ),
  success: toastSuccess("Cofnięto", "Ostatnia operacja została wycofana."),
  failed: toastError("Nie udało się cofnąć", "Ostatnia operacja nie została wycofana."),
} as const;

export const NOTEPAD_UNDO_TOAST = {
  success: UNDO_TOAST.success,
  expired: UNDO_TOAST.expired,
  failed: UNDO_TOAST.failed,
} as const;

// ——— Historia ———

export const HISTORY_TOAST = {
  deletedEntry: toastSuccess("Usunięto", "Wpis został usunięty z historii."),
  deleteFailed: toastError("Nie udało się usunąć", "Wpis nie został usunięty z historii."),
  cancelledOrder: (emailWarning?: string) =>
    emailWarning
      ? toastWarning("Prośba anulowana", `Uwaga e-mail: ${emailWarning}`)
      : toastSuccess("Anulowano", "Prośba została oznaczona jako anulowana."),
  cancelFailed: toastError("Nie udało się anulować", "Prośba nie została anulowana."),
  savedNote: (emailWarning?: string) =>
    emailWarning
      ? toastWarning("Wiadomość zapisana", `Uwaga e-mail: ${emailWarning}`)
      : toastSuccess("Zapisano", "Wiadomość dla handlowca została zaktualizowana."),
  saveNoteFailed: toastError(
    "Nie udało się zapisać",
    "Wiadomość nie została zaktualizowana.",
  ),
} as const;

// ——— Panel dzienny ———

export const DAILY_PANEL_TOAST = {
  undoExpired: toastError(
    "Czas minął",
    "Nie można już cofnąć tej akcji — odśwież panel.",
  ),
  undoSuccess: toastSuccess("Cofnięto", "Ostatnia akcja została cofnięta."),
  undoFailed: toastError("Nie udało się cofnąć", "Ostatnia akcja nie została wycofana."),
  genericError: toastError("Wystąpił błąd", "Spróbuj ponownie za chwilę."),
} as const;

// ——— Moje zamówienia ———

export const MY_ORDERS_TOAST = {
  savedRequest: toastSuccess("Zapisano", "Zmiany w prośbie zostały zapisane."),
  actionFailed: (detail?: string) =>
    toastFromError(detail, "Operacja nie powiodła się. Spróbuj ponownie."),
  undoSuccess: UNDO_TOAST.success,
  undoExpired: toastError(
    "Czas minął",
    "Nie można już cofnąć — odśwież listę zamówień.",
  ),
  undoPickupFailed: toastError(
    "Nie udało się cofnąć odbioru",
    "Potwierdzenie odbioru nie zostało wycofane.",
  ),
  undoDismissFailed: toastError(
    "Nie udało się cofnąć ukrycia",
    "Pozycja nie wróciła na listę.",
  ),
  undoCancelFailed: toastError(
    "Nie udało się cofnąć anulowania",
    "Wycofanie pozycji nie zostało cofnięte.",
  ),
} as const;

// ——— Weryfikacja ———

export const VERIFICATION_TOAST = {
  saved: toastSuccess("Zapisano", "Prośba trafiła do panelu dziennego jako „Nowe”."),
  savedInformacja: (message: string) => toastSuccess("Zapisano", message),
  incompleteOrder: toastError(
    "Uzupełnij pola",
    "Podaj dostawcę, opis produktu i ilość (np. 1 szt.), aby zatwierdzić.",
  ),
  incompleteInformacja: toastError(
    "Uzupełnij pola",
    "Podaj dostawcę i opis produktu, aby zatwierdzić.",
  ),
  cancelled: (emailError?: string) =>
    emailError
      ? toastWarning("Prośba anulowana", `Uwaga e-mail: ${emailError}`)
      : toastSuccess("Anulowano", "Prośba została anulowana w weryfikacji."),
  cancelFailed: toastError("Nie udało się anulować", "Prośba nie została anulowana."),
} as const;

// ——— Edycja prośby ———

export const REQUEST_EDIT_FORM = {
  missingLines: formError("Brak pozycji", "Dodaj co najmniej jedną pozycję z produktem."),
  missingSupplier: formError("Brak dostawcy", "Wybierz dostawcę z listy."),
  incompleteFields: formError("Uzupełnij pola", "Wypełnij wszystkie wymagane pola formularza."),
  incompleteSalesInformacja: formError(
    "Uzupełnij pola",
    "Podaj symbol, kod Mikran lub opis produktu.",
  ),
  incompleteSalesOrder: formError(
    "Uzupełnij pola",
    "Podaj produkt i ilość przy każdej pozycji.",
  ),
  missingQuantity: formError(
    "Brak ilości",
    "Każda pozycja zamówienia musi mieć liczbę sztuk (np. 1).",
  ),
  teethListIncomplete: (() => {
    const dash = TEETH_LIST_INCOMPLETE_MESSAGE.indexOf(" — ");
    if (dash >= 0) {
      return formError(
        TEETH_LIST_INCOMPLETE_MESSAGE.slice(0, dash).trim(),
        TEETH_LIST_INCOMPLETE_MESSAGE.slice(dash + 3).trim()
      );
    }
    return formError("Uzupełnij listę zębów", TEETH_LIST_INCOMPLETE_MESSAGE);
  })(),
} as const;

/** Walidacja szybkiego zamówienia z panelu dziennego. */
export const QUICK_ORDER_FORM = {
  missingSupplierAndSales: formError(
    "Brak danych",
    "Wybierz dostawcę i handlowca.",
  ),
  missingProducts: formError(
    "Brak pozycji",
    "Dodaj co najmniej jeden produkt z opisem.",
  ),
  missingQuantity: REQUEST_EDIT_FORM.missingQuantity,
  teethListIncomplete: REQUEST_EDIT_FORM.teethListIncomplete,
  incompleteFields: formError("Uzupełnij pola", "Uzupełnij wymagane pola formularza."),
} as const;

// ——— Tablica zespołu ———

export const DEPARTMENT_BOARD_SUCCESS_TOAST = toastSuccess(
  "Wysłano",
  "Pytanie trafiło na tablicę zespołu.",
);

// ——— Harmonogram dostawców ———

export const LOCATION_SCHEDULE_TOAST = {
  saved: (name: string) =>
    toastSuccess("Zapisano", `Harmonogram dostawcy ${name} został zaktualizowany.`),
} as const;

// ——— Zęby — panel ———

export function teethMarkOrderedToast(opts: {
  updated: number;
  ordersCompleted: number;
  skipped: number;
  plPozycja: (n: number) => string;
}): ToastNotice {
  const { updated, ordersCompleted, skipped, plPozycja } = opts;
  const completed =
    ordersCompleted > 0
      ? ` Ukończono ${ordersCompleted} ${ordersCompleted === 1 ? "zamówienie" : "zamówień"}.`
      : "";

  if (skipped > 0) {
    return toastWarning(
      "Oznaczono częściowo",
      `Zaktualizowano ${updated} ${plPozycja(updated)}.${completed} Pominięto ${skipped} ${skipped === 1 ? "pozycję" : "pozycji"} z niekompletną listą zębów.`,
    );
  }

  if (updated === 1) {
    return toastSuccess(
      "Oznaczono",
      `Jedna pozycja została oznaczona jako zamówiona.${completed}`,
    );
  }

  return toastSuccess(
    "Oznaczono",
    `${updated} ${plPozycja(updated)} oznaczono jako zamówione.${completed}`,
  );
}

export const TEETH_PANEL_TOAST = {
  markFailed: toastError(
    "Nie udało się oznaczyć",
    "Pozycje mogły zostać już wcześniej zamówione.",
  ),
  markError: toastError("Nie udało się oznaczyć", "Spróbuj ponownie za chwilę."),
  deliveryDateSet: (count: number, plPozycja: (n: number) => string) =>
    count === 1
      ? toastSuccess("Zapisano", "Data dostawy została ustawiona dla jednej pozycji.")
      : toastSuccess(
          "Zapisano",
          `Data dostawy została ustawiona dla ${count} ${plPozycja(count)}.`,
        ),
  deliveryDateSetFailed: toastError(
    "Nie udało się zapisać",
    "Data dostawy nie została ustawiona.",
  ),
  deliveryDateCleared: toastSuccess("Wyczyszczono", "Data dostawy została usunięta."),
  scheduleMarked: (supplierName: string) =>
    toastSuccess(
      "Oznaczono jako zamówione",
      `Harmonogram dostawcy ${supplierName} przesunięto na następny termin.`,
    ),
  scheduleMarkFailed: toastError(
    "Nie udało się oznaczyć",
    "Zamówienie u dostawcy nie zostało zaktualizowane.",
  ),
  historiaDeliveryDateSet: toastSuccess("Zapisano", "Data dostawy została ustawiona."),
  historiaDeliveryDateCleared: toastSuccess("Wyczyszczono", "Data dostawy została usunięta."),
  historiaLoadFailed: toastError("Nie udało się wczytać", "Historia zębów nie została pobrana."),
  historiaPageFailed: toastError(
    "Nie udało się wczytać",
    "Kolejna strona historii nie została pobrana.",
  ),
  historiaDateFailed: toastError(
    "Nie udało się zapisać",
    "Data dostawy nie została ustawiona.",
  ),
  historiaDateClearFailed: toastError(
    "Nie udało się wyczyścić",
    "Data dostawy nie została usunięta.",
  ),
  unmarkFailed: toastError(
    "Nie udało się cofnąć",
    "Pozycja mogła zmienić status w międzyczasie.",
  ),
  unmarkSuccess: toastSuccess(
    "Cofnięto",
    "Oznaczenie zamówienia zostało wycofane — pozycja wróciła do kolejki.",
  ),
  unmarkError: toastError("Nie udało się cofnąć", "Oznaczenie zamówienia nie zostało wycofane."),
} as const;
