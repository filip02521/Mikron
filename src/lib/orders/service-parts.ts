/**
 * Części serwisowe: towary z cechą Subiekta „Części serwisowe”.
 * W szacunku ZD zachowują się jak „tylko na prośbę” — zakupy zamawiają je dopiero,
 * gdy ktoś (serwisant) złoży prośbę. Źródłem prawdy jest cecha w Subiekcie, nie lista w OnTime.
 */

export const SERVICE_PARTS_CECHA_NAME = "Części serwisowe";

/** app_settings: `{ cechaId: number }` — tylko gdy nazwa cechy w Subiekcie się zmieni. */
export const SERVICE_PARTS_CECHA_SETTING_KEY = "service_parts_cecha";

export const SERVICE_PARTS_ON_REQUEST_NOTE = `Cecha Subiekta „${SERVICE_PARTS_CECHA_NAME}”`;

export type ServicePartsOrigin = "service_cecha";

/** Porównanie nazw cech odporne na wielkość liter, spacje i postać Unicode (ę jako e + ogonek). */
export function normalizeCechaName(name: string | null | undefined): string {
  return String(name ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pl-PL");
}

export function pickServicePartsCechaId(
  cechy: readonly { scopeId: number; name: string }[],
  wantedName: string = SERVICE_PARTS_CECHA_NAME
): number | null {
  const wanted = normalizeCechaName(wantedName);
  for (const c of cechy) {
    const id = Math.trunc(Number(c.scopeId));
    if (id > 0 && normalizeCechaName(c.name) === wanted) return id;
  }
  return null;
}

export function parseServicePartsCechaSetting(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const id = Math.trunc(Number((value as { cechaId?: unknown }).cechaId));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Dokleja towary z cechą do listy „tylko na prośbę”. Ręczny wpis zostaje (z notatką), ale gdy towar ma
 * cechę, też dostaje `origin` — o trybie decyduje cecha, więc UI nie proponuje zdjęcia go z listy,
 * a akcje „usuń” odmawiają, zanim cokolwiek skasują.
 */
export function mergeServicePartsIntoOnRequests<
  T extends { subiektTwId: number; origin?: ServicePartsOrigin },
>(manual: readonly T[], serviceTwIds: readonly number[], makeRow: (twId: number) => T): T[] {
  const service = new Set<number>();
  for (const raw of serviceTwIds) {
    const id = Math.trunc(Number(raw));
    if (Number.isSafeInteger(id) && id > 0) service.add(id);
  }
  const seen = new Set<number>();
  const out: T[] = manual.map((row) => {
    const id = Math.trunc(Number(row.subiektTwId));
    seen.add(id);
    return service.has(id) ? { ...row, origin: "service_cecha" as const } : row;
  });
  for (const id of service) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(makeRow(id));
  }
  return out;
}

export function servicePartTwIdSet(
  rows: readonly { subiektTwId: number; origin?: ServicePartsOrigin }[] | null | undefined
): Set<number> {
  const set = new Set<number>();
  for (const row of rows ?? []) {
    if (row.origin === "service_cecha") set.add(Math.trunc(Number(row.subiektTwId)));
  }
  return set;
}

export function isServicePartOnRequestRow(row: { origin?: ServicePartsOrigin }): boolean {
  return row.origin === "service_cecha";
}
