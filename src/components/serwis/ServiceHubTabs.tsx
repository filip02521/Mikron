import { SectionTabNav } from "@/components/ui/SectionTabNav";

export type ServiceHubTab = "czesci" | "zamienniki";

/** Hub serwisu: jedna pozycja menu, widoki jako zakładki (DESIGN.md → Navigation). */
export function ServiceHubTabs({ active }: { active: ServiceHubTab }) {
  return (
    <SectionTabNav
      embedded
      activeTab={active}
      ariaLabel="Widoki serwisu"
      tabs={[
        { id: "czesci", label: "Części serwisowe", hint: "Stany części i zgłoszone braki", href: "/serwis" },
        { id: "zamienniki", label: "Sprzęt zastępczy", hint: "Kto ma który egzemplarz i od ilu dni", href: "/serwis/zamienniki" },
      ]}
    />
  );
}
