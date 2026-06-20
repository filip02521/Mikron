"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-public";
import {
  filterLoginDirectoryAccounts,
  isLoginDirectoryQueryValid,
  LOGIN_DIRECTORY_MIN_QUERY_LENGTH,
} from "@/lib/auth/login-directory";
import { readLoginRecentAccountIds } from "@/lib/auth/login-account-preference";

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

function orderAccountsByIds(
  accounts: LoginDirectoryAccountPublic[],
  ids: string[]
): LoginDirectoryAccountPublic[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return ids
    .map((id) => byId.get(id) ?? null)
    .filter((account): account is LoginDirectoryAccountPublic => account != null);
}

/** Katalog kont — preload (E2E) albo wyszukiwanie przez API (produkcja). */
export function useLoginDirectorySearch(preloadedAccounts: LoginDirectoryAccountPublic[]) {
  const preloadedMode = preloadedAccounts.length > 0;
  const [remoteAccounts, setRemoteAccounts] = useState<LoginDirectoryAccountPublic[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const loadRecentAccounts = useCallback(async () => {
    const storedIds = readLoginRecentAccountIds();
    if (storedIds.length === 0) {
      setRemoteAccounts([]);
      setFetchError("");
      return;
    }

    if (preloadedMode) {
      setRemoteAccounts(orderAccountsByIds(preloadedAccounts, storedIds));
      setFetchError("");
      return;
    }

    setLoading(true);
    const data = await fetchLoginDirectory(
      `/api/auth/login-directory?ids=${storedIds.map((id) => encodeURIComponent(id)).join(",")}`
    );
    setRemoteAccounts(orderAccountsByIds(data.accounts ?? [], storedIds));
    setFetchError(data.error ?? "");
    setLoading(false);
  }, [preloadedAccounts, preloadedMode]);

  useEffect(() => {
    if (!preloadedMode && isLoginDirectoryQueryValid(query)) return;

    let cancelled = false;
    void (async () => {
      await loadRecentAccounts();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadRecentAccounts, preloadedMode, query]);

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
      if (isLoginDirectoryQueryValid(query)) {
        return filterLoginDirectoryAccounts(preloadedAccounts, query);
      }
      if (remoteAccounts.length > 0) {
        return filterLoginDirectoryAccounts(remoteAccounts, query);
      }
      return filterLoginDirectoryAccounts(preloadedAccounts, query);
    }
    if (isLoginDirectoryQueryValid(query)) {
      return remoteAccounts;
    }
    return remoteAccounts;
  }, [preloadedMode, preloadedAccounts, query, remoteAccounts]);

  const clearSearch = useCallback(() => {
    setQuery("");
  }, []);

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
