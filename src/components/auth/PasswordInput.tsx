"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Input, type FieldVisualState } from "@/components/ui/Field";

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function PasswordInput({
  id: idProp,
  value,
  onChange,
  state = "default",
  autoComplete = "new-password",
  autoFocus,
  describedBy,
  placeholder,
  onBlur,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  state?: FieldVisualState;
  autoComplete?: "new-password" | "current-password";
  autoFocus?: boolean;
  describedBy?: string;
  placeholder?: string;
  onBlur?: () => void;
}) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        state={state}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        placeholder={placeholder}
        className="pr-11"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 transition-colors",
          "hover:bg-slate-100 hover:text-slate-600",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-sky)]"
        )}
        aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
        aria-pressed={visible}
        tabIndex={0}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}
