"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-public";
import {
  filterLoginDirectoryAccounts,
  isLoginDirectoryQueryValid,
  LOGIN_DIRECTORY_MIN_QUERY_LENGTH,
} from "@/lib/auth/login-directory";
import { readLoginLastAccountId } from "@/lib/auth/login-account-preference";

type DirectoryApiResponse = {
  accounts?: LoginDirectoryAccountPublic[];
  account?: LoginDirectoryAccountPublic | null;
  error?: string;
};

async function fetchLoginDirectory(url: string): Promise<DirectoryApiResponse> {
  const res = await fetch(url, { credentials: "same-origin" });
  try {
    return (await res.json()) as DirectoryApiResponse;
  } catch {
    return { error: "Nie udało się wczytać listy kont." };
  }
}

/** Katalog kont — preload (E2E) albo wyszukiwanie przez API (produkcja). */
export function useLoginDirectorySearch(preloadedAccounts: LoginDirectoryAccountPublic[]) {
  const preloadedMode = preloadedAccounts.length > 0;
  const [remoteAccounts, setRemoteAccounts] = useState<LoginDirectoryAccountPublic[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (preloadedMode) return;

    const storedId = readLoginLastAccountId();
    if (!storedId) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchLoginDirectory(
        `/api/auth/login-directory?id=${encodeURIComponent(storedId)}`
      );
      if (cancelled) return;
      if (data.account) {
        setRemoteAccounts([data.account]);
      }
      setFetchError(data.error ?? "");
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [preloadedMode]);

  useEffect(() => {
    if (preloadedMode) return;

    if (!isLoginDirectoryQueryValid(query)) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        const data = await fetchLoginDirectory(
          `/api/auth/login-directory?q=${encodeURIComponent(query.trim())}`
        );
        if (cancelled) return;
        setRemoteAccounts(data.accounts ?? []);
        setFetchError(data.error ?? "");
        setLoading(false);
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [preloadedMode, query]);

  const accounts = useMemo(() => {
    if (preloadedMode) {
      return filterLoginDirectoryAccounts(preloadedAccounts, query);
    }
    if (isLoginDirectoryQueryValid(query)) {
      return remoteAccounts;
    }
    return remoteAccounts;
  }, [preloadedMode, preloadedAccounts, query, remoteAccounts]);

  const clearSearch = useCallback(() => {
    setQuery("");
    if (!preloadedMode && !readLoginLastAccountId()) {
      setRemoteAccounts([]);
    }
  }, [preloadedMode]);

  return {
    accounts,
    query,
    setQuery,
    loading,
    fetchError,
    preloadedMode,
    searchRequired: !preloadedMode,
    minQueryLength: LOGIN_DIRECTORY_MIN_QUERY_LENGTH,
    clearSearch,
  };
}
