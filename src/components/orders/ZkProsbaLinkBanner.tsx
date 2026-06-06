import { cn } from "@/lib/cn";

export function ZkProsbaLinkBanner({
  zkNumber,
  clientLabel,
}: {
  zkNumber: string;
  clientLabel?: string | null;
}) {
  const nr = zkNumber.trim();
  if (!nr) return null;

  const client = clientLabel?.trim();

  return (
    <div
      className={cn(
        "border-b border-indigo-100 bg-indigo-50/90 px-3 py-2.5 text-sm text-indigo-950 sm:px-6"
      )}
      role="status"
    >
      <p className="leading-snug">
        <span className="font-medium">Powiązanie z notatnikiem:</span>{" "}
        zamówienie klienta{" "}
        <span className="font-semibold tabular-nums text-indigo-900">{nr}</span>
        {client ? <span className="text-indigo-800/90"> · {client}</span> : null}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-indigo-800/85">
        Po wysłaniu prośba zostaje przypisana do tej ZK — zmiana nazwy klienta w formularzu nie
        usuwa powiązania. Zobaczysz ją w notatniku („Prośba w toku”) i w „Moje zamówienia”.
      </p>
    </div>
  );
}
