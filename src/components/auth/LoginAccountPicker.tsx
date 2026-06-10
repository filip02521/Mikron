"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";
import { filterLoginDirectoryAccounts } from "@/lib/auth/login-directory";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import { Input } from "@/components/ui/Field";
import {
  LOGIN_ACCOUNT_LISTBOX_CLASS,
  LOGIN_ACCOUNT_SEARCH_THRESHOLD,
} from "@/components/auth/login-account-picker-layout";

const ACCOUNT_CHIP_CLASS = cn(
  panelChoiceChipClass,
  "flex w-full min-h-11 cursor-pointer items-center px-3 py-2.5 text-left sm:min-h-10"
);

export function LoginAccountPicker({
  accounts,
  value,
  onChange,
  disabled = false,
}: {
  accounts: LoginDirectoryAccount[];
  value: string | null;
  onChange: (accountId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => filterLoginDirectoryAccounts(accounts, query),
    [accounts, query]
  );

  const selectedIndex = useMemo(
    () => (value ? filtered.findIndex((account) => account.id === value) : -1),
    [filtered, value]
  );

  const [focusIndex, setFocusIndex] = useState(() =>
    selectedIndex >= 0 ? selectedIndex : 0
  );

  useEffect(() => {
    if (selectedIndex >= 0) {
      setFocusIndex(selectedIndex);
      return;
    }
    if (focusIndex >= filtered.length) {
      setFocusIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, focusIndex, selectedIndex]);

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
      setFocusIndex((current) => {
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
        setFocusIndex(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setFocusIndex(filtered.length - 1);
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

  if (!accounts.length) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Brak kont w systemie. Skontaktuj się z administratorem lub użyj konfiguracji
        początkowej.
      </p>
    );
  }

  return (
    <div className="min-h-0 space-y-2.5">
      {accounts.length >= LOGIN_ACCOUNT_SEARCH_THRESHOLD ? (
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj po imieniu lub nazwisku…"
          autoComplete="off"
          disabled={disabled}
          aria-label="Szukaj konta"
        />
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
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        )}
      >
        {filtered.length === 0 ? (
          <p className="px-1 text-sm text-slate-500">Brak kont pasujących do wyszukiwania.</p>
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
                onMouseEnter={() => setFocusIndex(index)}
                className={cn(
                  ACCOUNT_CHIP_CLASS,
                  active || focused
                    ? panelChoiceChipSelectedClass
                    : panelChoiceChipIdleClass,
                  disabled && "cursor-not-allowed opacity-60",
                  focused && !active && "ring-1 ring-indigo-200/80"
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                  {account.displayName}
                </span>
              </button>
            );
          })
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        Podświetlone konto: {filtered[focusIndex]?.displayName ?? "brak"}
      </p>
    </div>
  );
}
