import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { progressLabelInSubline } from "@/lib/orders/my-order-card-ui";

export type MyOrderHeadlineTone = "action" | "warning" | "success" | "info" | "neutral";

/** Status otwartej prośby przekazanej do działu dostaw (nie wymaga akcji handlowca). */
export function isProsbaHandoffStatus(statusTitle: string): boolean {
  return (
    statusTitle === "W dziale dostaw" ||
    statusTitle === "Dopasowujemy dostawcę" ||
    statusTitle === "Uzupełnianie danych"
  );
}

/** Jedna linia pod nagłówkiem — bez powtórzenia statusDetail w rozwinięciu. */
export function verificationSublineFromDetail(statusDetail: string | null): string {
  if (!statusDetail?.trim()) return "Zakupy dopracują szczegóły — bez Twojej akcji";
  if (
    statusDetail.includes("Szukamy dostawcy") ||
    statusDetail.includes("dopasowuje dostawcę")
  ) {
    return "Trwa dopasowanie dostawcy w systemie";
  }
  if (statusDetail.includes("Dział dostaw dopasuje dostawcę")) {
    return "Zakupy dopasują dostawcę — bez Twojej akcji";
  }
  if (statusDetail.includes("Dział dostaw uzupełni:")) {
    const match = statusDetail.match(/Dział dostaw uzupełni: ([^.]+)/);
    return match ? `Zakupy uzupełnią ${match[1]}` : "Zakupy dopracują szczegóły";
  }
  if (statusDetail.includes("nie musisz")) {
    return "Prośba zapisana — bez Twojej akcji";
  }
  if (statusDetail.startsWith("Brakuje:")) {
    const missing = statusDetail.slice("Brakuje:".length).split(".")[0]?.trim();
    return missing
      ? `Zakupy uzupełnią ${missing}`
      : "Zakupy dopracują szczegóły — bez Twojej akcji";
  }
  if (statusDetail.includes("sprawdzają")) return "Zakupy sprawdzają szczegóły przed zamówieniem";
  return "Zakupy dopracują szczegóły — bez Twojej akcji";
}

export type MyOrderSalesUi = {
  /** Najważniejsza informacja na karcie — co się dzieje / co zrobić. */
  headline: string;
  headlineTone: MyOrderHeadlineTone;
  /** Krótka podpowiedź pod nagłówkiem (opcjonalnie). */
  subline: string | null;
  /** Kolejność na liście — mniejsza liczba = wyżej. */
  sortPriority: number;
};

export type MyOrdersInboxSummary = {
  pickupCount: number;
  partialReadyCount: number;
  cancelAckCount: number;
  overdueCount: number;
  verificationCount: number;
  przedZamowieniemCount: number;
  zamowioneCount: number;
  availabilityPendingCount: number;
  informacjaReadyCount: number;
};

/** Podsumowanie skrzynki na górze „Moje zamówienia”. */
export function summarizeMyOrdersInbox(rows: MyOrderRow[]): MyOrdersInboxSummary {
  const s: MyOrdersInboxSummary = {
    pickupCount: 0,
    partialReadyCount: 0,
    cancelAckCount: 0,
    overdueCount: 0,
    verificationCount: 0,
    przedZamowieniemCount: 0,
    zamowioneCount: 0,
    availabilityPendingCount: 0,
    informacjaReadyCount: 0,
  };

  for (const row of rows) {
    const ui = enrichMyOrderSalesUi(row);
    if (ui.sortPriority === 1) s.pickupCount++;
    else if (ui.sortPriority === 2) s.partialReadyCount++;
    else if (ui.sortPriority === 3) s.cancelAckCount++;
    else if (ui.sortPriority === 4) s.overdueCount++;
    else if (ui.sortPriority === 5) s.verificationCount++;
    else if (ui.sortPriority === 10) s.informacjaReadyCount++;
    else if (row.kind === "zamowienie" && row.statusTitle === "Przed zamówieniem") {
      s.przedZamowieniemCount++;
    } else if (row.kind === "zamowienie" && row.statusTitle === "Zamówione") {
      s.zamowioneCount++;
    } else if (
      row.kind === "informacja" &&
      (row.statusTitle === "Oczekuje na magazyn" ||
        row.statusTitle === "Czekamy na zamówienie u dostawcy" ||
        row.statusTitle === "Zamówione — czekamy na magazyn")
    ) {
      s.availabilityPendingCount++;
    }
  }

  return s;
}

