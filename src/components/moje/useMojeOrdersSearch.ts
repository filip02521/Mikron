"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function readSearchFromUrl(searchParams: URLSearchParams): string {
  return (searchParams.get("q") ?? searchParams.get("klient") ?? "").trim();
}

/**
 * Stan wyszukiwania zsynchronizowany z ?q= (i legacy ?klient=).
 * Obsługuje cofanie w przeglądarce bez pętli replace.
 */
export function useMojeOrdersSearch(initial: string, syncUrl: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQueryState] = useState(() => initial.trim());
  const lastWrittenToUrl = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
  }, []);

  useEffect(() => {
    if (!syncUrl) return;
    const fromUrl = readSearchFromUrl(searchParams);
    if (fromUrl === (lastWrittenToUrl.current ?? "")) return;
    setQueryState(fromUrl);
  }, [searchParams, syncUrl]);

  const writeSearchToUrl = useCallback(
    (trimmed: string) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      const currentUrl = readSearchFromUrl(searchParamsRef.current);
      if (trimmed === currentUrl && !searchParamsRef.current.get("klient")) {
        lastWrittenToUrl.current = trimmed;
        return;
      }
      if (trimmed) {
        params.set("q", trimmed);
        params.delete("klient");
      } else {
        params.delete("q");
        params.delete("klient");
      }
      lastWrittenToUrl.current = trimmed;
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    if (!syncUrl) return;
    const trimmed = query.trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!trimmed) {
      writeSearchToUrl("");
      return;
    }

    debounceRef.current = setTimeout(() => writeSearchToUrl(trimmed), 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, syncUrl, writeSearchToUrl]);

  return { query, setQuery, trimmed: query.trim() };
}
