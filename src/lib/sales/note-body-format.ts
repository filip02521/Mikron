import { createElement, Fragment, type ReactNode } from "react";

export type NoteBodyBlock =
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "todo"; items: { text: string; checked: boolean }[] };

const BULLET_LINE_RE = /^(\s*)([-*•])\s+(.+)$/;
const ORDERED_LINE_RE = /^(\s*)(\d+)\.\s+(.+)$/;
const TODO_LINE_RE = /^(\s*)([-*])\s+\[([ xX])\]\s+(.+)$/;

/** Dzieli treść notatki na akapity i listy (markdown-lite). */
export function parseNoteBodyBlocks(body: string): NoteBodyBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: NoteBodyBlock[] = [];
  let paragraph: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  let todo: { text: string; checked: boolean }[] = [];

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

  function flushTodo() {
    if (todo.length) blocks.push({ type: "todo", items: [...todo] });
    todo = [];
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushUl();
      flushOl();
      flushTodo();
      continue;
    }

    const todoMatch = line.match(TODO_LINE_RE);
    if (todoMatch) {
      flushParagraph();
      flushUl();
      flushOl();
      todo.push({ text: todoMatch[4]!, checked: todoMatch[3]!.toLowerCase() === "x" });
      continue;
    }

    const bullet = line.match(BULLET_LINE_RE);
    if (bullet) {
      flushParagraph();
      flushOl();
      flushTodo();
      ul.push(bullet[3]!);
      continue;
    }

    const ordered = line.match(ORDERED_LINE_RE);
    if (ordered) {
      flushParagraph();
      flushUl();
      flushTodo();
      ol.push(ordered[3]!);
      continue;
    }

    flushUl();
    flushOl();
    flushTodo();
    paragraph.push(line);
  }

  flushParagraph();
  flushUl();
  flushOl();
  flushTodo();
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

export type NoteTextFormatAction = "bullet" | "number" | "bold" | "italic";

/** Skróty Ctrl/Cmd+B i Ctrl/Cmd+I w polu tekstowym notatki. Zwraca true, gdy obsłużono. */
export function handleNoteFormatKeyDown(
  e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; preventDefault: () => void },
  value: string,
  selectionStart: number,
  selectionEnd: number,
  onChange: (next: string, selectionStart: number, selectionEnd: number) => void
): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return false;
  const key = e.key.toLowerCase();
  if (key !== "b" && key !== "i") return false;
  e.preventDefault();
  const action: NoteTextFormatAction = key === "b" ? "bold" : "italic";
  const result = applyNoteTextFormat(value, selectionStart, selectionEnd, action);
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

function stripListPrefix(line: string): string {
  return line.replace(BULLET_LINE_RE, "$3").replace(ORDERED_LINE_RE, "$3").trimStart();
}

function listMarkerLength(line: string): number {
  if (!line.trim()) return 0;
  const bullet = line.match(BULLET_LINE_RE);
  if (bullet) return bullet[0]!.length - bullet[3]!.length;
  const ordered = line.match(ORDERED_LINE_RE);
  if (ordered) return ordered[0]!.length - ordered[3]!.length;
  const indent = line.match(/^(\s*)/)?.[1] ?? "";
  return indent.length;
}

function cursorAfterListPrefix(line: string): number {
  if (!line.length) return 0;
  if (/^(\s*)([-*•])\s*$/.test(line)) return line.length;
  if (/^(\s*)\d+\.\s*$/.test(line)) return line.length;
  return listMarkerLength(line);
}

function formatBulletLine(line: string): string {
  const indent = line.match(/^(\s*)/)?.[1] ?? "";
  if (!line.trim()) return `${indent}- `;
  if (BULLET_LINE_RE.test(line)) return line;
  if (ORDERED_LINE_RE.test(line)) {
    return `${indent}- ${stripListPrefix(line)}`;
  }
  return `${indent}- ${line.trimStart()}`;
}

function formatNumberLine(line: string, number: number): string {
  const indent = line.match(/^(\s*)/)?.[1] ?? "";
  if (!line.trim()) return `${indent}${number}. `;
  return `${indent}${number}. ${stripListPrefix(line)}`;
}

