import type { TeethProductLine } from "./teeth-catalog-types";

export type PatternId =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"
  | "K" | "L" | "M" | "N" | "O" | "P" | "Q";

const UNIVERSAL_PATTERNS: PatternId[] = ["A", "B", "D", "F", "G", "H", "I", "J", "K", "L", "M", "O", "Q"];

export function selectPatternsForLine(productLine: TeethProductLine): PatternId[] {
  const patterns = [...UNIVERSAL_PATTERNS];

  if (productLine === "major_super_lux") {
    patterns.push("C", "E");
  }

  if (productLine === "ivoclar_ivostar") {
    patterns.push("N", "P");
  }

  if (productLine === "ivoclar_gnathostar") {
    patterns.push("P");
  }

  return patterns;
}

const UNIVERSAL_HINTS = `
### SKREŚLENIA I POPRAWKI:
- Jeśli pozycja jest skreślona (przekreślona linią) — POMIŃ ją całkowicie.
- Jeśli pozycja jest poprawiona (skreślona i nadpisana) — odczytaj OSTATECZNĄ wersję (nadpisaną).
- Ignoruj przedrukowany tekst (nagłówki tabel, logo, instrukcje) — odczytuj tylko ODRĘCZNE wpisy.

### SPACJE W KODACH FASONÓW:
Klienci mogą zapisywać fasony ze spacjami: "0 / 8" = "0/8", "D 84" = "D84", "1 / 60" = "1/60".
Usuń spacje wewnątrz kodu fasonu przed dopasowaniem do katalogu.
ALE nie usuwaj spacji między fasonem a mnożnikiem: "0/8 x2" → fason "0/8", count=2 (spacja przed "x" jest poprawna).

### ROZRÓŻNIENIE PO KOLORZE (KRYTYCZNE):
Niektóre fasony występują w wielu liniach produktów. Rozróżnij pozycje po KOLORZE:
- Odczytuj TYLKO pozycje których kolor jest w palecie TEJ linii.
- Jeśli pozycja ma kolor spoza palety tej linii — pomiń (to inna linia).
- Jeśli kolor jest wspólny (np. "A2" jest w VITA i w skali W) — użyj kontekstu (sąsiednie pozycje, sekcja).

### UWAGA: ODCZYTUJ TYLKO ZĘBY Z TEJ LINII:
Na kartce mogą być zęby z innych linii produktów. Ignoruj je — odczytuj TYLKO pozycje należące do tej linii.
Jeśli widzisz fason/kolor którego nie ma w katalogu tej linii — pomiń (to prawdopodobnie inna linia).
`;

export function lineSpecificHints(productLine: TeethProductLine): string {
  const hints = LINE_HINTS[productLine];
  if (!hints) return UNIVERSAL_HINTS;
  return `${UNIVERSAL_HINTS}\n${hints}`;
}

