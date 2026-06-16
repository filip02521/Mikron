import { createElement, Fragment, type ReactNode } from "react";

export type NoteBodyBlock =
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const BULLET_LINE_RE = /^(\s*)([-*•])\s+(.+)$/;
const ORDERED_LINE_RE = /^(\s*)(\d+)\.\s+(.+)$/;

/** Dzieli treść notatki na akapity i listy (markdown-lite). */
export function parseNoteBodyBlocks(body: string): NoteBodyBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: NoteBodyBlock[] = [];
  let paragraph: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];

  function flushParagraph() {
    const text = paragraph.join("\n").trimEnd();
    if (text) blocks.push({ type: "paragraph", text });
    paragraph = [];
  }

  function flushUl() {
    if (ul.length) blocks.push({ type: "ul", items: [...ul] });
    ul = [];
  }

  function flushOl() {
    if (ol.length) blocks.push({ type: "ol", items: [...ol] });
    ol = [];
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushUl();
      flushOl();
      continue;
    }

    const bullet = line.match(BULLET_LINE_RE);
    if (bullet) {
      flushParagraph();
      flushOl();
      ul.push(bullet[3]!);
      continue;
    }

    const ordered = line.match(ORDERED_LINE_RE);
    if (ordered) {
      flushParagraph();
      flushUl();
      ol.push(ordered[3]!);
      continue;
    }

    flushUl();
    flushOl();
    paragraph.push(line);
  }

  flushParagraph();
  flushUl();
  flushOl();
  return blocks;
}

const INLINE_BOLD_RE = /\*\*(.+?)\*\*/g;

/** Renderuje **pogrubienie** w jednej linii. */
export function formatInlineNoteText(text: string): ReactNode {
  if (!text.includes("**")) return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_BOLD_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(
      createElement("strong", { key: `${index}-b`, className: "font-semibold text-slate-900" }, match[1])
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 1 ? parts[0]! : createElement(Fragment, null, ...parts);
}

export type NoteTextFormatAction = "bullet" | "number" | "bold";

/** Skróty Ctrl/Cmd+B w polu tekstowym notatki. Zwraca true, gdy obsłużono. */
export function handleNoteFormatKeyDown(
  e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; preventDefault: () => void },
  value: string,
  selectionStart: number,
  selectionEnd: number,
  onChange: (next: string, selectionStart: number, selectionEnd: number) => void
): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "b") return false;
  e.preventDefault();
  const result = applyNoteTextFormat(value, selectionStart, selectionEnd, "bold");
  onChange(result.text, result.selectionStart, result.selectionEnd);
  return true;
}

function lineRange(text: string, start: number, end: number) {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  const lineStart = text.lastIndexOf("\n", safeStart - 1) + 1;
  const lineEndRaw = text.indexOf("\n", safeEnd);
  const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
  return { lineStart, lineEnd, safeStart, safeEnd };
}

/** Stosuje formatowanie w polu tekstowym (zaznaczenie lub bieżąca linia). */
export function applyNoteTextFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  action: NoteTextFormatAction
): { text: string; selectionStart: number; selectionEnd: number } {
  if (action === "bold") {
    const { safeStart, safeEnd } = lineRange(text, selectionStart, selectionEnd);
    if (safeStart === safeEnd) {
      return { text, selectionStart: safeStart, selectionEnd: safeEnd };
    }
    const selected = text.slice(safeStart, safeEnd);
    const wrapped = `**${selected}**`;
    const next = text.slice(0, safeStart) + wrapped + text.slice(safeEnd);
    return {
      text: next,
      selectionStart: safeStart + 2,
      selectionEnd: safeEnd + 2,
    };
  }

  const { lineStart, lineEnd, safeStart, safeEnd } = lineRange(text, selectionStart, selectionEnd);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.length ? block.split("\n") : [""];

  const formatted =
    action === "bullet"
      ? lines.map((line) => {
          if (!line.trim()) return line;
          if (BULLET_LINE_RE.test(line) || ORDERED_LINE_RE.test(line)) {
            return line.replace(ORDERED_LINE_RE, "$1- $3").replace(BULLET_LINE_RE, "$1- $3");
          }
          const indent = line.match(/^(\s*)/)?.[1] ?? "";
          return `${indent}- ${line.trimStart()}`;
        })
      : lines.map((line, index) => {
          if (!line.trim()) return line;
          const indent = line.match(/^(\s*)/)?.[1] ?? "";
          const content = line.replace(BULLET_LINE_RE, "$3").replace(ORDERED_LINE_RE, "$3").trimStart();
          return `${indent}${index + 1}. ${content}`;
        });

  const replacement = formatted.join("\n");
  const next = text.slice(0, lineStart) + replacement + text.slice(lineEnd);
  const delta = replacement.length - block.length;
  return {
    text: next,
    selectionStart: safeStart + delta,
    selectionEnd: safeEnd + delta,
  };
}