export function enrichMyOrderSalesUi(row: MyOrderRow): MyOrderSalesUi {
  const overdue = Boolean(row.timingLabel?.includes("po terminie"));

  if (row.acknowledgeMode === "availability" && row.pickupPendingCount > 0) {
    return {
      headline: "Towar jest na magazynie",
      headlineTone: "action",
      subline: "Potwierdź powiadomienie, aby usunąć z listy",
      sortPriority: 10,
    };
  }

  if (row.acknowledgeMode === "pickup" && row.pickupPendingCount > 0) {
    const n = row.pickupPendingCount;
    const progress =
      row.pickupReadyTotal > 1 && row.pickupAcknowledgedCount > 0
        ? `${row.pickupAcknowledgedCount}/${row.pickupReadyTotal} już odebrane`
        : null;
    return {
      headline:
        n === 1
          ? "Odbierz towar z magazynu"
          : `Odbierz ${n} ${n === 1 ? "pozycję" : n < 5 ? "pozycje" : "pozycji"} z magazynu`,
      headlineTone: "action",
      subline: progress ?? "Po potwierdzeniu wpis zniknie z listy",
      sortPriority: 1,
    };
  }

  if (row.statusTitle === "Częściowo na magazynie") {
    const onStock = row.lines.filter(
      (l) => l.stockStatus === "on_stock" || l.stockStatus === "partial"
    ).length;
    return {
      headline:
        onStock > 0
          ? "Część towaru możesz już odebrać"
          : "Częściowa dostawa w toku",
      headlineTone: onStock > 0 ? "warning" : "info",
      subline: row.progressLabel
        ? `Magazyn: ${row.progressLabel.replace(" na magazynie", "")}`
        : "Reszta czeka u dostawcy",
      sortPriority: onStock > 0 ? 2 : 6,
    };
  }

  if (overdue) {
    return {
      headline: "Po przewidywanym terminie",
      headlineTone: "warning",
      subline: row.timingLabel?.replace(" · po terminie", "") ?? null,
      sortPriority: 4,
    };
  }

  if (isProsbaHandoffStatus(row.statusTitle)) {
    const pending = row.statusTitle === "Dopasowujemy dostawcę";
    return {
      headline: pending ? "Dopasowujemy dostawcę" : "Prośba jest weryfikowana",
      headlineTone: "info",
      subline: verificationSublineFromDetail(row.statusDetail),
      sortPriority: 5,
    };
  }

  if (row.statusTitle === "Zamówione") {
    const hasEstimate = Boolean(row.timingLabel);
    const lowHistory = row.timingLabel?.includes("mało historii");
    return {
      headline: hasEstimate
        ? "Zamówione — czekamy na dostawę"
        : "Zamówione u dostawcy",
      headlineTone: "info",
      subline: !hasEstimate
        ? "Szacowany termin podamy z historii dostaw"
        : lowHistory
          ? "Mało dostaw w historii — termin jest orientacyjny"
          : null,
      sortPriority: 7,
    };
  }

  if (row.statusTitle === "Przed zamówieniem") {
    return {
      headline: "Czeka na zamówienie u dostawcy",
      headlineTone: "neutral",
      subline: "Dział dostaw złoży zamówienie planowo lub osobno",
      sortPriority: 8,
    };
  }

  if (row.statusTitle === "Czekamy na zamówienie u dostawcy") {
    return {
      headline: "Zamówimy u dostawcy",
      headlineTone: "info",
      subline: "Potem magazyn i powiadomienie e-mail",
      sortPriority: 9,
    };
  }

  if (row.statusTitle === "Oczekuje na magazyn") {
    return {
      headline: "Powiadomimy, gdy towar przyjedzie",
      headlineTone: "neutral",
      subline: "Magazyn obserwuje dostępność — bez zamówienia u dostawcy",
      sortPriority: 9,
    };
  }

  if (row.statusTitle === "Zamówione — czekamy na magazyn") {
    return {
      headline: "Zamówione u dostawcy",
      headlineTone: "info",
      subline: "Powiadomimy e-mailem, gdy towar będzie na magazynie",
      sortPriority: 9,
    };
  }

  if (row.acknowledgeMode === "cancelled") {
    return {
      headline: "Potwierdź anulowanie prośby",
      headlineTone: "neutral",
      subline: "Po potwierdzeniu wpis zniknie z listy",
      sortPriority: 3,
    };
  }

  return {
    headline: row.statusTitle,
    headlineTone: row.badgeVariant === "success" ? "success" : "neutral",
    subline: null,
    sortPriority: 50,
  };
}

