import type { TeethKind, TeethManufacturer, TeethProductLine } from "./teeth-catalog-types";
import {
  MAJOR_SUPER_LUX_LOWER_ANTERIOR,
  MAJOR_SUPER_LUX_POSTERIOR,
  MAJOR_SUPER_LUX_UPPER_OVAL,
  MAJOR_SUPER_LUX_UPPER_SQUARE,
  MAJOR_SUPER_LUX_UPPER_TRIANGULAR,
} from "./major-super-lux-mould-shapes";
import {
  DENTEX_AMBERLUX_LOWER_ANTERIOR,
  DENTEX_AMBERLUX_POSTERIOR,
  DENTEX_AMBERLUX_UPPER_OVAL,
  DENTEX_AMBERLUX_UPPER_SQUARE,
  DENTEX_AMBERLUX_UPPER_TRIANGULAR,
} from "./dentex-amberlux-mould-shapes";
import {
  PHONARES_II_ANTERIOR,
  PHONARES_II_POSTERIOR,
} from "./ivoclar-phonares-ii-mould-shapes";
import {
  VIVODENT_DCL_ANTERIOR,
} from "./ivoclar-vivodent-dcl-mould-shapes";
import {
  ORTHOTYP_DCL_POSTERIOR,
} from "./ivoclar-orthotyp-dcl-mould-shapes";
import {
  WIEDENT_ALMAMISS_LOWER_ANTERIOR,
  WIEDENT_ALMAMISS_POSTERIOR,
  WIEDENT_ALMAMISS_UPPER_ANTERIOR,
} from "./wiedent-almamiss-mould-shapes";
import {
  WIEDENT_CLASSIC_LOWER_ANTERIOR,
  WIEDENT_CLASSIC_POSTERIOR,
  WIEDENT_CLASSIC_UPPER_ANTERIOR,
} from "./wiedent-classic-mould-shapes";
import {
  VITA_AD,
  VITA_AD_BL,
  IVOSTAR_COLORS,
  WIEDENT_ALMAMISS_COLORS,
  WIEDENT_CLASSIC_COLORS,
  WIEDENT_ESTETIC_COLORS,
  WIEDENT_ESTETIC_OM_COLORS,
  DENTEX_AMBERLUX_COLORS,
  DENTEX_V_COLORS,
  MAJOR_DENT_COLORS,
  ENIGMALIFE_COLORS,
} from "./teeth-palettes";

export type TeethLineMoulds = {
  anterior: readonly string[] | null;
  posterior: readonly string[] | null;
};

export type TeethLineDefinition = {
  id: TeethProductLine;
  manufacturer: TeethManufacturer;
  label: string;
  colors: readonly string[];
  moulds: TeethLineMoulds;
  /** Fason opcjonalny — wystarczy kolor + szczęka + typ. */
  optionalMould?: boolean;
};

const WIEDENT_ESTETIC_ANTERIOR_LOWER = [
  "00", "02", "03", "04", "05", "06", "07", "08", "08x", "09", "010", "011",
] as const;

const WIEDENT_ESTETIC_ANTERIOR_UPPER = [
  "12", "13", "14", "15", "17", "18",
  "20", "21", "22", "23", "25", "26", "27", "28", "29",
  "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "43", "45", "46", "47", "48", "49", "50",
] as const;

const WIEDENT_ESTETIC_POSTERIOR = [
  "60", "62", "65", "70", "72", "74", "76", "77", "79", "80",
] as const;

