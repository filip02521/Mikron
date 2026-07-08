import { getAppUrl } from "@/lib/env/app-config";
import type {
  SalesDeliveryNotificationItem,
  SalesInformacjaNotificationItem,
  SalesProcurementCancelNotificationItem,
} from "@/lib/email/sales-notification-types";
import {
  polishPozycjeLabel,
  polishPozycjeSubjectSuffix,
} from "@/lib/email/polish-plural";
import {
  EMAIL_THEME,
  emailButton,
  emailDataRow,
  emailDocument,
  emailGreeting,
  emailItemCard,
  emailMutedParagraph,
  emailParagraph,
} from "@/lib/email/sales-email-layout";

const SUBJECT_SUPPLIER_MAX = 48;

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function mojeUrl(): string {
  return `${getAppUrl().replace(/\/$/, "")}/moje`;
}

function truncateSubjectPart(text: string, max = SUBJECT_SUPPLIER_MAX): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function quantityLabel(
  ordered: number | null,
  delivered: number | null
): string | null {
  if (ordered != null && delivered != null) {
    const remaining = Math.max(0, ordered - delivered);
    if (remaining === 0) return `${delivered} / ${ordered} szt. — komplet`;
    return `${delivered} / ${ordered} szt. — brakuje ${remaining} szt.`;
  }
  if (delivered != null && delivered > 0) return `${delivered} szt. dostarczono`;
  if (ordered != null) return `Zamówiono: ${ordered} szt.`;
  return null;
}

type ItemCardOpts = { index: number; total: number };

function itemCardOpts(index: number, total: number): ItemCardOpts | undefined {
  if (total <= 1) return undefined;
  return { index: index + 1, total };
}

function positionLabel(opts: ItemCardOpts | undefined): string | undefined {
  if (!opts) return undefined;
  return `Pozycja ${opts.index} z ${opts.total}`;
}

function renderDeliveryItem(
  item: SalesDeliveryNotificationItem,
  cardOpts?: ItemCardOpts
): string {
  const isPartial = item.deliveryKind === "partial";
  const badge = isPartial
    ? {
        label: "Częściowa dostawa",
        bg: EMAIL_THEME.warningBg,
        color: EMAIL_THEME.warning,
        border: EMAIL_THEME.warningBorder,
      }
    : {
        label: "Gotowe do odbioru",
        bg: EMAIL_THEME.successBg,
        color: EMAIL_THEME.success,
        border: EMAIL_THEME.successBorder,
      };

  const rows: string[] = [];
  if (item.clientName) rows.push(emailDataRow("Klient", item.clientName));
  rows.push(emailDataRow("Produkt", item.products));
  if (item.symbol) rows.push(emailDataRow("Symbol", item.symbol));
  const qty = quantityLabel(item.orderedQty, item.deliveredQty);
  if (qty) rows.push(emailDataRow("Ilość", qty));
  rows.push(
    emailDataRow(
      "Co dalej",
      isPartial
        ? "Odbierz dostarczoną ilość. Pozostała część zamówienia nadal oczekuje na odbiór na regale."
        : "Towar czeka na odbiór na regale — możesz go odebrać i potwierdzić w aplikacji."
    )
  );

  return emailItemCard(badge, rows.join(""), {
    positionLabel: positionLabel(cardOpts),
    supplierName: item.supplierName,
  });
}

function renderInformacjaItem(
  item: SalesInformacjaNotificationItem,
  cardOpts?: ItemCardOpts
): string {
  const rows: string[] = [];
  if (item.clientName) rows.push(emailDataRow("Klient", item.clientName));
  rows.push(emailDataRow("Produkt", item.products));
  if (item.symbol) rows.push(emailDataRow("Symbol", item.symbol));
  rows.push(
    emailDataRow(
      "Rodzaj prośby",
      "Informacja o dostępności — bez zamówienia u dostawcy"
    )
  );
  rows.push(
    emailDataRow(
      "Co dalej",
      "W sekcji Moje zamówienia użyj przycisku „Potwierdzam, że widziałem/am powiadomienie o dostępności”."
    )
  );

  return emailItemCard(
    {
      label: "Na regale",
      bg: EMAIL_THEME.infoBg,
      color: EMAIL_THEME.info,
      border: EMAIL_THEME.infoBorder,
    },
    rows.join(""),
    {
      positionLabel: positionLabel(cardOpts),
      supplierName: item.supplierName,
    }
  );
}

function sortBySupplierThenProduct<
  T extends { supplierName: string; clientName: string | null; products: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const bySupplier = a.supplierName.localeCompare(b.supplierName, "pl");
    if (bySupplier !== 0) return bySupplier;
    const byClient = (a.clientName ?? "").localeCompare(b.clientName ?? "", "pl");
    if (byClient !== 0) return byClient;
    return a.products.localeCompare(b.products, "pl");
  });
}

