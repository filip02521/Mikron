import { Spinner } from "@/components/ui/Spinner";

export function AuthFormStatus({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={className ?? "flex flex-col items-center gap-3 py-8 text-center"}
    >
      <Spinner size="md" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