/** Mikran + pełne katalogi producentów — źródło: mikran.pl (dropdowny), wiedent.com.pl, Ivoclar. */
export const TEETH_LINE_DEFINITIONS: readonly TeethLineDefinition[] = [
  {
    id: "wiedent_classic",
    manufacturer: "wiedent",
    label: "Wiedent Classic",
    colors: WIEDENT_CLASSIC_COLORS,
    moulds: {
      anterior: [...WIEDENT_CLASSIC_UPPER_ANTERIOR, ...WIEDENT_CLASSIC_LOWER_ANTERIOR],
      posterior: WIEDENT_CLASSIC_POSTERIOR,
    },
  },
  {
    id: "wiedent_almamiss",
    manufacturer: "wiedent",
    label: "Wiedent Almamiss",
    colors: WIEDENT_ALMAMISS_COLORS,
    moulds: {
      anterior: [...WIEDENT_ALMAMISS_UPPER_ANTERIOR, ...WIEDENT_ALMAMISS_LOWER_ANTERIOR],
      posterior: WIEDENT_ALMAMISS_POSTERIOR,
    },
  },
  {
    id: "wiedent_estetic",
    manufacturer: "wiedent",
    label: "Wiedent Estetic (skala W)",
    colors: WIEDENT_ESTETIC_COLORS,
    moulds: {
      anterior: [...WIEDENT_ESTETIC_ANTERIOR_UPPER, ...WIEDENT_ESTETIC_ANTERIOR_LOWER],
      posterior: WIEDENT_ESTETIC_POSTERIOR,
    },
  },
  {
    id: "wiedent_estetic_vita",
    manufacturer: "wiedent",
    label: "Wiedent Estetic wg Vity",
    colors: VITA_AD,
    moulds: {
      anterior: [...WIEDENT_ESTETIC_ANTERIOR_UPPER, ...WIEDENT_ESTETIC_ANTERIOR_LOWER],
      posterior: WIEDENT_ESTETIC_POSTERIOR,
    },
  },
  {
    id: "wiedent_estetic_om",
    manufacturer: "wiedent",
    label: "Wiedent Estetic wybielone (OM)",
    colors: WIEDENT_ESTETIC_OM_COLORS,
    moulds: {
      anterior: ["06", "08", "010", "27", "33", "36", "38", "48"],
      posterior: WIEDENT_ESTETIC_POSTERIOR,
    },
  },
  {
    id: "ivoclar_ivostar",
    manufacturer: "ivoclar",
    label: "Ivoclar Ivostar",
    colors: IVOSTAR_COLORS,
    moulds: {
      anterior: [
        "01", "02", "03", "04", "05",
        "11", "12", "13", "14", "15", "16",
        "31", "32", "33", "34", "35",
        "41", "42", "43", "44", "45",
      ],
      posterior: null,
    },
  },
  {
    id: "ivoclar_gnathostar",
    manufacturer: "ivoclar",
    label: "Ivoclar Gnathostar",
    colors: IVOSTAR_COLORS,
    moulds: {
      anterior: null,
      posterior: ["D80", "D82", "D84", "D86", "D88"],
    },
  },
  {
    id: "ivoclar_phonares_ii",
    manufacturer: "ivoclar",
    label: "Ivoclar SR Phonares II",
    colors: VITA_AD_BL,
    moulds: {
      anterior: PHONARES_II_ANTERIOR,
      posterior: PHONARES_II_POSTERIOR,
    },
  },
  {
    id: "ivoclar_vivodent_dcl",
    manufacturer: "ivoclar",
    label: "Ivoclar SR Vivodent S DCL",
    colors: VITA_AD_BL,
    moulds: {
      anterior: VIVODENT_DCL_ANTERIOR,
      posterior: null,
    },
  },
  {
    id: "ivoclar_orthotyp_dcl",
    manufacturer: "ivoclar",
    label: "Ivoclar SR Orthotyp S DCL",
    colors: VITA_AD_BL,
    moulds: {
      anterior: null,
      posterior: ORTHOTYP_DCL_POSTERIOR,
    },
  },
  {
    id: "major_super_lux",
    manufacturer: "major",
    label: "Major Super Lux",
    colors: VITA_AD,
    moulds: {
      anterior: [
        ...MAJOR_SUPER_LUX_UPPER_TRIANGULAR,
        ...MAJOR_SUPER_LUX_UPPER_OVAL,
        ...MAJOR_SUPER_LUX_UPPER_SQUARE,
        ...MAJOR_SUPER_LUX_LOWER_ANTERIOR,
      ],
      posterior: MAJOR_SUPER_LUX_POSTERIOR,
    },
  },
  {
    id: "major_composite",
    manufacturer: "major",
    label: "Major kompozytowe",
    colors: VITA_AD,
    moulds: {
      anterior: [
        "B2", "B4", "B6", "L1", "L3", "L5", "L7",
        "M2", "M4", "M6", "M8", "S2", "S4", "S6",
      ],
      posterior: [
        "A32", "A33", "A34",
        "T11", "T13", "T14",
      ],
    },
  },
  {
    id: "major_dent",
    manufacturer: "major",
    label: "Major DENT (katalog)",
    colors: MAJOR_DENT_COLORS,
    moulds: {
      anterior: [
        "2", "5", "7A", "8A", "10", "12", "16", "17",
        "18A", "19A", "22", "24", "27A", "29A", "30A",
        "33A", "35A", "36", "37A", "38A", "39", "40A", "45A",
      ],
      posterior: null,
    },
  },
  {
    id: "dentex_amberlux",
    manufacturer: "dentex",
    label: "Dentex AmberLux",
    colors: DENTEX_AMBERLUX_COLORS,
    moulds: {
      anterior: [
        ...DENTEX_AMBERLUX_UPPER_TRIANGULAR,
        ...DENTEX_AMBERLUX_UPPER_SQUARE,
        ...DENTEX_AMBERLUX_UPPER_OVAL,
        ...DENTEX_AMBERLUX_LOWER_ANTERIOR,
      ],
      posterior: DENTEX_AMBERLUX_POSTERIOR,
    },
  },
  {
    id: "dentex_amberlux_v",
    manufacturer: "dentex",
    label: "Dentex AmberLux (skala V)",
    colors: DENTEX_V_COLORS,
    moulds: {
      anterior: [
        ...DENTEX_AMBERLUX_UPPER_TRIANGULAR,
        ...DENTEX_AMBERLUX_UPPER_SQUARE,
        ...DENTEX_AMBERLUX_UPPER_OVAL,
        ...DENTEX_AMBERLUX_LOWER_ANTERIOR,
      ],
      posterior: DENTEX_AMBERLUX_POSTERIOR,
    },
  },
  {
    id: "schottlander_enigmalife",
    manufacturer: "schottlander",
    label: "Schottlander EnigmaLife+",
    colors: ENIGMALIFE_COLORS,
    moulds: {
      anterior: [
        "D36", "D56", "D76", "D77", "D88", "D99",
        "IR4", "IR6", "IR8", "IR10",
        "IS4", "IS6", "IS8",
        "IT4", "IT6", "IT8",
        "K22", "K24B", "K25", "K27", "K41",
        "L3", "L4", "L5", "L6", "L7", "L8",
        "S11", "S12", "S13", "S14", "S15", "S17", "S66",
      ],
      posterior: ["P1", "P3", "P4", "P5", "P6", "S4", "S6", "S8"],
    },
  },
  {
    id: "hansen_generic",
    manufacturer: "hansen",
    label: "Hansen Dental",
    colors: VITA_AD,
    moulds: { anterior: null, posterior: null },
    optionalMould: true,
  },
  {
    id: "mgm_generic",
    manufacturer: "mgm",
    label: "MGM System",
    colors: VITA_AD,
    moulds: { anterior: null, posterior: null },
    optionalMould: true,
  },
  {
    id: "formed_generic",
    manufacturer: "formed",
    label: "Formed",
    colors: VITA_AD,
    moulds: { anterior: null, posterior: null },
    optionalMould: true,
  },
];

