"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoginDirectoryAccountPublic } from "@/lib/auth/login-directory-public";
import { filterLoginDirectoryAccounts } from "@/lib/auth/login-directory";
import { IconCircleCheck, IconSearch } from "@/components/icons/StrokeIcons";
import { Input } from "@/components/ui/Field";
import {
  LOGIN_ACCOUNT_LISTBOX_CLASS,
  LOGIN_ACCOUNT_LIST_WRAPPER_CLASS,
  LOGIN_ACCOUNT_SEARCH_THRESHOLD,
  loginAccountAvatarClass,
  loginAccountCountLabel,
  loginAccountInitials,
  loginAccountRoleDotClass,
  loginAccountRowClass,
} from "@/components/auth/login-account-picker-layout";
import { cn } from "@/lib/cn";

export function LoginAccountPicker({
  accounts,
  value,
  onChange,
  disabled = false,
  searchRequired = false,
  query: controlledQuery,
  onQueryChange,
  loading = false,
  minQueryLength = 3,
  fetchError = "",
}: {
  accounts: LoginDirectoryAccountPublic[];
  value: string | null;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  searchRequired?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  loading?: boolean;
  minQueryLength?: number;
  fetchError?: string;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const query = controlledQuery ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => filterLoginDirectoryAccounts(accounts, query),
    [accounts, query]
  );

  const selectedIndex = useMemo(
    () => (value ? filtered.findIndex((account) => account.id === value) : -1),
    [filtered, value]
  );

  const [keyboardFocusIndex, setKeyboardFocusIndex] = useState(0);
  const focusIndex = useMemo(() => {
    if (selectedIndex >= 0) return selectedIndex;
    if (keyboardFocusIndex >= filtered.length) {
      return Math.max(0, filtered.length - 1);
    }
    return keyboardFocusIndex;
  }, [selectedIndex, keyboardFocusIndex, filtered.length]);

  useEffect(() => {
    if (!value || selectedIndex < 0) return;
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`#login-account-${value}`)
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [value, selectedIndex, filtered]);

  const moveFocus = useCallback(
    (delta: number) => {
      if (!filtered.length) return;
      setKeyboardFocusIndex((current) => {
        const base = selectedIndex >= 0 ? selectedIndex : current;
        return (base + delta + filtered.length) % filtered.length;
      });
    },
    [filtered.length, selectedIndex]
  );

  const handleListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!filtered.length || disabled) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(-1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setKeyboardFocusIndex(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setKeyboardFocusIndex(filtered.length - 1);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const account = filtered[focusIndex];
        if (account) onChange(account.id);
      }
    },
    [disabled, filtered, focusIndex, moveFocus, onChange]
  );

  const showSearch = searchRequired || accounts.length >= LOGIN_ACCOUNT_SEARCH_THRESHOLD;
  const showListHeader = accounts.length > 1;
  const queryTooShort =
    searchRequired && query.trim().length > 0 && query.trim().length < minQueryLength;
  const awaitingSearch =
    searchRequired && query.trim().length < minQueryLength && accounts.length === 0;
  const listSummary =
    filtered.length === accounts.length || searchRequired
      ? loginAccountCountLabel(filtered.length)
      : `${loginAccountCountLabel(filtered.length)} z ${accounts.length}`;

  if (!accounts.length && !searchRequired) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Brak kont w systemie. Skontaktuj się z administratorem lub użyj konfiguracji
        początkowej.
      </p>
    );
  }

  return (
    <div className="min-h-0 space-y-2.5">
      {fetchError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {fetchError}
        </p>
      ) : null}

      {showSearch ? (
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          >
            <IconSearch size={18} strokeWidth={2} />
          </span>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              searchRequired
                ? `Szukaj po imieniu lub nazwisku (min. ${minQueryLength} znaki)…`
                : "Szukaj po imieniu lub nazwisku…"
            }
            autoComplete="off"
            disabled={disabled}
            aria-label="Szukaj konta"
            className="pl-10"
          />
        </div>
      ) : null}

      <div className={LOGIN_ACCOUNT_LIST_WRAPPER_CLASS}>
        {showListHeader ? (
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
            <span className="text-xs font-medium text-slate-500">{listSummary}</span>
          </div>
        ) : null}

        <div
          ref={listRef}
          role="listbox"
          aria-label="Wybierz konto"
          aria-activedescendant={
            filtered[focusIndex] ? `login-account-${filtered[focusIndex]!.id}` : undefined
          }
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          className={cn(
            LOGIN_ACCOUNT_LISTBOX_CLASS,
            "divide-y divide-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-500/70"
          )}
        >
          {awaitingSearch ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Wpisz co najmniej {minQueryLength} znaki, aby wyszukać konto.
            </p>
          ) : queryTooShort ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Wpisz jeszcze {minQueryLength - query.trim().length}{" "}
              {minQueryLength - query.trim().length === 1 ? "znak" : "znaki"}.
            </p>
          ) : loading ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Wyszukiwanie…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Brak kont pasujących do wyszukiwania.
            </p>
          ) : (
            filtered.map((account, index) => {
              const active = value === account.id;
              const focused = focusIndex === index;
              return (
                <button
                  key={account.id}
                  id={`login-account-${account.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={disabled}
                  onClick={() => onChange(account.id)}
                  onMouseEnter={() => setKeyboardFocusIndex(index)}
                  className={loginAccountRowClass({ active, focused, disabled })}
                >
                  <span className={loginAccountAvatarClass(active)} aria-hidden>
                    {loginAccountInitials(account.displayName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {account.displayName}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          loginAccountRoleDotClass(account.role)
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{account.roleLabel}</span>
                    </span>
                  </span>
                  {active ? (
                    <IconCircleCheck
                      size={18}
                      strokeWidth={2}
                      className="shrink-0 text-indigo-600"
                      aria-hidden
                    />
                  ) : (
                    <span className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Podświetlone konto: {filtered[focusIndex]?.displayName ?? "brak"}
      </p>
    </div>
  );
}
