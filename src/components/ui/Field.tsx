import { cn } from "@/lib/cn";

export function Field({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && (
        <span className="block text-xs font-semibold tracking-wide text-slate-600">
          {label}
        </span>
      )}
      {children}
    </label>
  );
}

const control =
  "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base leading-snug text-slate-900 shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:min-h-[2.5rem] sm:text-sm";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, props.className)} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(control, "min-w-[8rem] cursor-pointer pr-9", props.className)}
      {...props}
    />
  );
}
