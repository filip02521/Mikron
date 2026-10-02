"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/ui/sidebar-collapse-script";

/**
 * Zwijane menu boczne (desktop): wąski pasek z ikonami zamiast 16rem — więcej miejsca
 * na obszar roboczy (np. tabela kreatora ZD).
 *
 * Stan żyje w atrybucie `<html data-sidebar="collapsed">` (ustawianym przed renderem
 * przez skrypt z `sidebar-collapse-script.ts`, więc bez mignięcia) i w localStorage.
 * Szerokość czyta CSS ze zmiennej `--app-sidebar-w` (globals.css).
 */

const ATTR = "data-sidebar";
const EVENT = "app-sidebar-change";

function readCollapsed(): boolean {
  return document.documentElement.getAttribute(ATTR) === "collapsed";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setSidebarCollapsed(next: boolean): void {
  if (next) document.documentElement.setAttribute(ATTR, "collapsed");
  else document.documentElement.removeAttribute(ATTR);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // tryb prywatny — stan tylko do przeładowania
  }
  window.dispatchEvent(new Event(EVENT));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/** Stan zwinięcia (SSR: rozwinięte — CSS i tak pokazuje właściwy wariant przed hydracją). */
export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const toggle = useCallback(() => setSidebarCollapsed(!readCollapsed()), []);

  // Inna karta zmieniła ustawienie — zsynchronizuj atrybut.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SIDEBAR_COLLAPSED_STORAGE_KEY) return;
      if (e.newValue === "1") document.documentElement.setAttribute(ATTR, "collapsed");
      else document.documentElement.removeAttribute(ATTR);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [collapsed, toggle];
}

/** Skrót „[” (poza polami tekstowymi) zwija / rozwija menu. */
export function useSidebarCollapseShortcut(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      setSidebarCollapsed(!readCollapsed());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
