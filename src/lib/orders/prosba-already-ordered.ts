/**
 * „Czy to już jedzie?” w formularzu prośby — czysty moduł (bez bazy), wspólny dla
 * serwera (akcja) i klienta (podpowiedź przy pozycji, potwierdzenie przy wysyłce).
 *
 * Zasada: prośba handlowca to ilość dla JEGO klienta — cudze prośby nie znaczą, że towar
 * jest wolny. Pewność daje dopiero towar w otwartym ZD u dostawcy, którego nie „zabrały”
 * czekające zamówienia klientów (ZK bez rezerwacji). Do tego własny dubel: ta sama osoba
 * ma już otwartą prośbę na ten towar.
 */

import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { parseOrderQuantity } from "@/lib/orders/individual";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { IndividualRequestKind } from "@/types/database";

/** Maks. towarów w jednym zapytaniu do serwera — klient dzieli dłuższe listy (ZK) na części. */
export const PROSBA_ALREADY_ORDERED_MAX_TW_IDS = 30;

/** Etap własnej otwartej prośby: czeka na zamówienie / zamówiona / częściowo dostarczona. */
export type ProsbaOpenRequestPhase = "pending" | "ordered" | "partial";

/** Otwarta prośba tego samego handlowca na ten sam towar (dubel). */
export type ProsbaOwnRequestRef = {
  id: string;
  phase: ProsbaOpenRequestPhase;
  /** Kiedy złożono prośbę (ISO). */
  createdAt: string;
  /** Kiedy zakupy zamówiły (ISO) — null dla „pending”. */
  orderedAt: string | null;
  quantity: number | null;
  deliveredQuantity: number;
  supplierName: string | null;
};

/** Dokument ZD z tym towarem (Subiekt) — numer, data wystawienia i termin realizacji. */
export type ProsbaIncomingZdDoc = {
  dokNr: string;
  /** YYYY-MM-DD */
  issued: string | null;
  /** YYYY-MM-DD — termin realizacji z ZD. */
  deadline: string | null;
  /** Sztuki tego towaru na ZD. */
  qty: number | null;
};

/** Towar w drodze — Subiekt na żywo (kreator ZD dla jednego towaru), w sztukach. */
export type ProsbaIncoming = {
  /** Otwarte ZD u dostawcy. */
  incoming: number;
  /** Stan dostępny (może być ujemny: rezerwacje ponad stan). */
  available: number;
  /** Zamówienia klientów (ZK) bez rezerwacji — czekają na tę dostawę. */
  zkWaiting: number;
  /** Część dostawy, której nie zabiorą czekające ZK: clamp(incoming + available − zkWaiting, 0, incoming). */
  freeIncoming: number;
  /** ZD z terminem (najbliższy termin pierwszy) — puste, gdy nie udało się ich wskazać. */
  docs: ProsbaIncomingZdDoc[];
};

export type ProsbaAlreadyOrderedInfo = {
  /** Własne otwarte prośby na ten towar (dla handlowca, którego dotyczy formularz). */
  own: ProsbaOwnRequestRef[];
  /** Null = Subiekt nie odpowiedział albo brak danych — wtedy nic nie obiecujemy. */
  incoming: ProsbaIncoming | null;
};

/** tw_Id → informacja; brak klucza = nic do pokazania. */
export type ProsbaAlreadyOrderedMap = Record<number, ProsbaAlreadyOrderedInfo>;

export const PROSBA_ALREADY_ORDERED_MAX_REFS = 3;

