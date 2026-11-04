import { SectionTabNav } from "@/components/ui/SectionTabNav";
import { ServiceOverdueLoanersNotice } from "@/components/serwis/ServiceOverdueLoanersNotice";

export type ServiceHubTab = "zlecenia" | "czesci" | "zamienniki" | "modele";

/**
 * Hub serwisu: jedna pozycja menu, widoki jako zakładki (DESIGN.md → Navigation). Konto serwisanta ma te same
 * cztery widoki w menu bocznym — wtedy bez zakładek (`showTabs={false}`), żeby nie powtarzać nawigacji.
 */
export function ServiceHubTabs({ active, showTabs = true }: { active: ServiceHubTab; showTabs?: boolean }) {
  return (
    <>
      {showTabs ? (
      <SectionTabNav
        embedded
        activeTab={active}
        ariaLabel="Widoki serwisu"
        tabs={[
          { id: "zlecenia", label: "Zlecenia", hint: "Sprzęt klientów w naprawie", href: "/serwis/zlecenia" },
          { id: "czesci", label: "Części serwisowe", hint: "Stany części i zgłoszone braki", href: "/serwis" },
          { id: "zamienniki", label: "Sprzęt zastępczy", hint: "Kto ma który egzemplarz i od ilu dni", href: "/serwis/zamienniki" },
          { id: "modele", label: "Katalog modeli", hint: "Części do naprawy danego modelu", href: "/serwis/modele" },
        ]}
      />
      ) : null}
      {/* Na tablicy zamienników te egzemplarze są w pasie „Do zrobienia” — bez drugiego komunikatu. */}
      {active !== "zamienniki" ? <ServiceOverdueLoanersNotice /> : null}
    </>
  );
}
