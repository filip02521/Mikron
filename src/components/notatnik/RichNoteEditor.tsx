"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  htmlToMarkdown,
  markdownToHtml,
} from "@/lib/sales/note-body-format";

function insertTodoList() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  let current: Node | null = range.startContainer;
  if (current.nodeType === Node.TEXT_NODE) current = current.parentElement;
  const existingTodo = (current as Element | null)?.closest("ul.todo-list");
  if (existingTodo) {
    const currentLi = (current as Element | null)?.closest("li");
    const li = createTodoLi();
    if (currentLi && currentLi.parentElement === existingTodo) {
      existingTodo.insertBefore(li, currentLi.nextSibling);
    } else {
      existingTodo.appendChild(li);
    }
    placeCursorAfterCheckbox(li, selection);
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "todo-list";
  const li = createTodoLi();
  ul.appendChild(li);
  range.deleteContents();
  range.insertNode(ul);
  placeCursorAfterCheckbox(li, selection);
}

function createTodoLi(): HTMLLIElement {
  const li = document.createElement("li");
  li.setAttribute("data-checked", "false");
  const checkbox = document.createElement("span");
  checkbox.className = "todo-checkbox";
  checkbox.setAttribute("contenteditable", "false");
  checkbox.setAttribute("data-checked", "false");
  li.appendChild(checkbox);
  li.appendChild(document.createTextNode("\u200B"));
  return li;
}