const LINE_HINTS: Record<TeethProductLine, string> = {
  wiedent_classic: `
### Wiedent Classic — wskazówki specyficzne:
- Kolory: A1, A2, A3, A3.5, A4, B2, C2, C3, D3 (mniejsza paleta niż VITA — nie ma B1, B3, B4, C1, C4, D2, D4).
- Przody górne: 402, 421, 431, 437, 441, 461, 471, 480, 481, 507 (3-cyfrowe).
- Przody dolne: 635, 636, 637, 733 (3-cyfrowe).
- Boki: 14, 16, 33, 36, 52, 54, 55, 57 (2-cyfrowe).
- Rozróżnienie od Almamiss: Classic ma 4xx/5xx/6xx/7xx, Almamiss ma 2xx/3xx/4xx/6xx/7xx.
- "A3,5" bywa z przecinkiem zamiast kropki — znormalizuj do "A3.5".
`,

  wiedent_almamiss: `
### Wiedent Almamiss — wskazówki specyficzne:
- Kolory: VITA (A1-D4) + OM1, OM3, 0M1, 0M3.
- UWAGA: "OM1" (litera O) i "0M1" (zero) to DWA RÓŻNE kolory — sprawdź uważnie czy to litera "O" czy cyfra "0".
  Jeśli nie pewien — spróbuj obu, domyślnie litera "O" (OM1).
- Przody górne: 210, 220, 250, 270, 271, 273, 320, 322, 330, 350-358, 370-373, 400, 401, 412, 413, 415.
- Przody dolne: 104, 106, 108, 110, 111.
- Boki: 650, 700, 760, 780, 790 (3-cyfrowe).
- Rozróżnienie od Classic: Almamiss ma 2xx/3xx, Classic nie ma. Almamiss ma kolory OM, Classic nie ma.
`,

  wiedent_estetic: `
### Wiedent Estetic (skala W) — wskazówki specyficzne:
- Kolory: A1, A2, B2, B3 + G1, G2, G3, N2, N3, N5, R1, R3, R5 (skala W, bez prefiksa).
- Przody górne: 12-50 (2-cyfrowe, bez prefiksu).
- Przody dolne: 00, 02, 03, 04, 05, 06, 07, 08, 08x, 09, 010, 011.
- Boki: 60, 62, 65, 70, 72, 74, 76, 77, 79, 80 (2-cyfrowe, strzałki ↑/↓).

### FASON "08x" — x W NAZWIE (KRYTYCZNE):
"08x" jest ODRĘBNYM fasonem od "08". "x" doklejone bez spacji = część nazwy fasonu, NIE mnożnik.
"08x" = fason "08x", count=1. "08x x2" = fason "08x", count=2. "08 x2" = fason "08", count=2.

### FASONY Z WIODĄCYM ZEREM (KRYTYCZNE):
"010" jest prawidłowym fasonem (dolne przody). "10" NIE istnieje w katalogu.
Nie ucinaj wiodącego zero! Sprawdź dokładnie liczbę cyfr:
- "010" = 3 cyfry = fason "010" (dolne)
- "10" = 2 cyfry = nie istnieje w katalogu — pomiń
- "011" = 3 cyfry = fason "011" (dolne)
- "11" = 2 cyfry = nie istnieje w katalogu — pomiń
`,

  wiedent_estetic_vita: `
### Wiedent Estetic wg Vity — wskazówki specyficzne:
- Kolory: pełna VITA A1-D4 (A1, A2, A3, A3.5, A4, B1, B2, B3, B4, C1, C2, C3, C4, D2, D3, D4).
- Fasony IDENTYCZNE jak Estetic (skala W), różnica TYLKO w kolorach.
- "A3.5" bywa z przecinkiem "A3,5" — znormalizuj do "A3.5".
- Przody górne: 12-50 (2-cyfrowe). Przody dolne: 00, 02-09, 08x, 010, 011.
- Boki: 60, 62, 65, 70, 72, 74, 76, 77, 79, 80.

### FASON "08x" — x W NAZWIE (KRYTYCZNE):
"08x" jest ODRĘBNYM fasonem od "08". "x" doklejone bez spacji = część nazwy fasonu, NIE mnożnik.

### FASONY Z WIODĄCYM ZEREM (KRYTYCZNE):
"010" jest prawidłowym fasonem (dolne przody). "10" NIE istnieje w katalogu.
Nie ucinaj wiodącego zero!
`,

  wiedent_estetic_om: `
### Wiedent Estetic wybielone (OM) — wskazówki specyficzne:
- Kolory: OM1, OM3, 0M1, 0M3 (TYLKO te 4 kolory).
- UWAGA: "OM1" (litera O) i "0M1" (zero) to DWA RÓŻNE kolory — sprawdź uważnie.
- Przody: 06, 08, 010, 27, 33, 36, 38, 48 (ograniczony zestaw).
- Boki: 60, 62, 65, 70, 72, 74, 76, 77, 79, 80.

### FASONY Z WIODĄCYM ZEREM (KRYTYCZNE):
"010" jest prawidłowym fasonem (dolne przody). "10" NIE istnieje w katalogu.
Nie ucinaj wiodącego zero!
`,

  ivoclar_ivostar: `
### Ivoclar Ivostar — wskazówki specyficzne:
- Kolory: VITA (A1-D4) + BL1-BL4 + Chromascop (XXX/YY). Klienci piszą sufiks-only ("1c" → "140/1C").
- Przody: 01-05, 11-16, 31-35, 41-45 (2-cyfrowe, bez strzałek).
- NIE MA boków — boki to Gnathostar (odrębna linia). Jeśli widzisz "D80-D88" lub "80-88" — POMIŃ (to Gnathostar).

### KOLOR "01" vs FASON "01" (KRYTYCZNE):
"01" może być:
- KOLOR Chromascop (skrót od "110/01") — gdy występuje jako nagłówek/początek wiersza
- FASON przedni (01) — gdy występuje w pozycji fasonu po kolorze
Kontekst decyduje: kolor na początku, fason po kolorze.
Jeśli "01" jest pierwszy w wierszu i po nim są inne kody → to KOLOR.
Jeśli "01" występuje po ustanowionym kolorze → to FASON.
`,

  ivoclar_gnathostar: `
### Ivoclar Gnathostar — wskazówki specyficzne:
- Kolory: identyczne jak Ivostar (VITA + BL + Chromascop).
- Boki: D80, D82, D84, D86, D88. Klienci ZAWSZE piszą bez "D" ("84" → "D84").
- NIE MA przodów — przody to Ivostar. Jeśli widzisz fasony 2-cyfrowe (01-45) — POMIŃ (to Ivostar).

### "80" vs "D80" — KONTEKST:
"80" na kartce = D80 (klienci pomijają "D"). ALE "80" jest też fasonem Wiedent Estetic.
Rozróżnij po kolorze: Gnathostar używa VITA/Chromascop, Wiedent Estetic używa skali W (G/N/R).
Jeśli "80" jest w sekcji z kolorami G/N/R → POMIŃ (to Wiedent Estetic).
`,

  ivoclar_phonares_ii: `
### Ivoclar SR Phonares II — wskazówki specyficzne:
- Kolory: VITA (A1-D4) + BL1-BL4.
- Przody Soft (S*): S61-S83. Przody Bold (B*): B61-B83. Przody dolne (L*): L50-L55.
- Przody NIE MAJĄ pola szczęki — jaw ZAWSZE null (S/B=górne, L=dolne).
- Boki Typ: NU3, NU5, NU6 (upper), NL3, NL5, NL6 (lower).
- Boki Lingual: LU3, LU5, LU6 (upper), LL3, LL5, LL6 (lower).

### FASONY S*/B*/L* vs CYFRY (KRYTYCZNE):
- "S" (Soft) vs "5" — S61 nie jest "561"
- "B" (Bold) vs "8" — B61 nie jest "861"
- "L" (Lower) vs "1" — L50 nie jest "150"
Sprawdź czy pierwszy znak jest literą. Dopasuj do katalogu.

### BOKI TYPU — FORMAT "NU3" NIE "N3U" (KRYTYCZNE):
Boki Typ w tej linii: NU3, NU5, NU6 (górne), NL3, NL5, NL6 (dolne).
Format: N + U/L + cyfra. Przykład: "NU3" = N(atural) + U(pper) + 3.
NIE pomyl z formatem "N3U" (to jest Orthotyp — inna linia).

### BOKI LINGUAL — IDENTYCZNE Z ORTHOTYP (KRYTYCZNE):
Fasony Lingual (LU3, LU5, LU6, LL3, LL5, LL6) występują w DWÓCH liniach: Phonares II i Orthotyp DCL.
Rozróżnij po kontekście:
- Jeśli w tej samej sekcji są fasony "S*", "B*", "L5*" (przody Phonares) → to Phonares II.
- Jeśli w tej samej sekcji są fasony "N*U", "N*L" (boki Typ Orthotyp) → to Orthotyp DCL.
`,

  ivoclar_vivodent_dcl: `
### Ivoclar SR Vivodent S DCL — wskazówki specyficzne:
- Kolory: VITA (A1-D4) + BL1-BL4.
- Przody górne trójkątne: A11, A12, A13, A14, A15, A17.
- Przody górne owalne: A22, A24, A24B, A25, A26, A27, A32, A36.
- Przody górne kwadratowe: A41, A42, A44, A54, A56, A66, A68.
- Przody dolne: A3, A4, A5, A6, A7, A8, A9, A10.
- NIE MA boków — boki to Orthotyp DCL.

### FASONY "A*" — JEDEN TOKEN, NIE ROZBIJAJ (KRYTYCZNE):
Fasony górne przednie zaczynają się od "A" + 2-3 znaki: A11, A12, A13, A14, A15, A17, A22, A24, A24B, A25, A26, A27, A32, A36, A41, A42, A44, A54, A56, A66, A68.
To są POJEDYNCZE kody fasonów — NIE rozbijaj "A11" na kolor "A1" + ilość "1".
"A22" to NIE jest kolor "A2" × 2 — to fason "A22".
"A24B" to NIE jest kolor "A2" + fason "4B" — to fason "A24B" (z sufiksem B).
Kolor jest USTALONY z nagłówka sekcji lub początku wiersza — fasony "A*" są w pozycji fasonu.

### "A3" KOLOR vs FASON (KRYTYCZNE):
"A3" może być:
- KOLOR VITA — gdy występuje jako nagłówek/początek wiersza
- FASON dolny przedni (A3) — gdy występuje w pozycji fasonu po kolorze
Kontekst decyduje: kolor na początku, fason po kolorze.
`,

  ivoclar_orthotyp_dcl: `
### Ivoclar SR Orthotyp S DCL — wskazówki specyficzne:
- Kolory: VITA (A1-D4) + BL1-BL4 (identyczne jak Vivodent).
- Boki Typ: N3U, N4U, N5U, N6U (upper), N3L, N4L, N5L, N6L (lower).
- Boki Lingual: LU3, LU5, LU6 (upper), LL3, LL5, LL6 (lower).
- Kody legacy: N3, N4, N5, N6 (bez sufiksu → upper/górne).
- NIE MA przodów — przody to Vivodent DCL.

### BOKI TYPU — FORMAT "N3U" NIE "NU3" (KRYTYCZNE):
Boki Typ w tej linii: N3U, N4U, N5U, N6U (górne), N3L, N4L, N5L, N6L (dolne).
Format: N + cyfra + U/L. Przykład: "N3U" = N(atural) + 3 + U(pper).
NIE pomyl z formatem "NU3" (to jest Phonares — inna linia).
Kody legacy bez sufiksu: N3, N4, N5, N6 → traktuj jako upper (górne).

### BOKI LINGUAL — IDENTYCZNE Z PHONARES (KRYTYCZNE):
Fasony Lingual (LU3, LU5, LU6, LL3, LL5, LL6) występują w DWÓCH liniach: Phonares II i Orthotyp DCL.
Rozróżnij po kontekście:
- Jeśli w tej samej sekcji są fasony "N*U", "N*L" (boki Typ Orthotyp) → to Orthotyp DCL.
- Jeśli w tej samej sekcji są fasony "S*", "B*", "L5*" (przody Phonares) → to Phonares II.
`,

  major_super_lux: `
### Major Super Lux — wskazówki specyficzne:
- Kolory: pełna VITA A1-D4.
- Przody dolne: 0/3, 0/4, 0/0, 0/5, 0/6, 0/53, 0/8, 0/10, 0/11 (z prefiksem "0/").
- Przody górne: 50, 1/44, 1/13, 1/47, 1/17, 1/40, 1/49, 1/30, 56, 58, 52, 1/48, 1/37, 59, 1/20, 1/32, 1/35, 1/22, 1/25, 53, 1/27, 62 (mieszane z "1/" i bez).
- Boki L-cusp: 1/60, 1/72, 1/65, 1/74.
- Boki N-cusp: 70N, 76N, 77N, 79N (klienci pomijają "N" → "76" = "76N").

### FASON "0/0" (KRYTYCZNE):
"0/0" jest PRAWIDŁOWYM fasonem (dolne przody). Nie traktuj go jako błędu.
Format "0/[numer]" = dolne przody. "0/0" = fason "0/0", NIE puste.

### PREFIKS "1/" PRZY BOKACH — NIE GUB GO (KRYTYCZNE):
Boki L-cusp: 1/60, 1/72, 1/65, 1/74. Prefiks "1/" jest OBOWIĄZKOWY — bez niego to fasony innej linii.
"1/60" to NIE jest "60" — to "1/60". Zawsze zachowaj prefiks "1/".
Bez prefiksu "1/" liczby 60, 65, 72, 74 NIE istnieją w katalogu Major Super Lux.

### N-CUSP — TYLKO FASONY Z "N" W KATALOGU:
Fasony N-cusp w tej linii: 70N, 76N, 77N, 79N.
Jeśli widzisz "76" bez "N" na kartce — sprawdź kontekst:
- Jeśli w sekcji z kolorami VITA i innymi fasonami z "N" → to "76N" (klienci pomijają "N").
- Jeśli w sekcji z kolorami skali W (G/N/R) → to "76" z Wiedent Estetic, POMIŃ.
`,

  major_composite: `
### Major kompozytowe — wskazówki specyficzne:
- Kolory: pełna VITA A1-D4.
- Przody: B2, B4, B6, L1, L3, L5, L7, M2, M4, M6, M8, S2, S4, S6.
- Boki: A32, A33, A34, T11, T13, T14.

### FASONY B2/B4 vs KOLORY VITA B2/B4 (KRYTYCZNE):
"B2" i "B4" są zarówno fasonami PRZEDNIMI jak i kolorami VITA.
Kontekst rozstrzyga:
- Jeśli "B2" jest nagłówkiem sekcji/początkiem wiersza → to KOLOR.
- Jeśli "B2" występuje po ustanowionym kolorze → to FASON.
Przykład: "B2 B4x3" = kolor B2, fason B4, count=3.
`,

  major_dent: `
### Major DENT — wskazówki specyficzne:
- Kolory: VITA (A1-D4) + 2C, 2D, 2E, 2N, 2P, 3D, 3M, 3N, 3P, 3R.
- Przody: 2, 5, 7A, 8A, 10, 12, 16, 17, 18A, 19A, 22, 24, 27A, 29A, 30A, 33A, 35A, 36, 37A, 38A, 39, 40A, 45A.
- NIE MA boków (posterior=null).

### FASONY Z SUFIKSEM "A" (KRYTYCZNE):
Fasony: 7A, 8A, 18A, 19A, 27A, 29A, 30A, 33A, 35A, 37A, 38A, 40A, 45A.
"A" na końcu jest CZĘŚCIĄ NAZWY fasonu, NIE kolorem VITA.
"7A" to fason "7A", NIE fason "7" + kolor "A".
"18A" to fason "18A", NIE fason "18" + kolor "A".
`,

  dentex_amberlux: `
### Dentex AmberLux — wskazówki specyficzne:
- Kolory: A1, A2, B2, B3, C3, D3, D4 + G1, G2, N2, N3, R1, R2, R5.
- Przody: 0-48 (1-2 cyfrowe). UWAGA: "0" to prawidłowy fason. "00" ≠ "0".
- Boki: I, II, III, IV, V, VI, VII, VIII, X (rzymskie, brak IX).

### FASONY RZYMSKIE vs MNOŻNIK "x" (KRYTYCZNE):
Boki to liczby rzymskie: I, II, III, IV, V, VI, VII, VIII, X.
ALE "x" (małe) oznacza też mnożnik ilości ("x2", "x3"). Konflikty:
- "X" (samo, wielkie) = fason "X", count=1. NIE czytaj jako mnożnik.
- "X x2" = fason "X", count=2.
- "V x3" = fason "V", count=3. NIE czytaj "V" jako rzymską 5.
- "I" = fason "I", count=1. NIE czytaj jako rzymskiej 1 = count.
- "III x2" = fason "III", count=2.
Reguła: WIELKIE litery rzymskie (I, V, X) w pozycji fasonu = FASON. Małe "x" przed liczbą = MNOŻNIK.

### FASONY 1-CYFROWE vs ILOŚĆ (KRYTYCZNE):
Fasony przednie zawierają liczby 1-cyfrowe: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9.
Samo "5" w pozycji fasonu = fason "5" (górne owalne), count=1.
"5 x3" = fason "5", count=3 (NIE count=5).
Rozróżnienie: fason jest w pozycji fasonu (po kolorze), ilość po "x".
Jeśli liczba występuje po kolorze i nie ma "x" → to fason, count=1.
`,

  dentex_amberlux_v: `
### Dentex AmberLux (skala V) — wskazówki specyficzne:
- Kolory: z sufiksem "V" (A1V, A2V, B2V, B3V, C3V, D3V, D4V, G1V, G2V, N2V, N3V, R1V, R2V, R5V). Klienci piszą "A2V" lub "A2 V".
- Fasony identyczne jak AmberLux.
- Przody: 0-48 (1-2 cyfrowe). "0" to prawidłowy fason. "00" ≠ "0".
- Boki: I, II, III, IV, V, VI, VII, VIII, X (rzymskie).

### FASONY RZYMSKIE vs MNOŻNIK "x" (KRYTYCZNE):
Boki to liczby rzymskie: I, II, III, IV, V, VI, VII, VIII, X.
WIELKIE litery rzymskie w pozycji fasonu = FASON. Małe "x" przed liczbą = MNOŻNIK.
"X" (samo) = fason "X", count=1. "V x3" = fason "V", count=3.

### FASONY 1-CYFROWE vs ILOŚĆ (KRYTYCZNE):
Samo "5" w pozycji fasonu = fason "5", count=1. "5 x3" = fason "5", count=3.

### KOLORY Z SUFIKSEM "V":
Klienci mogą zapisywać "A2 V" zamiast "A2V" — złącz w jeden token "A2V".
`,

  schottlander_enigmalife: `
### Schottlander EnigmaLife+ — wskazówki specyficzne:
- Kolory: VITA (A1-D4) + BL2, BL3.
- Przody: D36, D56, D76, D77, D88, D99, IR4, IR6, IR8, IR10, IS4, IS6, IS8, IT4, IT6, IT8, K22, K24B, K25, K27, K41, L3, L4, L5, L6, L7, L8, S11, S12, S13, S14, S15, S17, S66.
- Boki: P1, P3, P4, P5, P6, S4, S6, S8.

### LITERY vs CYFRY (KRYTYCZNE):
- "I" vs "1" — IR4 nie jest "1R4"
- "L" vs "1" — L3 nie jest "13"
- "S" vs "5" — S11 nie jest "511"
- "D" vs "0" — D36 nie jest "036"
Sprawdź czy pierwszy znak jest literą. Dopasuj do katalogu.

### FASON "K24B" — SUFIKS "B" (KRYTYCZNE):
"K24B" jest prawidłowym fasonem (z sufiksem "B"). NIE pomijaj "B" — "K24" nie istnieje w katalogu.
NIE interpretuj "B" jako koloru VITA — to część nazwy fasonu.
`,

  hansen_generic: `
### Hansen Dental — wskazówki specyficzne:
- Kolory: VITA (A1-D4). Fasony: BRAK (mould=null). Tylko kolor + kind + szczęka.
- Ustaw mould=null zawsze. kind i jaw zależą od wpisu na kartce.
`,

  mgm_generic: `
### MGM System — wskazówki specyficzne:
- Kolory: VITA (A1-D4). Fasony: BRAK (mould=null). Tylko kolor + kind + szczęka.
- Ustaw mould=null zawsze. kind i jaw zależą od wpisu na kartce.
`,

  formed_generic: `
### Formed — wskazówki specyficzne:
- Kolory: VITA (A1-D4). Fasony: BRAK (mould=null). Tylko kolor + kind + szczęka.
- Ustaw mould=null zawsze. kind i jaw zależą od wpisu na kartce.
`,
};
