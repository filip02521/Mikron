import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";

const STEPS = [
  "Administrator otwiera Admin → Handlowcy i wysyła link zaproszenia na Twój e-mail, lub",
  "przypisuje Twoje konto do profilu handlowca (ten sam e-mail co w systemie).",
];

export function SalesAccountLinkRequired({
  title,
  description = "Aby korzystać z aplikacji jako handlowiec, konto musi być przypisane do Twojego profilu w systemie.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Alert tone="warning">
        <p className="mb-2 font-semibold">Konto nie jest jeszcze powiązane</p>
        <p className="mb-3">
          Nie możemy pokazać Twoich prośb ani formularza zgłoszenia. Poproś administratora
          systemu o jedną z poniższych opcji:
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Alert>
    </>
  );
}
