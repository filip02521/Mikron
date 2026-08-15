"use client";

import {
  formatIndividualSalesPeopleShort,
  type ZdEstimateIndividualTwExtra,
} from "@/lib/orders/zd-estimate-individual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { zdEstimateProsbaWord } from "@/lib/orders/zd-estimate-ui-copy";
import { ZdEstimateStatusBadge } from "@/components/zakupy/ZdEstimateStatusBadge";

/** Badge prośby w kolumnie Status — 1 linia; osoby / polityka w title. */
export function ZdEstimateIndividualMetaBadge({
  extra,
  extrasPolicy = "sum",
  doZdSuppressed = false,
}: {
  extra: ZdEstimateIndividualTwExtra;
  extrasPolicy?: "sum" | "max";
  doZdSuppressed?: boolean;
}) {
  const people = formatIndividualSalesPeopleShort(extra.requests);
  const policyBit =
    extrasPolicy === "max"
      ? "Polityka: max(niedobór, prośba) — bez dublowania gdy prośba pokrywa niedobór."
      : "Polityka: suma (niedobór + prośba) — rezerwa na wierzchu.";
  const inclusionBit = doZdSuppressed
    ? "Rezerwa NIE jest w aktualnym „Do ZD” (nadpisanie albo wykluczenie)."
    : `Rezerwa ${formatQty(extra.extraPieces)} szt jest już wliczona w kolumnę „Do ZD” (przed zaokrągleniem opakowania).`;
  const title = [
    inclusionBit,
    policyBit,
    ...extra.requests.map((r) => {
      const bits = [
        r.salesPersonName,
        `${formatQty(r.qty)} szt`,
        r.symbol || r.products,
        r.requestNote,
      ].filter(Boolean);
      return bits.join(" · ");
    }),
  ].join("\n");

  const meta = doZdSuppressed
    ? "nie w Do ZD"
    : extrasPolicy === "max"
      ? "maks. vs niedobór"
      : `${formatQty(extra.extraPieces)} szt`;

  const peopleHint =
    people +
    (extra.requests.length > 1
      ? ` · ${extra.requests.length} ${zdEstimateProsbaWord(extra.requests.length)}`
      : "");

  return (
    <ZdEstimateStatusBadge
      kind="Prośba"
      meta={meta}
      tone={doZdSuppressed ? "amber" : "emerald"}
      title={[title, peopleHint].filter(Boolean).join("\n")}
    />
  );
}