function placeCursorAfterCheckbox(li: HTMLLIElement, selection: Selection) {
  const range = document.createRange();
  const textNode = li.lastChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    range.setStart(textNode, 0);
  } else {
    range.setStartAfter(li.lastChild ?? li);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function toggleTodoCheckbox(checkbox: Element) {
  const li = checkbox.closest("li");
  if (!li) return;
  const checked = li.getAttribute("data-checked") === "true";
  const next = !checked;
  li.setAttribute("data-checked", String(next));
  checkbox.setAttribute("data-checked", String(next));
}

function exitTodoList(editor: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  let node: Node | null = sel.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const li = (node as Element | null)?.closest("ul.todo-list > li");
  if (!li) return;
  const todoUl = li.parentElement!;
  const textContent = Array.from(li.childNodes)
    .filter((n) => !(n.nodeType === Node.ELEMENT_NODE && (n as Element).classList.contains("todo-checkbox")))
    .map((n) => n.textContent ?? "")
    .join("")
    .replace(/\u200B/g, "");

  const nextSibling = todoUl.nextSibling;
  todoUl.removeChild(li);
  if (todoUl.children.length === 0) {
    todoUl.remove();
  }

  const p = document.createElement("p");
  p.textContent = textContent;
  if (nextSibling) {
    nextSibling.parentNode?.insertBefore(p, nextSibling);
  } else {
    editor.appendChild(p);
  }

  const range = document.createRange();
  range.selectNodeContents(p);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

type FormatState = {
  bold: boolean;
  italic: boolean;
  ul: boolean;
  ol: boolean;
  todo: boolean;
};

export function RichNoteEditor({
  value,
  onChange,
  onSave,
  editable = true,
  saveOnBlur = true,
  placeholder,
  className,
  editorClassName,
  onActiveChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
  onSave?: () => void;
  editable?: boolean;
  saveOnBlur?: boolean;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  onActiveChange?: (active: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);
  const isInternalChangeRef = useRef(false);
  const [activeFormats, setActiveFormats] = useState<FormatState>({ bold: false, italic: false, ul: false, ol: false, todo: false });

  const refreshActiveFormats = useCallback(() => {
    if (!editable) return;
    try {
      let cursorInTodo = false;
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        let node: Node | null = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        cursorInTodo = !!(node as Element | null)?.closest("ul.todo-list");
      }
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        ul: !cursorInTodo && document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
        todo: cursorInTodo,
      });
    } catch {
      // queryCommandState can throw in some browsers — ignore
    }
  }, [editable]);

  const syncHtml = useCallback((markdown: string) => {
    const el = ref.current;
    if (!el) return;
    const html = markdownToHtml(markdown);
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
  }, []);

  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    lastValueRef.current = value;
    syncHtml(value);
  }, [value, syncHtml]);

  const emitChange = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const markdown = htmlToMarkdown(el.innerHTML);
    lastValueRef.current = markdown;
    isInternalChangeRef.current = true;
    onChange(markdown);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    emitChange();
    onActiveChange?.(false);
    if (saveOnBlur) onSave?.();
  }, [emitChange, onActiveChange, onSave, saveOnBlur]);

  const handleFocus = useCallback(() => {
    onActiveChange?.(true);
    refreshActiveFormats();
  }, [onActiveChange, refreshActiveFormats]);

  const exec = useCallback(
    (command: "bold" | "italic" | "insertUnorderedList" | "insertOrderedList" | "insertTodoList") => {
      const el = ref.current;
      if (!el || !editable) return;
      if (command !== "insertTodoList") {
        el.focus();
        document.execCommand(command, false);
        emitChange();
        refreshActiveFormats();
        return;
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        let node: Node | null = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        const inTodo = (node as Element | null)?.closest("ul.todo-list");
        if (inTodo) {
          exitTodoList(el);
        } else {
          insertTodoList();
        }
      } else {
        insertTodoList();
      }
      const savedSel = window.getSelection();
      const savedRange = savedSel && savedSel.rangeCount ? savedSel.getRangeAt(0) : null;
      el.focus();
      if (savedRange && savedSel) {
        savedSel.removeAllRanges();
        savedSel.addRange(savedRange);
      }
      emitChange();
      refreshActiveFormats();
    },
    [editable, emitChange, refreshActiveFormats]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          let node: Node | null = sel.getRangeAt(0).startContainer;
          if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
          const li = (node as Element | null)?.closest("ul.todo-list > li");
          if (li) {
            const textContent = Array.from(li.childNodes)
              .filter((n) => !(n.nodeType === Node.ELEMENT_NODE && (n as Element).classList.contains("todo-checkbox")))
              .map((n) => n.textContent ?? "")
              .join("")
              .replace(/\u200B/g, "")
              .trim();
            if (!textContent) {
              e.preventDefault();
              const todoUl = li.parentElement!;
              const nextSibling = todoUl.nextSibling;
              todoUl.removeChild(li);
              if (todoUl.children.length === 0) {
                todoUl.remove();
              }
              const p = document.createElement("p");
              p.innerHTML = "<br>";
              const editor = ref.current!;
              if (nextSibling) {
                nextSibling.parentNode?.insertBefore(p, nextSibling);
              } else {
                editor.appendChild(p);
              }
              const range = document.createRange();
              range.selectNodeContents(p);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              emitChange();
              return;
            }
            e.preventDefault();
            const todoUl = li.parentElement!;
            const newLi = createTodoLi();
            todoUl.insertBefore(newLi, li.nextSibling);
            placeCursorAfterCheckbox(newLi, sel);
            emitChange();
            return;
          }
        }
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        exec("bold");
      } else if (key === "i") {
        e.preventDefault();
        exec("italic");
      } else if (key === "enter") {
        e.preventDefault();
        onSave?.();
      }
    },
    [exec, onSave, emitChange]
  );

  return (
    <RichNoteEditorToolbarProvider exec={exec}>
      <div className={cn("group/sticky relative pt-7", className)}>
        <div
          ref={ref}
          contentEditable={editable}
          suppressContentEditableWarning
          onBlur={handleBlur}
          onFocus={handleFocus}
          onInput={emitChange}
          onKeyUp={refreshActiveFormats}
          onKeyDown={handleKeyDown}
          onMouseUp={() => {
            refreshActiveFormats();
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            let node: Node | null = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            const li = (node as Element | null)?.closest("ul.todo-list > li");
            if (!li) return;
            const checkbox = li.querySelector(".todo-checkbox");
            if (!checkbox) return;
            if (range.startContainer === li || (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.parentElement === li && range.startOffset === 0)) {
              placeCursorAfterCheckbox(li as HTMLLIElement, sel);
            }
          }}
          onClick={(e) => {
            const target = e.target as Element;
            const checkbox = target.closest(".todo-checkbox");
            if (checkbox) {
              toggleTodoCheckbox(checkbox);
              emitChange();
              const li = checkbox.closest("li") as HTMLLIElement | null;
              if (li) {
                const sel = window.getSelection();
                if (sel) placeCursorAfterCheckbox(li, sel);
              }
            }
          }}
          data-placeholder={placeholder}
          className={cn(
            "rich-note-editor min-h-[2.5rem] w-full outline-none",
            "text-[13px] leading-relaxed text-slate-900",
            "[&_strong]:font-semibold [&_strong]:text-slate-900",
            "[&_em]:italic",
            "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-slate-400",
            "[&_ul.todo-list]:list-none [&_ul.todo-list]:pl-0",
            "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:marker:font-medium [&_ol]:marker:text-slate-500",
            "[&_p]:mb-1 [&_p:last-child]:mb-0",
            "[&_li]:whitespace-pre-wrap",
            "[&_ul]:space-y-1 [&_ol]:space-y-1",
            editable && "cursor-text",
            editorClassName
          )}
        />
        <RichNoteEditorToolbar editable={editable} activeFormats={activeFormats} />
      </div>
    </RichNoteEditorToolbarProvider>
  );
}

