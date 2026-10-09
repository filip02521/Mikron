/**
 * Tekstowe buźki → emotki, jak w Slacku czy Teams: „:)” po spacji zamienia się w trakcie pisania,
 * a przy wysyłce zamieniamy resztę (np. buźkę na samym końcu). Tylko z granicą słowa po obu stronach,
 * więc „http://” ani „10:30” nie są ruszane. Bez „<3” i „B)” — „ilość <3 szt” i punkt „B)” w wyliczance to nie buźki.
 */

import type { ChangeEvent } from "react";

const MAP: Record<string, string> = {
  ":)": "🙂",
  ":-)": "🙂",
  ":(": "🙁",
  ":-(": "🙁",
  ":D": "😀",
  ":-D": "😀",
  ";)": "😉",
  ";-)": "😉",
  ":P": "😛",
  ":-P": "😛",
  ":p": "😛",
  ":O": "😮",
  ":-O": "😮",
  ":o": "😮",
  ":|": "😐",
  ":*": "😘",
  ":'(": "😢",
  "xD": "😆",
  "XD": "😆",
  "B-)": "😎",
};

const ALT = Object.keys(MAP)
  .sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

/** Buźka ze spacją / początkiem przed i spacją / końcem / interpunkcją po. */
const BOUNDED = new RegExp(`(^|[\\s(\\[])(${ALT})(?=$|[\\s).,!?\\]])`, "gm");

/** Cały tekst — przed wysyłką. */
export function convertEmoticons(text: string): string {
  return text.replace(BOUNDED, (_m, pre: string, face: string) => `${pre}${MAP[face] ?? face}`);
}

/**
 * W trakcie pisania: gdy znak wpisany przed kursorem to spacja / nowa linia, buźka tuż przed nim
 * zamienia się na emotkę. Zwraca null, gdy nie ma czego zamienić.
 */
export function convertEmoticonAtCaret(value: string, caret: number): { value: string; caret: number } | null {
  if (caret < 2 || !/[\s]/.test(value[caret - 1] ?? "")) return null;
  const before = value.slice(0, caret - 1);
  const m = new RegExp(`(^|[\\s(\\[])(${ALT})$`).exec(before);
  if (!m) return null;
  const face = m[2]!;
  const emoji = MAP[face];
  if (!emoji) return null;
  const start = before.length - face.length;
  const next = `${value.slice(0, start)}${emoji}${value.slice(start + face.length)}`;
  return { value: next, caret: caret - face.length + emoji.length };
}

/** onChange pola tekstowego: zwykła zmiana albo zmiana z zamianą buźki i przywróceniem kursora. */
export function changeWithEmoticons(e: ChangeEvent<HTMLTextAreaElement>, onChange: (value: string) => void): void {
  const el = e.target;
  const converted = el.selectionStart === el.selectionEnd ? convertEmoticonAtCaret(el.value, el.selectionStart) : null;
  if (!converted) {
    onChange(el.value);
    return;
  }
  onChange(converted.value);
  setTimeout(() => el.setSelectionRange(converted.caret, converted.caret), 0);
}