export const TEETH_LINE_BY_ID: ReadonlyMap<TeethProductLine, TeethLineDefinition> = new Map(
  TEETH_LINE_DEFINITIONS.map((d) => [d.id, d]),
);

export function teethLineDefinition(line: TeethProductLine): TeethLineDefinition {
  const def = TEETH_LINE_BY_ID.get(line);
  if (!def) throw new Error(`Unknown teeth product line: ${line}`);
  return def;
}

export function teethLinesForManufacturer(manufacturer: TeethManufacturer): TeethLineDefinition[] {
  return TEETH_LINE_DEFINITIONS.filter((d) => d.manufacturer === manufacturer);
}

export function toothMouldsForLine(line: TeethProductLine, kind: TeethKind): readonly string[] {
  const def = teethLineDefinition(line);
  return def.moulds[kind] ?? [];
}

export function teethColorsForLine(line: TeethProductLine): readonly string[] {
  return teethLineDefinition(line).colors;
}

export function hasMouldsForLineKind(line: TeethProductLine, kind: TeethKind): boolean {
  const list = toothMouldsForLine(line, kind);
  return list.length > 0;
}

export function lineHasAnyMoulds(line: TeethProductLine): boolean {
  const def = teethLineDefinition(line);
  return (
    (def.moulds.anterior != null && def.moulds.anterior.length > 0)
    || (def.moulds.posterior != null && def.moulds.posterior.length > 0)
  );
}

export function lineOptionalMould(line: TeethProductLine): boolean {
  return teethLineDefinition(line).optionalMould === true;
}

/** Linia katalogowa z osobnymi paletami fasonów dla przodów i boków. */
export function catalogLineSupportsDualKind(line: TeethProductLine): boolean {
  return hasMouldsForLineKind(line, "anterior") && hasMouldsForLineKind(line, "posterior");
}
