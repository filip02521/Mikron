import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function ManagerPreviewBanner({
  salesPersonName,
  salesPersonId,
  notatnikPreview,
  readOnly,
  className,
}: {
  salesPersonName: string;
  salesPersonId: string;
  notatnikPreview?: boolean;
  /** Administrator — tylko podgląd, bez składania prośb. */
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <Alert tone="info" className={className ?? "mb-4 text-xs leading-relaxed"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Podgląd {notatnikPreview ? "notatnika" : "prośb handlowca"}:{" "}
          <span className="font-semibold text-slate-900">{salesPersonName}</span>.
          {readOnly
            ? " Tryb administratora — tylko odczyt."
            : notatnikPreview
              ? " Edycja dostępna tylko we własnym notatniku."
              : " Potwierdzenie odbioru i archiwum są dostępne tylko na własnym koncie."}
        </p>
        {!readOnly ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {!notatnikPreview ? (
              <Link href={`/prosba?dla=${salesPersonId}`}>
                <Button size="sm" variant="secondary">
                  Prośba w jego imieniu
                </Button>
              </Link>
            ) : (
              <Link href={`/moje?dla=${salesPersonId}`}>
                <Button size="sm" variant="secondary">
                  Panel zamówień
                </Button>
              </Link>
            )}
            <Link href={notatnikPreview ? buildNotatnikPageHref() : "/moje"}>
              <Button size="sm" variant="outline">
                {notatnikPreview ? "Mój notatnik" : "Moje zamówienia"}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/moje?dla=${salesPersonId}`}>
              <Button size="sm" variant="secondary">
                Panel zamówień
              </Button>
            </Link>
            <Link href={buildNotatnikPageHref({ extraParams: { dla: salesPersonId } })}>
              <Button size="sm" variant="outline">
                Notatnik
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Alert>
  );
}
