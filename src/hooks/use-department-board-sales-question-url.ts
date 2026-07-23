"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DepartmentBoardQuestionFilter } from "@/components/department-board/DepartmentBoardSalesChrome";

export const DEPARTMENT_BOARD_QUESTION_FILTER_PARAM = "filtr";
export const DEPARTMENT_BOARD_QUESTION_SEARCH_PARAM = "q";

const VALID_FILTERS = new Set<DepartmentBoardQuestionFilter>([
  "all",
  "open",
  "answered",
  "closed",
  "unseen",
  "own_unseen",
  "mine",
]);

export function parseDepartmentBoardQuestionFilter(
  value: string | null
): DepartmentBoardQuestionFilter | null {
  if (!value || !VALID_FILTERS.has(value as DepartmentBoardQuestionFilter)) return null;
  return value as DepartmentBoardQuestionFilter;
}

function readFilterSearchFromUrl(searchParams: URLSearchParams): {
  filter: DepartmentBoardQuestionFilter;
  search: string;
} {
  return {
    filter: parseDepartmentBoardQuestionFilter(
      searchParams.get(DEPARTMENT_BOARD_QUESTION_FILTER_PARAM)
    ) ?? "all",
    search: searchParams.get(DEPARTMENT_BOARD_QUESTION_SEARCH_PARAM) ?? "",
  };
}

/** Filtr i wyszukiwanie pytań na /tablica — zsynchronizowane z URL (jak ?filtr= / ?q=). */
export function useDepartmentBoardSalesQuestionUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = readFilterSearchFromUrl(searchParams);
  const [questionFilter, setQuestionFilter] = useState<DepartmentBoardQuestionFilter>(
    initial.filter
  );
  const [questionSearch, setQuestionSearch] = useState(initial.search);
  const lastWrittenToUrl = useRef<string | null>(null);
  const searchParamsRef = useRef(searchParams);

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  useEffect(() => {
    const fromUrl = readFilterSearchFromUrl(searchParams);
    const signature = `${fromUrl.filter}|${fromUrl.search}`;
    if (signature === (lastWrittenToUrl.current ?? "")) return;
    setQuestionFilter(fromUrl.filter);
    setQuestionSearch(fromUrl.search);
  }, [searchParams]);

  const replaceUrl = useCallback(
    (next: {
      filter?: DepartmentBoardQuestionFilter;
      search?: string;
      clearWatek?: boolean;
    }) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      const nextFilter = next.filter ?? questionFilter;
      const nextSearch = next.search ?? questionSearch;

      if (next.filter !== undefined) {
        if (nextFilter === "all") params.delete(DEPARTMENT_BOARD_QUESTION_FILTER_PARAM);
        else params.set(DEPARTMENT_BOARD_QUESTION_FILTER_PARAM, nextFilter);
      }
      if (next.search !== undefined) {
        const trimmed = next.search.trim();
        if (trimmed) params.set(DEPARTMENT_BOARD_QUESTION_SEARCH_PARAM, trimmed);
        else params.delete(DEPARTMENT_BOARD_QUESTION_SEARCH_PARAM);
      }
      if (next.clearWatek) params.delete("watek");

      lastWrittenToUrl.current = `${nextFilter}|${nextSearch.trim()}`;
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, questionFilter, questionSearch, router]
  );

  const setFilter = useCallback(
    (next: DepartmentBoardQuestionFilter) => {
      setQuestionFilter(next);
      replaceUrl({ filter: next, search: questionSearch, clearWatek: true });
    },
    [questionSearch, replaceUrl]
  );

  const setSearch = useCallback(
    (next: string) => {
      setQuestionSearch(next);
      replaceUrl({ filter: questionFilter, search: next, clearWatek: true });
    },
    [questionFilter, replaceUrl]
  );

  const clearSearch = useCallback(() => {
    setQuestionSearch("");
    replaceUrl({ filter: questionFilter, search: "", clearWatek: true });
  }, [questionFilter, replaceUrl]);

  return {
    questionFilter,
    questionSearch,
    setFilter,
    setSearch,
    clearSearch,
  };
}
