import type { SummaryForSomeoneEnriched } from "@/lib/orders/summary-workspace";
import type { SupplierLocation } from "@/types/database";
import { sortForSomeoneGroups } from "@/lib/orders/procurement-daily-ui";
import { compareProcurementSubmittedAt } from "@/lib/orders/procurement-request-timing";

export type ProcurementSupplierBlock = {
  supplierId: string;
  supplierName: string;
  location: SupplierLocation;
  requestGroups: SummaryForSomeoneEnriched[];
  lineCount: number;
  unseenGroupCount: number;
  hasUnseen: boolean;
  earliestSubmittedAt: string;
};

function earliestSubmittedInBlock(groups: SummaryForSomeoneEnriched[]): string {
  let earliest = groups[0]!.submittedAt;
  for (const g of groups) {
    if (compareProcurementSubmittedAt(g.submittedAt, earliest) < 0) {
      earliest = g.submittedAt;
    }
  }
  return earliest;
}

function compareSupplierBlocks(
  a: ProcurementSupplierBlock,
  b: ProcurementSupplierBlock
): number {
  if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
  const byTime = compareProcurementSubmittedAt(
    a.earliestSubmittedAt,
    b.earliestSubmittedAt
  );
  if (byTime !== 0) return byTime;
  return a.supplierName.localeCompare(b.supplierName, "pl");
}

/** Prośby handlowców — najpierw dostawca, potem grupy (osoba) wewnątrz bloku. */
export function buildProcurementSupplierBlocks(
  groups: SummaryForSomeoneEnriched[]
): ProcurementSupplierBlock[] {
  const bySupplier = new Map<string, SummaryForSomeoneEnriched[]>();
  for (const g of groups) {
    const list = bySupplier.get(g.supplierId) ?? [];
    list.push(g);
    bySupplier.set(g.supplierId, list);
  }

  const blocks: ProcurementSupplierBlock[] = [];
  for (const [supplierId, rawGroups] of bySupplier) {
    const requestGroups = sortForSomeoneGroups(rawGroups);
    const first = requestGroups[0]!;
    blocks.push({
      supplierId,
      supplierName: first.supplierName,
      location: first.location,
      requestGroups,
      lineCount: requestGroups.reduce((n, g) => n + g.lines.length, 0),
      unseenGroupCount: requestGroups.filter((g) => g.hasUnseen).length,
      hasUnseen: requestGroups.some((g) => g.hasUnseen),
      earliestSubmittedAt: earliestSubmittedInBlock(requestGroups),
    });
  }

  blocks.sort(compareSupplierBlocks);
  return blocks;
}

export function flattenProcurementSupplierBlocks(
  blocks: ProcurementSupplierBlock[]
): SummaryForSomeoneEnriched[] {
  return blocks.flatMap((b) => b.requestGroups);
}

export function procurementProductCountLabel(n: number): string {
  if (n === 1) return "1 produkt";
  if (n >= 2 && n <= 4) return `${n} produkty`;
  return `${n} produktów`;
}

export function procurementUnseenGroupsLabel(n: number): string {
  if (n === 1) return "nowa";
  if (n >= 2 && n <= 4) return "nowe";
  return "nowych";
}

/** Grupy widoczne w UI (pomija zwinięte bloki wieloosobowe u dostawcy). */
export function filterNavigableProcurementGroups(
  blocks: ProcurementSupplierBlock[],
  collapsedSupplierIds: ReadonlySet<string>
): SummaryForSomeoneEnriched[] {
  const out: SummaryForSomeoneEnriched[] = [];
  for (const block of blocks) {
    const collapsible = showProcurementSupplierBlockHeader(block);
    if (collapsible && collapsedSupplierIds.has(block.supplierId)) continue;
    out.push(...block.requestGroups);
  }
  return out;
}

/** Podpis pod nagłówkiem dostawcy (wiele osób / grup). */
export function formatProcurementSupplierBlockSummary(
  block: ProcurementSupplierBlock
): string {
  const people = block.requestGroups.map((g) => g.person);
  const groupCount = block.requestGroups.length;
  let peoplePart: string;
  if (groupCount === 1) {
    peoplePart = people[0]!;
  } else if (groupCount === 2) {
    peoplePart = people.join(" · ");
  } else if (groupCount <= 4) {
    peoplePart = people.join(", ");
  } else {
    peoplePart = `${groupCount} handlowców`;
  }

  const parts = [peoplePart, procurementProductCountLabel(block.lineCount)];
  if (groupCount >= 2) {
    parts.push(groupCount < 5 ? `${groupCount} grupy` : `${groupCount} grup`);
  }
  return parts.join(" · ");
}

/** Nagłówek bloku tylko gdy u tego dostawcy jest więcej niż jedna grupa (osoba). */
export function showProcurementSupplierBlockHeader(
  block: ProcurementSupplierBlock
): boolean {
  return block.requestGroups.length >= 2;
}

export function procurementSupplierBlockScopeKey(supplierId: string): string {
  return `prosba-block-${supplierId}`;
}

export function collectProcurementSupplierBlockOrderIds(
  block: ProcurementSupplierBlock
): string[] {
  return block.requestGroups.flatMap((g) => g.orderIds);
}

export function procurementSupplierBlockHasInfoViaPanel(
  block: ProcurementSupplierBlock
): boolean {
  return block.requestGroups.some((g) =>
    g.lines.some((l) => l.informacjaViaPanel)
  );
}

export function procurementSupplierBlockPeopleLine(
  block: ProcurementSupplierBlock
): string {
  const people = block.requestGroups.map((g) => g.person);
  if (people.length <= 3) return people.join(", ");
  return `${people.slice(0, 2).join(", ")} i ${people.length - 2} kolejnych`;
}

export function procurementSupplierBlockConfirmCopy(
  block: ProcurementSupplierBlock,
  mode: "GLOWNE" | "POBOCZNE"
): { title: string; message: string; confirmLabel: string; people: string[] } {
  const groupCount = block.requestGroups.length;
  const products = procurementProductCountLabel(block.lineCount);
  const action =
    mode === "GLOWNE" ? "zamówienie główne" : "uzupełniające";
  const people = block.requestGroups.map((g) => g.person);
  return {
    title:
      mode === "GLOWNE"
        ? `Główne u ${block.supplierName}`
        : `Uzupełniające u ${block.supplierName}`,
    message: `Oznaczysz ${groupCount} ${
      groupCount === 1 ? "prośbę" : groupCount < 5 ? "prośby" : "prośb"
    } (${products}) jako ${action}: ${procurementSupplierBlockPeopleLine(block)}. Po potwierdzeniu możesz cofnąć w ciągu 5 sekund.`,
    confirmLabel:
      mode === "GLOWNE"
        ? `Główne · ${groupCount} ${groupCount === 1 ? "osoba" : groupCount < 5 ? "osoby" : "osób"}`
        : `Uzupełniające · ${groupCount} ${groupCount === 1 ? "osoba" : groupCount < 5 ? "osoby" : "osób"}`,
    people,
  };
}