/** Wolna część dostawy — wspólny wzór dla serwera i testów. */
export function computeFreeIncoming(input: {
  incoming: number;
  available: number;
  zkWaiting: number;
}): number {
  const incoming = Math.max(0, input.incoming);
  const free = incoming + input.available - Math.max(0, input.zkWaiting);
  return Math.max(0, Math.min(incoming, round1(free)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const PHASE_RANK: Record<ProsbaOpenRequestPhase, number> = { partial: 0, ordered: 1, pending: 2 };

/** Kolejność własnych próśb: częściowo / zamówione przed czekającymi, potem najnowsze. */
export function sortProsbaOwnRequests(refs: readonly ProsbaOwnRequestRef[]): ProsbaOwnRequestRef[] {
  return [...refs].sort(
    (a, b) => PHASE_RANK[a.phase] - PHASE_RANK[b.phase] || b.createdAt.localeCompare(a.createdAt)
  );
}

/** YYYY-MM-DD lub ISO → „08.10”. */
export function shortDayLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.length > 10 ? warsawDayKey(value) : value;
  const [, m, d] = key.split("-");
  return m && d ? `${d}.${m}` : null;
}

function warsawDayKey(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  return new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
}

export function formatPieces(n: number): string {
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(n)} szt.`;
}

/**
 * - `mine` — ta sama osoba ma już otwartą prośbę (dubel),
 * - `free` — w drodze i wolne w ilości, która wystarcza, ZD z terminem w przód (pewne),
 * - `uncertain` — wolne wystarcza, ale termin ZD minął albo jest nieznany,
 * - `partial` — w drodze wolne, ale mniej niż potrzeba,
 * - `claimed` — w drodze, ale całość czeka na zamówienia klientów.
 */
export type ProsbaAlreadyOrderedTone = "mine" | "free" | "uncertain" | "partial" | "claimed";

export type ProsbaAlreadyOrderedView = {
  tone: ProsbaAlreadyOrderedTone;
  title: string;
  /** Krótka etykieta do zwiniętego wiersza pozycji. */
  badge: string;
  /** Wiersze szczegółów — skąd liczba, ZD z terminami, własne prośby. */
  details: string[];
  /** Zdanie „co z tym zrobić”. */
  advice: string;
  /** Czy proponować „Tylko powiadom, gdy dotrze” zamiast nowego zamówienia. */
  suggestNotify: boolean;
  /** Czy przy wysyłce poprosić o potwierdzenie. */
  confirmOnSubmit: boolean;
};

/** Prośba składana w imieniu innego handlowca (zakupy, „dla”) — inne zaimki. */
export type ProsbaAlreadyOrderedAudience = {
  forOther?: boolean;
  /** Dziś (YYYY-MM-DD, Warszawa) — termin w przeszłości to spóźnienie. Testy podają stały. */
  todayKey?: string;
  /** Ilość wpisana w pozycji (szt.) — porównujemy z wolną częścią dostawy. */
  requestedQty?: number | null;
  /** Pozycja z ZK klienta — jego ZK nie zabiera dostawy samemu sobie. */
  ownZkQty?: number | null;
};

function zdDocDetail(doc: ProsbaIncomingZdDoc, todayKey: string): string {
  const parts = [/^ZD\b/i.test(doc.dokNr) ? doc.dokNr : `ZD ${doc.dokNr}`];
  if (doc.qty != null && doc.qty > 0) parts.push(formatPieces(doc.qty));
  if (doc.issued) parts.push(`z ${shortDayLabel(doc.issued)}`);
  if (doc.deadline) {
    parts.push(
      doc.deadline < todayKey
        ? `termin ${shortDayLabel(doc.deadline)} minął - dostawa spóźniona`
        : `termin ${shortDayLabel(doc.deadline)}`
    );
  }
  return parts.join(" · ");
}

function ownDetail(r: ProsbaOwnRequestRef, forOther: boolean): string {
  const who = forOther ? "Prośba tego handlowca" : "Twoja prośba";
  const parts = [r.quantity ? `${who} · ${formatPieces(r.quantity)}` : who];
  if (r.phase === "pending") {
    parts.push(`z ${shortDayLabel(r.createdAt) ?? "-"} - czeka na zamówienie`);
  } else {
    const where = r.supplierName ? ` u ${r.supplierName}` : "";
    parts.push(`zamówiona ${shortDayLabel(r.orderedAt ?? r.createdAt) ?? "-"}${where}`);
    if (r.phase === "partial" && r.deliveredQuantity > 0) {
      parts.push(`dotarło ${formatPieces(r.deliveredQuantity)}`);
    }
  }
  return parts.join(" · ");
}

/** „50 szt. w drodze · 37 szt. czeka na zamówienia klientów” — skąd bierze się wolna część. */
function incomingBreakdown(i: ProsbaIncoming): string {
  const parts = [`${formatPieces(i.incoming)} w drodze`];
  if (i.zkWaiting > 0) parts.push(`${formatPieces(i.zkWaiting)} czeka na zamówienia klientów`);
  if (i.available < 0) parts.push(`${formatPieces(-i.available)} brakuje do rezerwacji`);
  return parts.join(" · ");
}

/**
 * Widok podpowiedzi dla jednej pozycji. Null = nic do pokazania (nic nie jedzie, brak
 * dubla albo Subiekt nie odpowiedział).
 */
export function buildProsbaAlreadyOrderedView(
  info: ProsbaAlreadyOrderedInfo | null | undefined,
  audience: ProsbaAlreadyOrderedAudience = {}
): ProsbaAlreadyOrderedView | null {
  if (!info) return null;
  const forOther = audience.forOther === true;
  const todayKey = audience.todayKey ?? warsawDayKey(new Date().toISOString());
  const typed =
    audience.requestedQty != null && audience.requestedQty > 0 ? audience.requestedQty : null;
  // Pozycja z ZK: klient potrzebuje całej ilości z ZK, nawet gdy w prośbie wpisano tylko
  // brakującą część — półka liczy się raz (w shelfFree), nie dwa razy.
  const ownZk = audience.ownZkQty != null && audience.ownZkQty > 0 ? audience.ownZkQty : null;
  const requested = ownZk != null ? Math.max(typed ?? 0, ownZk) : typed;
  const own = sortProsbaOwnRequests(info.own).slice(0, PROSBA_ALREADY_ORDERED_MAX_REFS);
  const inc =
    info.incoming && info.incoming.incoming > 0
      ? incomingForOwnZk(info.incoming, audience.ownZkQty)
      : null;
  const zdLines = inc ? inc.docs.map((d) => zdDocDetail(d, todayKey)) : [];

  if (own.length > 0) {
    const first = own[0]!;
    return {
      tone: "mine",
      badge: forOther ? "Ma już prośbę" : "Masz już prośbę",
      title:
        first.phase === "pending"
          ? forOther
            ? "Ten handlowiec ma już otwartą prośbę na ten towar"
            : "Masz już otwartą prośbę na ten towar"
          : forOther
            ? "Ten towar już zamówiono z prośby tego handlowca"
            : "Ten towar już zamówiono z Twojej prośby",
      details: own.map((r) => ownDetail(r, forOther)),
      // Zamówione w OnTime, a w Subiekcie nic nie jedzie — dotarło i się rozeszło albo utknęło.
      advice:
        first.phase !== "pending" && info.incoming && info.incoming.incoming <= 0
          ? "W Subiekcie nie ma tego towaru na otwartym ZD - zapytaj zakupy, co z tym zamówieniem, zanim złożysz kolejne."
          : "Druga prośba to drugie zamówienie u dostawcy. Wyślij tylko po dodatkową ilość.",
      suggestNotify: false,
      confirmOnSubmit: true,
    };
  }

  if (!inc) return null;
  const free = inc.freeIncoming;
  const docsQty = inc.docs.reduce((sum, d) => sum + (d.qty ?? 0), 0);
  const restQty = round1(inc.incoming - docsQty);
  const details = [
    incomingBreakdown(inc),
    ...zdLines,
    // Znalezione ZD nie pokrywają całości — reszta jest w innych (starszych / spoza indeksu).
    inc.docs.length > 0 && restQty > 0 ? `+${formatPieces(restQty)} w innych otwartych ZD` : null,
  ].filter((line): line is string => line != null);

  if (free <= 0) {
    return {
      tone: "claimed",
      badge: "W drodze, zajęte",
      title: "W drodze, ale całość jest dla zamówień klientów",
      details,
      advice: "Nic z tej dostawy nie zostanie wolne - zamów normalnie.",
      suggestNotify: false,
      confirmOnSubmit: false,
    };
  }

  // Półka po czekających ZK + wolne z dostawy — razem to, co realnie może dostać klient.
  const shelfFree = Math.max(0, inc.available - inc.zkWaiting);
  if (requested != null && free + shelfFree < requested) {
    const missing = round1(requested - free - shelfFree);
    return {
      tone: "partial",
      badge: `Wolne ${formatPieces(free)}`,
      title: `W drodze wolne tylko ${formatPieces(free)}`,
      details,
      advice: `Do pełnej ilości brakuje ${formatPieces(missing)} - zamów normalnie.`,
      suggestNotify: false,
      confirmOnSubmit: false,
    };
  }

  // Pewność daje dopiero ZD z terminem w przód; spóźnione albo bez terminu — ostrożniej.
  const hasFutureDeadline = inc.docs.some((d) => d.deadline != null && d.deadline >= todayKey);
  if (!hasFutureDeadline) {
    const late = inc.docs.length > 0 && inc.docs.every((d) => d.deadline != null && d.deadline < todayKey);
    return {
      tone: "uncertain",
      badge: late ? "W drodze, spóźnione" : "W drodze, bez terminu",
      title: late
        ? `W drodze wolne ${formatPieces(free)} - ale termin ZD minął`
        : `W drodze wolne ${formatPieces(free)} - termin nieznany`,
      details,
      advice: late
        ? "Termin ZD minął — sprawdź u zakupów."
        : "Brak terminu w ZD.",
      suggestNotify: true,
      confirmOnSubmit: false,
    };
  }

  return {
    tone: "free",
    badge: "W drodze, wolne",
    title: `Towar jest w drodze - wolne ${formatPieces(free)}`,
    details,
    advice: "Możesz zamiast tego poprosić o powiadomienie.",
    suggestNotify: true,
    confirmOnSubmit: true,
  };
}

/** tw_Id pozycji do sprawdzenia (tylko zamówienie, tylko wybrane z Subiekta). */
export function collectProsbaAlreadyOrderedTwIds(
  lines: readonly Pick<ProductLineDraft, "subiektTwId">[],
  requestKind: IndividualRequestKind,
  /** Zęby — zawsze zamawiane pod pacjenta, bez podpowiedzi o dostępności. */
  stockExemptTwIds?: ReadonlySet<number>
): number[] {
  if (requestKind !== "zamowienie") return [];
  const ids = new Set<number>();
  for (const line of lines) {
    const id = line.subiektTwId;
    if (id == null || !Number.isFinite(id) || id <= 0) continue;
    if (stockExemptTwIds?.has(Math.trunc(id))) continue;
    ids.add(Math.trunc(id));
  }
  return [...ids].sort((a, b) => a - b);
}

/** Ilość z pozycji formularza (szt.) do porównania z wolną częścią dostawy. */
export function prosbaLineRequestedQty(line: Pick<ProductLineDraft, "quantity">): number | null {
  return parseOrderQuantity(line.quantity ?? "");
}

/**
 * Potwierdzenie przy wysyłce: własny dubel albo towar w drodze i wolny w potrzebnej
 * ilości. „Zajęte” i „częściowo” nie pytają — tam zamówienie jest potrzebne.
 */
export function buildProsbaAlreadyOrderedConfirm<
  L extends Pick<ProductLineDraft, "subiektTwId" | "symbol" | "product" | "quantity"> & {
    zkQuantity?: number | null;
  },
>(
  lines: readonly L[],
  requestKind: IndividualRequestKind,
  /** Mapa po tw_Id albo wynik per pozycja (różni handlowcy w jednym formularzu). */
  infoFor: ProsbaAlreadyOrderedMap | ((line: L) => ProsbaAlreadyOrderedInfo | undefined),
  audience: Omit<ProsbaAlreadyOrderedAudience, "requestedQty" | "ownZkQty"> & {
    /** Jak karta: wystarczający stan z półki wygrywa z dostawą (poza własnym dublem). */
    shelfSufficient?: (line: L) => boolean;
  } = {}
): { title: string; summary: string; message: string } | null {
  if (requestKind !== "zamowienie") return null;
  const { shelfSufficient, ...viewAudience } = audience;
  const forOther = audience.forOther === true;
  const hits: { label: string; view: ProsbaAlreadyOrderedView }[] = [];
  for (const line of lines) {
    const id = line.subiektTwId;
    if (id == null) continue;
    const info = typeof infoFor === "function" ? infoFor(line) : infoFor[id];
    const view = buildProsbaAlreadyOrderedView(info, {
      ...viewAudience,
      requestedQty: prosbaLineRequestedQty(line),
      ownZkQty: line.zkQuantity ?? null,
    });
    if (!view?.confirmOnSubmit) continue;
    if (view.tone !== "mine" && shelfSufficient?.(line)) continue;
    hits.push({ label: line.symbol?.trim() || line.product?.trim() || `#${id}`, view });
  }
  if (hits.length === 0) return null;
  const n = hits.length;
  const mineCount = hits.filter((h) => h.view.tone === "mine").length;
  const summary = `${n} ${polishPluralWord(n, "pozycja", "pozycje", "pozycji")}: ${hits
    .map((h) => h.label)
    .join(", ")}`;
  if (mineCount > 0) {
    return {
      title: forOther
        ? n === 1
          ? "Ten handlowiec ma już prośbę na ten towar"
          : "Ten handlowiec ma już prośby na te towary"
        : n === 1
          ? "Masz już prośbę na ten towar"
          : "Masz już prośby na te towary",
      summary,
      message:
        "Druga prośba na ten sam towar trafi do zakupów jako osobne zamówienie. Wyślij tylko wtedy, gdy potrzebna jest dodatkowa ilość.",
    };
  }
  return {
    title: n === 1 ? "Ten towar jest już w drodze" : "Te towary są już w drodze",
    summary,
    message:
      "W otwartym ZD u dostawcy jest wolna ilość - nie czekają na nią zamówienia klientów. Zamiast nowego zamówienia wróć do formularza i zamień prośbę na powiadomienie. Wyślij, jeśli klient potrzebuje towaru szybciej niż ta dostawa.",
  };
}