type ExecFn = (command: "bold" | "italic" | "insertUnorderedList" | "insertOrderedList" | "insertTodoList") => void;

const ToolbarContext = createContext<ExecFn | null>(null);

function RichNoteEditorToolbarProvider({
  exec,
  children,
}: {
  exec: ExecFn;
  children: ReactNode;
}) {
  return (
    <ToolbarContext.Provider value={exec}>{children}</ToolbarContext.Provider>
  );
}

function ToolbarButton({
  label,
  title,
  onClick,
  disabled,
  active,
}: {
  label: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-[11px] font-semibold transition disabled:opacity-40",
        active
          ? "bg-indigo-100 text-indigo-800"
          : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800"
      )}
    >
      {label}
    </button>
  );
}

function RichNoteEditorToolbar({ editable, activeFormats }: { editable: boolean; activeFormats: FormatState }) {
  const exec = useContext(ToolbarContext);
  if (!exec) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute -top-7 right-6 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white/95 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-opacity duration-150 z-10",
        "opacity-0",
        editable && "group-hover/sticky:pointer-events-auto group-hover/sticky:opacity-100 group-focus-within/sticky:pointer-events-auto group-focus-within/sticky:opacity-100"
      )}
    >
      <ToolbarButton label="B" title="Pogrubienie (Ctrl+B)" disabled={!editable} active={activeFormats.bold} onClick={() => exec("bold")} />
      <ToolbarButton label="I" title="Kursywa (Ctrl+I)" disabled={!editable} active={activeFormats.italic} onClick={() => exec("italic")} />
      <span className="mx-0.5 h-3 w-px bg-slate-200" aria-hidden />
      <ToolbarButton label="•" title="Lista punktowana" disabled={!editable} active={activeFormats.ul} onClick={() => exec("insertUnorderedList")} />
      <ToolbarButton label="1." title="Lista numerowana" disabled={!editable} active={activeFormats.ol} onClick={() => exec("insertOrderedList")} />
      <ToolbarButton label={<TodoCheckGlyph />} title="Lista zadań" disabled={!editable} active={activeFormats.todo} onClick={() => exec("insertTodoList")} />
    </div>
  );
}

function TodoCheckGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="2.5" />
      <path d="M5 8.5l2 2 4-4.5" />
    </svg>
  );
}
