import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function ManagerPreviewBanner({
  salesPersonName,
  salesPersonId,
}: {
  salesPersonName: string;
  salesPersonId: string;
}) {
  return (
    <Alert tone="info" className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Podgląd panelu handlowca:{" "}
          <span className="font-semibold text-slate-900">{salesPersonName}</span>. Potwierdzenie
          odbioru i archiwum są dostępne tylko na własnym koncie.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/prosba?dla=${salesPersonId}`}>
            <Button size="sm" variant="secondary">
              Prośba w jego imieniu
            </Button>
          </Link>
          <Link href="/moje">
            <Button size="sm" variant="outline">
              Mój panel
            </Button>
          </Link>
        </div>
      </div>
    </Alert>
  );
}