/** Ton bloku — ta sama rodzina co status stanu magazynu przy pozycji (+ zielony „wolne”). */
export function prosbaAlreadyOrderedStockTone(
  tone: ProsbaAlreadyOrderedTone
): "amber" | "sky" | "slate" | "emerald" {
  if (tone === "mine") return "amber";
  if (tone === "free") return "emerald";
  if (tone === "partial" || tone === "uncertain") return "sky";
  return "slate";
}

/**
 * Prośba z ZK: ZK tego klienta (bez rezerwacji) jest już w puli `zkWaiting` — dostawa, która
 * na nie czeka, jest dla NIEGO. Odejmujemy więc tylko cudze ZK. `ownZkQty` = ilość pozycji ZK.
 */
export function incomingForOwnZk(inc: ProsbaIncoming, ownZkQty: number | null | undefined): ProsbaIncoming {
  const own = ownZkQty != null && ownZkQty > 0 ? Math.min(ownZkQty, inc.zkWaiting) : 0;
  if (own <= 0) return inc;
  const zkWaiting = round1(inc.zkWaiting - own);
  return {
    ...inc,
    zkWaiting,
    freeIncoming: computeFreeIncoming({ incoming: inc.incoming, available: inc.available, zkWaiting }),
  };
}

export type ZkLineIncomingCover = {
  /** Dostawa (z półką) pokrywa ilość tej pozycji ZK. */
  covered: boolean;
  /** Jest ZD z terminem w przód — można nie zamawiać. */
  certain: boolean;
  /** Najbliższy ZD z terminem (do etykiety). */
  doc: ProsbaIncomingZdDoc | null;
  /** Wolne dla tego ZK (półka po cudzych ZK + wolne z dostawy), szt. */
  freeForLine: number;
};

/**
 * Notatnik ZK → prośba: czy tę pozycję pokryje towar w drodze. Własne ZK nie „zabiera”
 * dostawy samemu sobie; liczy się półka + dostawa minus CUDZE czekające ZK.
 */
export function zkLineIncomingCover(
  inc: ProsbaIncoming | null | undefined,
  lineQty: number | null | undefined,
  todayKey: string = warsawDayKey(new Date().toISOString())
): ZkLineIncomingCover | null {
  if (!inc || !(inc.incoming > 0) || lineQty == null || !(lineQty > 0)) return null;
  const adj = incomingForOwnZk(inc, lineQty);
  const shelfFree = Math.max(0, adj.available - adj.zkWaiting);
  const freeForLine = round1(adj.freeIncoming + shelfFree);
  const future = [...inc.docs]
    .filter((d) => d.deadline != null && d.deadline >= todayKey)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  return {
    covered: freeForLine >= lineQty,
    certain: future.length > 0,
    doc: future[0] ?? inc.docs[0] ?? null,
    freeForLine,
  };
}