function uniqueSupplierCount(items: { supplierName: string }[]): number {
  return new Set(items.map((i) => i.supplierName)).size;
}

function renderDeliveryItems(items: SalesDeliveryNotificationItem[]): string {
  const sorted = sortBySupplierThenProduct(items);
  return sorted
    .map((item, i) => renderDeliveryItem(item, itemCardOpts(i, sorted.length)))
    .join("");
}

function renderInformacjaItems(items: SalesInformacjaNotificationItem[]): string {
  const sorted = sortBySupplierThenProduct(items);
  return sorted
    .map((item, i) => renderInformacjaItem(item, itemCardOpts(i, sorted.length)))
    .join("");
}

function subjectForItems(
  prefix: string,
  items: { supplierName: string }[]
): string {
  if (items.length === 1) {
    return `${prefix} — ${truncateSubjectPart(items[0]!.supplierName)}`;
  }
  return `${prefix} ${polishPozycjeSubjectSuffix(items.length)}`;
}

function hasPartialDelivery(items: SalesDeliveryNotificationItem[]): boolean {
  return items.some((i) => i.deliveryKind === "partial");
}

export function renderDeliveryArrivedEmail(params: {
  recipientName: string;
  items: SalesDeliveryNotificationItem[];
}): { subject: string; html: string } {
  const sorted = sortBySupplierThenProduct(params.items);
  const count = sorted.length;
  const anyPartial = hasPartialDelivery(sorted);
  const suppliers = uniqueSupplierCount(sorted);

  const leadFixed =
    count === 1
      ? "Zarejestrowaliśmy dostawę Twojego zamówienia indywidualnego — towar czeka na odbiór na regale."
      : `Zarejestrowaliśmy dostawę — towar czeka na odbiór na regale: <strong>${polishPozycjeLabel(count)}</strong>.`;

  const bodyParts = [
    emailGreeting(firstName(params.recipientName)),
    emailParagraph(leadFixed),
    suppliers > 1
      ? emailMutedParagraph(
          `Poniżej ${polishPozycjeLabel(count)} od <strong>${suppliers}</strong> dostawców — każda karta ma nazwę dostawcy, klienta i produkt.`
        )
      : "",
    emailMutedParagraph(
      "Szczegóły poniżej. Pełny status, potwierdzenia odbioru i historia są w aplikacji OnTime."
    ),
    renderDeliveryItems(sorted),
    emailButton(mojeUrl(), "Otwórz Moje zamówienia"),
  ];

  if (anyPartial) {
    bodyParts.push(
      emailMutedParagraph(
        "Przy częściowej dostawie resztę zamówienia zobaczysz w aplikacji — kolejna partia wygeneruje osobne powiadomienie po przyjęciu na magazyn."
      )
    );
  }

  bodyParts.push(
    emailMutedParagraph(
      "To automatyczna wiadomość z systemu OnTime (Mikran). Nie odpowiadaj na ten e-mail."
    )
  );

  const preheader =
    count === 1
      ? `${sorted[0]!.supplierName} — ${anyPartial ? "częściowa dostawa" : "gotowe do odbioru"}`
      : suppliers > 1
        ? `${polishPozycjeLabel(count)} · ${suppliers} dostawców`
        : `${polishPozycjeLabel(count)} na regale`;

  return {
    subject: subjectForItems("OnTime · Towar na regale", sorted),
    html: emailDocument({
      preheader,
      headerTitle: "Towar na regale",
      headerSubtitle: "Zamówienie indywidualne",
      bodyHtml: bodyParts.join(""),
    }),
  };
}

export function renderInformacjaArrivedEmail(params: {
  recipientName: string;
  items: SalesInformacjaNotificationItem[];
}): { subject: string; html: string } {
  const sorted = sortBySupplierThenProduct(params.items);
  const count = sorted.length;
  const suppliers = uniqueSupplierCount(sorted);

  const leadFixed =
    count === 1
      ? "Towar, o który prosiłeś/aś wyłącznie o <strong>informację o dostępności</strong>, czeka na odbiór na regale."
      : `Na regale są już <strong>${polishPozycjeLabel(count)}</strong> z prośby informacyjnej.`;

  const body = [
    emailGreeting(firstName(params.recipientName)),
    emailParagraph(leadFixed),
    suppliers > 1
      ? emailMutedParagraph(
          `Poniżej ${polishPozycjeLabel(count)} od <strong>${suppliers}</strong> dostawców — każda karta opisuje osobny towar.`
        )
      : "",
    emailMutedParagraph(
      "To nie było zamówienie u dostawcy — magazyn potwierdza dostępność towaru, a Ty możesz poinformować klienta lub odebrać towar."
    ),
    renderInformacjaItems(sorted),
    emailButton(mojeUrl(), "Otwórz Moje zamówienia"),
    emailMutedParagraph(
      "Po zapoznaniu się z powiadomieniem potwierdź to w aplikacji — wpis zniknie z aktywnej listy."
    ),
    emailMutedParagraph(
      "To automatyczna wiadomość z systemu OnTime (Mikran). Nie odpowiadaj na ten e-mail."
    ),
  ].join("");

  const preheader =
    count === 1
      ? `Informacja: ${sorted[0]!.supplierName} — towar na stanie`
      : suppliers > 1
        ? `${polishPozycjeLabel(count)} · ${suppliers} dostawców`
        : `${polishPozycjeLabel(count)} informacyjne na regale`;

  return {
    subject: subjectForItems("OnTime · Informacja — na regale", sorted),
    html: emailDocument({
      preheader,
      headerTitle: "Informacja o towarze",
      headerSubtitle: "Prośba bez zamówienia u dostawcy",
      bodyHtml: body,
    }),
  };
}