/** Stosuje formatowanie w polu tekstowym (zaznaczenie lub bieżąca linia). */
export function applyNoteTextFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  action: NoteTextFormatAction
): { text: string; selectionStart: number; selectionEnd: number } {
  if (action === "bold" || action === "italic") {
    const marker = action === "bold" ? "**" : "*";
    const { safeStart, safeEnd } = lineRange(text, selectionStart, selectionEnd);
    if (safeStart === safeEnd) {
      const insert = marker + marker;
      const next = text.slice(0, safeStart) + insert + text.slice(safeEnd);
      const cursor = safeStart + marker.length;
      return { text: next, selectionStart: cursor, selectionEnd: cursor };
    }
    const selected = text.slice(safeStart, safeEnd);
    const wrapped = `${marker}${selected}${marker}`;
    const next = text.slice(0, safeStart) + wrapped + text.slice(safeEnd);
    return {
      text: next,
      selectionStart: safeStart + marker.length,
      selectionEnd: safeEnd + marker.length,
    };
  }

  const { lineStart, lineEnd, safeStart, safeEnd } = lineRange(text, selectionStart, selectionEnd);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.length ? block.split("\n") : [""];

  let nextNumber = 1;
  const formatted =
    action === "bullet"
      ? lines.map((line) => formatBulletLine(line))
      : lines.map((line) => formatNumberLine(line, nextNumber++));

  const replacement = formatted.join("\n");
  const next = text.slice(0, lineStart) + replacement + text.slice(lineEnd);
  const delta = replacement.length - block.length;

  let nextStart = safeStart + delta;
  let nextEnd = safeEnd + delta;

  if (safeStart === safeEnd) {
    const beforeCursor = text.slice(lineStart, safeStart);
    const lineIndex = beforeCursor.split("\n").length - 1;
    const cursorInLine = beforeCursor.split("\n").pop()?.length ?? 0;
    const originalLine = lines[lineIndex] ?? "";
    const formattedLine = formatted[lineIndex] ?? "";
    const contentOffset = Math.max(0, cursorInLine - listMarkerLength(originalLine));
    const cursorInFormattedLine = cursorAfterListPrefix(formattedLine) + contentOffset;
    const lineOffset = formatted.slice(0, lineIndex).join("\n").length + (lineIndex > 0 ? 1 : 0);
    const cursor = lineStart + lineOffset + cursorInFormattedLine;
    nextStart = cursor;
    nextEnd = cursor;
  }

  return {
    text: next,
    selectionStart: nextStart,
    selectionEnd: nextEnd,
  };
}

/* ─── Konwersje markdown ↔ HTML dla edytora contentEditable ─── */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdownToHtml(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return out;
}

/** Konwertuje markdown notatki na HTML dla contentEditable. */
export function markdownToHtml(body: string): string {
  const blocks = parseNoteBodyBlocks(body);
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === "paragraph") {
      const lines = block.text.split("\n");
      parts.push(lines.map((line) => `<p>${inlineMarkdownToHtml(line)}</p>`).join(""));
    } else if (block.type === "ul") {
      const items = block.items.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join("");
      parts.push(`<ul>${items}</ul>`);
    } else if (block.type === "todo") {
      const items = block.items.map((item) => `<li data-checked="${item.checked}"><span class="todo-checkbox" contenteditable="false" data-checked="${item.checked}"></span>${inlineMarkdownToHtml(item.text)}</li>`).join("");
      parts.push(`<ul class="todo-list">${items}</ul>`);
    } else {
      const items = block.items.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join("");
      parts.push(`<ol>${items}</ol>`);
    }
  }

  return parts.join("");
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function isBoldNode(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "strong" || tag === "b") return true;
  const style = (el as HTMLElement).style;
  if (style.fontWeight === "bold" || style.fontWeight === "700" || style.fontWeight === "600") return true;
  return false;
}

function isItalicNode(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "em" || tag === "i") return true;
  const style = (el as HTMLElement).style;
  if (style.fontStyle === "italic") return true;
  return false;
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return unescapeHtml(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(nodeToMarkdown).join("");

  if (isBoldNode(el)) return `**${inner}**`;
  if (isItalicNode(el)) return `*${inner}*`;

  if (tag === "br") return "\n";
  if (tag === "p") return `${inner}\n\n`;
  if (tag === "div") return `${inner}\n`;
  if (tag === "ul") {
    const isTodo = el.classList.contains("todo-list");
    return Array.from(el.children)
      .map((li) => {
        if (isTodo) {
          const checked = li.getAttribute("data-checked") === "true";
          const inner = Array.from(li.childNodes)
            .filter((n) => !(n.nodeType === Node.ELEMENT_NODE && (n as Element).classList.contains("todo-checkbox")))
            .map(nodeToMarkdown)
            .join("");
          return `- [${checked ? "x" : " "}] ${inner}`;
        }
        return `- ${Array.from(li.childNodes).map(nodeToMarkdown).join("")}`;
      })
      .join("\n") + "\n";
  }
  if (tag === "ol") {
    return Array.from(el.children)
      .map((li, i) => `${i + 1}. ${Array.from(li.childNodes).map(nodeToMarkdown).join("")}`)
      .join("\n") + "\n";
  }
  if (tag === "li") return inner;

  return inner;
}

/** Konwertuje HTML z contentEditable z powrotem na markdown. */
export function htmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const root = doc.body;
  let markdown = Array.from(root.childNodes).map(nodeToMarkdown).join("");

  markdown = markdown
    .replace(/\u200B/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .trim();

  return markdown;
}
