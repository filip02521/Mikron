import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function ManagerPreviewBanner({
  salesPersonName,
  salesPersonId,
  notatnikPreview,
}: {
  salesPersonName: string;
  salesPersonId: string;
  notatnikPreview?: boolean;
}) {
  return (
    <Alert tone="info" className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Podgląd {notatnikPreview ? "notatnika" : "prośb handlowca"}:{" "}
          <span className="font-semibold text-slate-900">{salesPersonName}</span>.
          {notatnikPreview
            ? " Edycja dostępna tylko we własnym notatniku."
            : " Potwierdzenie odbioru i archiwum są dostępne tylko na własnym koncie."}
        </p>
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
          <Link href={notatnikPreview ? "/notatnik" : "/moje"}>
            <Button size="sm" variant="outline">
              {notatnikPreview ? "Mój notatnik" : "Moje zamówienia"}
            </Button>
          </Link>
        </div>
      </div>
    </Alert>
  );
}
