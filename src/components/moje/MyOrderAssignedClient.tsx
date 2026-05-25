import { cn } from "@/lib/cn";

/** Krótka etykieta klienta — tylko gdy już przypisany. */
export function MyOrderAssignedClient({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return (
    <p className={cn("text-[0.68rem] leading-snug text-slate-600", className)}>
      <span className="text-slate-400">Klient</span>{" "}
      <span className="font-medium text-slate-700">{trimmed}</span>
    </p>
  );
}
