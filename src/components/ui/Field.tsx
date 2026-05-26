import { cn } from "@/lib/cn";

export type FieldVisualState = "default" | "warning" | "error" | "success";

export function fieldControlClass(
  state: FieldVisualState = "default",
  className?: string
) {
  return cn(
    "w-full min-h-11 rounded-xl border bg-white px-3.5 py-2.5 text-base leading-snug text-slate-900 shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:min-h-[2.5rem] sm:text-sm",
    state === "default" &&
      "border-slate-200 focus:border-indigo-500 focus:ring-sky-500/15",
    state === "warning" &&
      "border-amber-300 bg-amber-50/50 focus:border-amber-500 focus:ring-amber-500/15",
    state === "error" &&
      "border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/15",
    state === "success" &&
      "border-emerald-300 bg-emerald-50/40 focus:border-emerald-500 focus:ring-emerald-500/15",
    className
  );
}

export function Field({
  label,
  children,
  className,
  hint,
  error,
  state,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hint?: string;
  error?: string;
  state?: FieldVisualState;
}) {
  const message = error ?? hint;
  const messageTone =
    error || state === "error"
      ? "text-red-700"
      : state === "warning"
        ? "text-amber-800"
        : state === "success"
          ? "text-emerald-800"
          : "text-slate-500";

  return (
    <label className={cn("block space-y-1.5", className)}>
      {label ? (
        <span className="block text-xs font-semibold tracking-wide text-slate-600">
          {label}
        </span>
      ) : null}
      {children}
      {message ? (
        <span className={cn("block text-xs leading-snug", messageTone)}>{message}</span>
      ) : null}
    </label>
  );
}

export function Input({
  state = "default",
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  state?: FieldVisualState;
}) {
  return (
    <input
      className={fieldControlClass(state, className)}
      aria-invalid={state === "error" ? true : undefined}
      {...props}
    />
  );
}

export function Select({
  state = "default",
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  state?: FieldVisualState;
}) {
  return (
    <select
      className={cn(
        fieldControlClass(state, className),
        "min-w-[8rem] cursor-pointer pr-9"
      )}
      aria-invalid={state === "error" ? true : undefined}
      {...props}
    />
  );
}