export function sortMyOrderRows(rows: MyOrderRow[]): MyOrderRow[] {
  return [...rows].sort((a, b) => {
    const pa = enrichMyOrderSalesUi(a).sortPriority;
    const pb = enrichMyOrderSalesUi(b).sortPriority;
    if (pa !== pb) return pa - pb;
    return b.submittedLabel.localeCompare(a.submittedLabel, "pl");
  });
}

/** Etykiety metadanych na karcie (zamiast jednego ciągu „·”). */
export function myOrderMetaFields(
  row: MyOrderRow,
  showProgress: boolean
): { label: string; value: string; emphasize?: boolean }[] {
  const fields: { label: string; value: string; emphasize?: boolean }[] = [
    { label: "Zgłoszono", value: row.submittedLabel },
  ];

  if (row.clientLabel && row.lineCount <= 1) {
    fields.push({
      label: "Klient",
      value: row.clientLabel,
      emphasize: true,
    });
  }

  if (showProgress && row.progressLabel && !progressLabelInSubline(row)) {
    fields.push({
      label: "Magazyn",
      value: row.progressLabel.replace(" na magazynie", "").replace("Wszystkie ", ""),
      emphasize: row.statusTitle.includes("magazynie") || row.statusTitle.includes("Część"),
    });
  }

  if (row.timingLabel && row.headlineTone !== "warning") {
    const overdue = row.timingLabel.includes("po terminie");
    fields.push({
      label: overdue ? "Termin" : "Szacunek",
      value: row.timingLabel.replace(" · po terminie", ""),
      emphasize: overdue,
    });
  } else if (row.timingLabel?.includes("po terminie")) {
    fields.push({
      label: "Termin",
      value: row.timingLabel.replace(" · po terminie", ""),
      emphasize: true,
    });
  }

  return fields;
}

/** Pole terminu / szacunku — zawsze widoczne na liście, także na zwiniętym wierszu. */
export function myOrderTimingMetaField(
  row: MyOrderRow,
  showProgress: boolean
): { label: string; value: string; emphasize?: boolean } | null {
  return (
    myOrderMetaFields(row, showProgress).find(
      (f) => f.label === "Termin" || f.label === "Szacunek"
    ) ?? null
  );
}

export function isTimingOverdue(timingLabel: string | null): boolean {
  if (!timingLabel?.includes("po terminie")) return false;
  return true;
}

/** Używane w presenterze przy budowie timingLabel z ETA. */
export function salesTimingLabel(
  expectedDate: Date,
  avgDays: number,
  lowConfidence: boolean
): string {
  const date = expectedDate.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const conf = lowConfidence ? " · mało historii" : "";
  const overdue = isPastExpectedDate(expectedDate) ? " · po terminie" : "";
  return `ok. ${date} (~${avgDays} dni rob.)${conf}${overdue}`;
}