function renderProcurementCancelItem(
  item: SalesProcurementCancelNotificationItem,
  cardOpts?: ItemCardOpts
): string {
  const rows: string[] = [];
  if (item.clientName) rows.push(emailDataRow("Klient", item.clientName));
  rows.push(emailDataRow("Produkt", item.products));
  if (item.symbol) rows.push(emailDataRow("Symbol", item.symbol));
  if (item.procurementCancelNote) {
    rows.push(emailDataRow("Wiadomość od działu dostaw", item.procurementCancelNote));
  }
  rows.push(
    emailDataRow(
      "Co dalej",
      "Prośba została anulowana przez dział dostaw. Potwierdź anulowanie w sekcji Moje zamówienia — wpis zniknie z listy."
    )
  );

  return emailItemCard(
    {
      label: "Anulowano",
      bg: EMAIL_THEME.warningBg,
      color: EMAIL_THEME.warning,
      border: EMAIL_THEME.warningBorder,
    },
    rows.join(""),
    {
      positionLabel: positionLabel(cardOpts),
      supplierName: item.supplierName,
    }
  );
}

function renderProcurementCancelItems(
  items: SalesProcurementCancelNotificationItem[]
): string {
  const sorted = sortBySupplierThenProduct(items);
  return sorted
    .map((item, i) => renderProcurementCancelItem(item, itemCardOpts(i, sorted.length)))
    .join("");
}

export function renderProcurementCancelEmail(params: {
  recipientName: string;
  items: SalesProcurementCancelNotificationItem[];
  /** Zaktualizowano wiadomość po anulowaniu. */
  noteUpdated?: boolean;
}): { subject: string; html: string } {
  const sorted = sortBySupplierThenProduct(params.items);
  const count = sorted.length;
  const suppliers = uniqueSupplierCount(sorted);
  const noteUpdated = params.noteUpdated ?? false;

  const leadFixed = noteUpdated
    ? count === 1
      ? "Dział dostaw zaktualizował wiadomość do anulowanej prośby."
      : `Dział dostaw zaktualizował wiadomości do <strong>${polishPozycjeLabel(count)}</strong> anulowanych prośb.`
    : count === 1
      ? "Dział dostaw anulował Twoją prośbę indywidualną."
      : `Dział dostaw anulował <strong>${polishPozycjeLabel(count)}</strong> z Twoich prośb.`;

  const body = [
    emailGreeting(firstName(params.recipientName)),
    emailParagraph(leadFixed),
    suppliers > 1
      ? emailMutedParagraph(
          `Poniżej ${polishPozycjeLabel(count)} od <strong>${suppliers}</strong> dostawców.`
        )
      : "",
    emailMutedParagraph(
      "Szczegóły i ewentualną wiadomość od działu dostaw zobaczysz poniżej. Pełny status jest w aplikacji OnTime."
    ),
    renderProcurementCancelItems(sorted),
    emailButton(mojeUrl(), "Otwórz Moje zamówienia"),
    emailMutedParagraph(
      "To automatyczna wiadomość z systemu OnTime (Mikran). Nie odpowiadaj na ten e-mail."
    ),
  ].join("");

  const subjectPrefix = noteUpdated
    ? "OnTime · Zaktualizowano wiadomość"
    : "OnTime · Prośba anulowana";

  const preheader =
    count === 1
      ? `${sorted[0]!.supplierName} — anulowano`
      : `${polishPozycjeLabel(count)} anulowane`;

  return {
    subject: subjectForItems(subjectPrefix, sorted),
    html: emailDocument({
      preheader,
      headerTitle: noteUpdated ? "Zaktualizowano wiadomość" : "Prośba anulowana",
      headerSubtitle: "Dział dostaw",
      accentColor: EMAIL_THEME.warning,
      bodyHtml: body,
    }),
  };
}
