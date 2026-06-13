"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/cn";
import { OTP_LENGTH } from "@/lib/auth/password-reset-constants";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function OtpCodeInput({
  value,
  onChange,
  disabled,
  error,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  autoFocus?: boolean;
}) {
  const groupId = useId();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const normalized = digitsOnly(value).slice(0, OTP_LENGTH);
    return Array.from({ length: OTP_LENGTH }, (_, index) => normalized[index] ?? "");
  }, [value]);

  const focusIndex = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(OTP_LENGTH - 1, index));
    inputRefs.current[clamped]?.focus();
    inputRefs.current[clamped]?.select();
  }, []);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const frame = requestAnimationFrame(() => focusIndex(0));
    return () => cancelAnimationFrame(frame);
  }, [autoFocus, disabled, focusIndex]);

  const applyDigits = useCallback(
    (nextDigits: string[]) => {
      onChange(nextDigits.join("").slice(0, OTP_LENGTH));
    },
    [onChange]
  );

  function handleDigitChange(index: number, raw: string) {
    const chunk = digitsOnly(raw);
    if (!chunk) {
      const next = [...digits];
      next[index] = "";
      applyDigits(next);
      return;
    }

    if (chunk.length > 1) {
      const merged = [...digits];
      for (let offset = 0; offset < chunk.length && index + offset < OTP_LENGTH; offset += 1) {
        merged[index + offset] = chunk[offset] ?? "";
      }
      applyDigits(merged);
      focusIndex(index + chunk.length);
      return;
    }

    const next = [...digits];
    next[index] = chunk;
    applyDigits(next);
    if (index < OTP_LENGTH - 1) focusIndex(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusIndex(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = digitsOnly(event.clipboardData.getData("text")).slice(0, OTP_LENGTH);
    if (!pasted) return;
    applyDigits(Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] ?? ""));
    focusIndex(Math.min(pasted.length, OTP_LENGTH - 1));
  }

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-labelledby={`${groupId}-label`}
        className="flex justify-center gap-2 sm:gap-2.5"
      >
        <span id={`${groupId}-label`} className="sr-only">
          Kod resetu hasła — 6 cyfr
        </span>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={OTP_LENGTH}
            value={digit}
            disabled={disabled}
            aria-label={`Cyfra ${index + 1} kodu resetu hasła`}
            onChange={(event) => handleDigitChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            className={cn(
              "h-12 w-10 rounded-md border bg-white text-center text-xl font-semibold tracking-widest text-slate-900 shadow-sm transition-[border-color,box-shadow] sm:h-14 sm:w-12 sm:text-2xl",
              "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15",
              error
                ? "border-red-300 bg-red-50/40"
                : "border-slate-200 hover:border-slate-300",
              disabled && "cursor-not-allowed bg-slate-50 text-slate-400"
            )}
          />
        ))}
      </div>
      {error ? <p className="text-center text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
