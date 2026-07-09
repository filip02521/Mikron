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
  const [debouncedQuery, setDebouncedQuery] = useState(() => initial.trim());
  const lastWrittenToUrl = useRef<string | null>(null);
  const urlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParamsRef = useRef(searchParams);

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const setQuery = useCallback((next: string) => {
    setQueryState(next);
  }, []);

  useEffect(() => {
    if (!syncUrl) return;
    const fromUrl = readSearchFromUrl(searchParams);
    if (fromUrl === (lastWrittenToUrl.current ?? "")) return;
    setQueryState(fromUrl);
    setDebouncedQuery(fromUrl);
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

  // Debounce URL sync (350ms)
  useEffect(() => {
    if (!syncUrl) return;
    const trimmed = query.trim();

    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);

    if (!trimmed) {
      writeSearchToUrl("");
      return;
    }

    urlDebounceRef.current = setTimeout(() => writeSearchToUrl(trimmed), 350);

    return () => {
      if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    };
  }, [query, syncUrl, writeSearchToUrl]);

  // Debounce filtering (200ms — shorter than URL sync for snappier UX)
  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);

    const trimmed = query.trim();
    // Immediate update when clearing or when query is very short
    if (!trimmed || trimmed.length < 3) {
      filterDebounceRef.current = setTimeout(() => setDebouncedQuery(trimmed), 0);
      return;
    }

    filterDebounceRef.current = setTimeout(() => setDebouncedQuery(trimmed), 200);

    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [query]);

  return { query, setQuery, trimmed: debouncedQuery.trim(), debouncedQuery };
}
