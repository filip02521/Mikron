import type { TeethKind, TeethManufacturer, TeethProductLine } from "./teeth-catalog-types";
import {
  VITA_AD,
  VITA_AD_BL,
  IVOSTAR_COLORS,
  WIEDENT_CLASSIC_COLORS,
  WIEDENT_ESTETIC_COLORS,
  WIEDENT_ESTETIC_OM_COLORS,
  DENTEX_AMBERLUX_COLORS,
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

const WIEDENT_ESTETIC_ANTERIOR = [
  "12", "13", "14", "15", "17", "18",
  "20", "21", "22", "23", "25", "26", "27", "28", "29",
  "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "43", "45", "47", "48", "49", "50",
] as const;

const WIEDENT_ESTETIC_ANTERIOR_LOWER = [
  "00", "03", "04", "05", "06", "07", "08", "08x", "09", "010", "011",
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
      anterior: [
        "402", "421", "431", "437", "441", "461", "471", "480", "481", "507",
        "635", "636", "637",
      ],
      posterior: ["14", "16", "33", "36", "52", "54", "55", "57"],
    },
  },
  {
    id: "wiedent_estetic",
    manufacturer: "wiedent",
    label: "Wiedent Estetic (skala W)",
    colors: WIEDENT_ESTETIC_COLORS,
    moulds: {
      anterior: [...WIEDENT_ESTETIC_ANTERIOR, ...WIEDENT_ESTETIC_ANTERIOR_LOWER],
      posterior: WIEDENT_ESTETIC_POSTERIOR,
    },
  },
  {
    id: "wiedent_estetic_vita",
    manufacturer: "wiedent",
    label: "Wiedent Estetic wg Vity",
    colors: VITA_AD,
    moulds: {
      anterior: [...WIEDENT_ESTETIC_ANTERIOR, ...WIEDENT_ESTETIC_ANTERIOR_LOWER],
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
    colors: VITA_AD,
    moulds: {
      anterior: [
        "S61", "S62", "S63", "S71", "S72", "S73", "S81", "S82", "S83",
        "B61", "B62", "B63", "B71", "B72", "B73", "B81", "B82", "B83",
        "L50", "L51", "L52", "L53",
      ],
      posterior: ["NU3", "NU5", "NU6", "NL3", "NL5", "NL6"],
    },
  },
  {
    id: "ivoclar_vivodent_dcl",
    manufacturer: "ivoclar",
    label: "Ivoclar SR Vivodent S DCL",
    colors: VITA_AD_BL,
    moulds: {
      anterior: [
        "A11", "A12", "A13", "A14", "A15", "A17",
        "A22", "A24", "A24B", "A25", "A26", "A27",
        "A32", "A36", "A41", "A42", "A44", "A54", "A56", "A66", "A68",
        "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10",
      ],
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
      posterior: ["N3", "N4", "N5", "N6"],
    },
  },
  {
    id: "major_super_lux",
    manufacturer: "major",
    label: "Major Super Lux",
    colors: VITA_AD,
    moulds: {
      anterior: [
        "0/0", "0/3", "0/4", "0/5", "0/6", "0/8", "0/10", "0/11", "0/53",
        "1/13", "1/17", "1/20", "1/22", "1/25", "1/27", "1/30", "1/32",
        "1/35", "1/37", "1/40", "1/44", "1/47", "1/48", "1/49",
        "50", "52", "53", "56", "58", "59", "62",
      ],
      posterior: ["1/60", "1/65", "1/72", "1/74", "70N", "76N", "77N", "79N"],
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
        "0", "00", "1", "01", "2", "02", "3", "03", "4", "04", "5", "05",
        "6", "7", "07", "8", "08", "9", "09", "10", "11", "12", "13", "14",
        "15", "16", "17", "18", "26", "28", "38", "41", "48",
      ],
      posterior: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"],
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
