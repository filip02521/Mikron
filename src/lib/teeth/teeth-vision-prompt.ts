import {
  TEETH_LINE_DEFINITIONS,
  teethColorsForLine,
  toothMouldsForLine,
  hasMouldsForLineKind,
  lineOptionalMould,
} from "./teeth-lines-data";
import { jawRequiredForKind } from "./teeth-mould-shape-groups";
import {
  teethProductLineLabel,
  isTeethProductLine,
  type TeethCatalogRef,
  type TeethProductLine,
  type TeethKind,
} from "./teeth-catalog";

/** Buduje prompt dla Gemini z WSZYSTKIMI liniami produktów — AI sam rozpoznaje linię. */
export function buildTeethVisionPrompt(catalog?: TeethCatalogRef): string {
  const lines = catalog
    ? TEETH_LINE_DEFINITIONS.filter((d) => d.id === catalog.productLine)
    : TEETH_LINE_DEFINITIONS;

  const parts: string[] = [];

  parts.push(
    `Jesteś asystentem odczytującym pozycje zębów ze zdjęcia odręcznie wypełnionej kartki.`,
  );

  if (catalog) {
    const lineLabel = teethProductLineLabel(catalog.productLine) ?? catalog.productLine;
    parts.push(`Linia produktu: ${lineLabel}.`);
    parts.push(`Rozpoznaj tylko zęby z tej linii.`);
  } else {
    parts.push(
      `Na zdjęciu mogą być zęby z różnych linii produktów. Rozpoznaj linię dla każdej pozycji.`,
    );
  }

  parts.push(`\n## Dostępne linie produktów i ich katalogi:`);

  for (const def of lines) {
    const colors = def.colors;
    const anteriorMoulds = def.moulds.anterior;
    const posteriorMoulds = def.moulds.posterior;
    const anteriorHasMoulds = anteriorMoulds != null && anteriorMoulds.length > 0;
    const posteriorHasMoulds = posteriorMoulds != null && posteriorMoulds.length > 0;
    const mouldOptional = def.optionalMould === true;

    parts.push(`\n### ${def.label} (productLine: "${def.id}")`);
    parts.push(`Kolory: ${colors.length > 0 ? colors.join(", ") : "(brak)"}`);

    if (anteriorHasMoulds) {
      parts.push(`Fasony przednie (anterior): ${anteriorMoulds!.join(", ")}`);
    } else {
      parts.push(`Fasony przednie: (brak — ustaw mould=null dla anterior)`);
    }

    if (posteriorHasMoulds) {
      parts.push(`Fasony boczne (posterior): ${posteriorMoulds!.join(", ")}`);
    } else {
      parts.push(`Fasony boczne: (brak — ustaw mould=null dla posterior)`);
    }

    if (mouldOptional) {
      parts.push(`Fason opcjonalny dla tej linii.`);
    }
  }

  parts.push(`\n## Typowe wzorce zapisu na kartkach zamówień:`);
  parts.push(`Klienci zapisują zamówienia ręcznie na różne sposoby. Poniżej opisane są najczęstsze wzorce — rozpoznaj, który wzorzec występuje na zdjęciu i zastosuj go konsekwentnie dla całej kartki lub sekcji.`);
  parts.push(`\n**A. Nagłówek koloru dla sekcji.** Kolor (np. "A2", "A3", "B2") bywa zapisany jako nagłówek nad blokiem pozycji i obowiązuje dla WSZYSTKICH linii poniżej, aż do napotkania kolejnego nagłówka koloru. Może być kilka kolumn obok siebie należących do tego samego nagłówka koloru.`);
  parts.push(`\n**B. Format linii pozycji.** Zwykle to "FASON x ILOŚĆ" lub "FASON × ILOŚĆ" (znak "x"/"×" przed liczbą sztuk na końcu linii). Czasem separatorem jest myślnik "-" zamiast "x". Ilość zawsze jest liczbą na końcu linii.`);
  parts.push(`\n**C. Prefiks "0/" i "1/" przy fasonie.** W niektórych liniach (np. Major Super Lux) fasony przednie dolne mają prefiks "0/" (np. "0/8" = fason "0/8", ZĄB PRZEDNI DOLNY, jaw=null), a niektóre fasony przednie górne i boczne mają prefiks "1/" (np. "1/40" = fason przedni górny, "1/60" = fason boczny). Prefiks sam w sobie NIE decyduje jednoznacznie o kind — zawsze dopasuj DOKŁADNY zapis fasonu (z prefiksem) do listy fasonów przednich/bocznych danej linii podanej wyżej i na tej podstawie ustal kind.`);
  parts.push(`\n**D. Sam numer bez prefiksu.** Niektóre fasony (przednie i boczne) w danej linii nie mają żadnego prefiksu — to normalne, dopasuj numer do właściwej listy (przedniej lub bocznej) dla tej linii.`);
  parts.push(`\n**E. Fasony boczne "N-cusp" — klienci często pomijają literę "N".** Jeśli fason boczny w katalogu kończy się na "N" (np. "70N", "76N", "77N", "79N"), klienci czasem zapisują go bez tej litery (samo "70", "76" itd.). Jeśli widzisz sam numer ze strzałką, a w katalogu bocznym dla tej linii istnieje odpowiadający fason z "N" na końcu — zwróć PEŁNY fason z katalogu (z literą "N"), nie sam numer.`);
  parts.push(`\n**F. Strzałki ↑ / ↓ przy fasonie — szczęka zębów bocznych.** Jeśli obok numeru fasonu bocznego jest strzałka w górę (↑) — jaw="upper" (górna szczęka). Strzałka w dół (↓) — jaw="lower" (dolna szczęka). Jeśli występują OBIE strzałki przy jednym fasonie (np. "76↑↓", ale też "76↑ i ↓" — słowo "i" [polskie "and"] między dwiema strzałkami ma DOKŁADNIE TO SAMO znaczenie co złączone strzałki bez spacji) — utwórz DWIE oddzielne pozycje w wyniku: jedną z jaw="upper" i jedną z jaw="lower", każdą z tą samą podaną ilością (chyba że dwie różne ilości są jawnie podane osobno dla góry i dołu, np. "80↑x1, 80↓x2" — wtedy dwie pozycje z RÓŻNYMI ilościami).`);
  parts.push(`\n**G. Inne warianty.** Kolor może też być zapisany na początku każdej linii zamiast jako nagłówek sekcji (np. "A2 12x3"). Rozpoznaj taki wzorzec jeśli nagłówka sekcji brak.`);
  parts.push(`\n**H. Słowne określenie typu i szczęki (zamiast prefiksów/strzałek).** Klienci czasem piszą wprost słowami zamiast używać prefiksów czy strzałek: słowo "przody"/"przednie" oznacza kind="anterior" (jaw=null), a słowo "boki"/"boczne"/"tylne" oznacza kind="posterior". Szczęka dla zębów bocznych bywa opisana słownie: "góra" = jaw="upper", "dół" = jaw="lower", a "góra+dół" (lub "góra i dół", "obie") oznacza OBIE szczęki — utwórz wtedy DWIE oddzielne pozycje (upper i lower) dla każdego wymienionego fasonu, z tą samą ilością.`);
  parts.push(`\n**I. Globalna ilość dla całej kartki/sekcji.** Czasem ilość nie jest podana przy każdej pozycji osobno, tylko RAZ na końcu jako zdanie obowiązujące dla wszystkich wymienionych wcześniej fasonów, np. "wszystko po 1 opakowaniu" lub "wszystko po 2 szt.". W takim wypadku zastosuj tę samą wartość count do KAŻDEJ pozycji wymienionej w tej sekcji/kartce, która nie ma własnej, jawnie podanej ilości.`);
  parts.push(`\n**J. Tabela z nagłówkami kolumn określającymi kind/jaw.** Kartka bywa zorganizowana jako tabela z 4 kolumnami nagłówkowymi typu "GÓRA PRZÓD", "DÓŁ PRZÓD", "GÓRA BOK", "DÓŁ BOK" (lub podobnie: "PRZODY GÓRA/DÓŁ", "BOKI GÓRA/DÓŁ"). Nagłówek obowiązuje dla WSZYSTKICH fasonów wypisanych w tej kolumnie poniżej, aż do końca tabeli. Interpretacja: kolumny "PRZÓD"/"PRZODY" → kind="anterior", jaw=null ZAWSZE (słowo "góra"/"dół" w nagłówku kolumny przedniej NIE wpływa na pole jaw — górna/dolna szczęka przednia wynika z SAMEGO FASONU/prefiksu, patrz reguła C, a nie z jaw). Kolumny "BOK"/"BOKI" → kind="posterior", a słowo "góra"/"dół" w nagłówku tej kolumny ustala jaw="upper"/"lower" wprost.`);
  parts.push(`\n**K. Kilka kolorów dla jednej tabeli/listy.** Jeśli po lewej stronie przed tabelą lub listą wypisano kilka kolorów naraz (np. "A2" i "A3" połączone klamrą/nawiasem lub napisane jedno pod drugim bez osobnych list ilości), oznacza to, że CAŁA tabela/lista fasonów i ilości poniżej dotyczy KAŻDEGO z tych kolorów z osobna. Wygeneruj powtórzone pozycje (te same fasony, te same ilości) dla każdego wymienionego koloru.`);
  parts.push(`\n**L. Notatki niebędące pozycjami zębów.** Kartki czasem zawierają dodatkowe uwagi tekstowe niezwiązane z konkretnym zamówieniem zębów, np. o akcesoriach/narzędziach (np. "łopatka do cementu"), ogólne komentarze (np. "pozostałe kolory/fasony podstawowe zamawiamy na bieżąco"). Takie linie POMIŃ całkowicie — nie twórz dla nich pozycji w items.`);
  parts.push(`\n**M. UWAGA: kolor "A3" vs "A3.5" — łatwo pomylić.** To DWA RÓŻNE kolory w katalogu. "A3.5" bywa zapisywany z przecinkiem zamiast kropką ("A3,5") lub z małą, doklejoną "5" tuż przy "A3" — sprawdź UWAŻNIE, czy zaraz po "A3" nie ma dodatkowej cyfry "5" (oddzielonej kropką, przecinkiem, ukośnikiem albo po prostu blisko dopisanej). Jeśli tej dodatkowej "5" nie ma — to zwykłe "A3". Nie zgaduj — jeśli nie masz pewności, wybierz wariant lepiej pasujący do reszty kolorów widocznych na kartce (np. jeśli klient konsekwentnie używa pełnej skali z ".5", to prawdopodobnie tu też).`);
  parts.push(`\n**N. UWAGA: Ivostar Chromascop — klienci często piszą tylko sufiks.** Dla Ivostar Chromascop (np. "140/1C", "120/1A", "210/2B") klienci często zapisują tylko sufiks po ukośniku (np. "1c", "1A", "2B") bez prefixu liczbowego. Jeśli widzisz sufiks pasujący do katalogu Chromascop (np. "1C", "1A", "2A", "2B", "1D", "1E", "2C", "3A", "5B", "2E", "3E", "4A", "6B", "4B", "6C", "6D", "4C", "3C", "4D") — dopasuj go do PEŁNEGO koloru z katalogu (z prefixem). Jeśli sufiks pasuje do kilku prefixów (np. "2C" występuje w "240/2C" i "520/4C") — wybierz ten, który lepiej pasuje do kontekstu (np. jeśli są inne kolory z tej samej grupy prefixów na kartce).`);
  parts.push(`\n**O. UWAGA: cyfry "8" i "9" są często mylone w piśmie odręcznym.** Dolna pętla cyfry "8" jest w pełni zamknięta, a "9" ma prostą "nóżkę" bez zamkniętej dolnej pętli. Przy odczytywaniu KAŻDEGO numeru fasonu i KAŻDEJ ilości zawierającej cyfrę 8 lub 9 — przyjrzyj się dokładnie kształtowi tej cyfry zanim ją zapiszesz. Pomyłka między 8 a 9 jest jednym z najczęstszych błędów odczytu — nie spiesz się z tą cyfrą. JEŚLI widzisz dwie sąsiednie wartości, które wyglądają identycznie lub prawie identycznie (np. dwa fasony zapisane jako "48, 48") — NIE zakładaj automatycznie, że to zamierzony duplikat. Przyjrzyj się KAŻDEJ z osobna od nowa — to częsty przypadek, gdzie druga wartość to w rzeczywistości INNA liczba (np. "48" i "49"), tylko napisana podobnie. Porównaj oba kształty cyfra po cyfrze zamiast zakładać, że druga jest taka sama jak pierwsza.`);

  parts.push(`\n## Zasady odczytu:`);
  parts.push(`1. productLine — obowiązkowe, musi być dokładnie jedną z: ${lines.map((d) => `"${d.id}"`).join(", ")}.`);
  parts.push(`2. kind — obowiązkowe, wartości: "anterior" (przednie) lub "posterior" (boczne/tylne).`);
  parts.push(`3. color — obowiązkowe, musi być dokładnie z listy kolorów dla danej linii. Nie wymyślaj nowych.`);
  parts.push(`4. mould — musi być z listy fasonów dla danej linii i kind. Jeśli brak fasonów lub fason opcjonalny — ustaw null.`);
  parts.push(`5. jaw — obowiązkowe gdy kind="posterior": "upper" (góra) lub "lower" (dół). Dla kind="anterior" ZAWSZE ustaw jaw=null — przednie zęby nie mają szczęki.`);
  parts.push(`6. count — liczba sztuk tej samej pozycji (positive integer, min 1, max 200).`);
  parts.push(`7. Nie wymyślaj danych — odczytaj tylko to, co jest widoczne na zdjęciu.`);
  parts.push(`8. Jeśli pozycja jest nieczytelna lub niepewna — pomiń ją.`);
  parts.push(`9. Rozpoznaj linię produktu po nazwie na opakowaniu lub po znanych kolorach/fasonach.`);
  parts.push(`10. DOKŁADNOŚĆ PRZED SZYBKOŚCIĄ. Kartka może zawierać dziesiątki pozycji w wielu blokach/kolorach — przeanalizuj KAŻDY blok osobno, kolor po kolorze, linia po linii. Nie pomijaj żadnej widocznej pozycji i nie "zgaduj w pośpiechu" ilości ani fasonu — jeśli obraz jest duży lub gęsto zapisany, poświęć więcej czasu na dokładne odczytanie każdej cyfry. Przed zwróceniem wyniku sprawdź w myślach: czy liczba pozycji w "items" odpowiada liczbie widocznych linii/wpisów na zdjęciu (uwzględniając rozbicie podwójnych strzałek/"i" na dwie pozycje)?`);

  parts.push(`\n## Uwagi końcowe:`);
  parts.push(`Jeśli nie można odczytać żadnej pozycji, zwróć pustą tablicę items i krótkie wyjaśnienie w note.`);

  return parts.join("\n");
}

export type TeethVisionPromptInfo = {
  colors: readonly string[];
  anteriorMoulds: readonly string[];
  posteriorMoulds: readonly string[];
  jawRequiredForPosterior: boolean;
  mouldOptional: boolean;
};

export function teethVisionPromptInfo(catalog: TeethCatalogRef): TeethVisionPromptInfo {
  return {
    colors: teethColorsForLine(catalog.productLine),
    anteriorMoulds: toothMouldsForLine(catalog.productLine, "anterior"),
    posteriorMoulds: toothMouldsForLine(catalog.productLine, "posterior"),
    jawRequiredForPosterior: jawRequiredForKind("posterior"),
    mouldOptional: lineOptionalMould(catalog.productLine),
  };
}

export function isValidOcrColor(color: string, productLine: TeethProductLine): boolean {
  return teethColorsForLine(productLine).includes(color);
}

/**
 * Normalizuje odczytany kolor do formatu katalogu — klienci/AI czasem zapisują
 * separator dziesiętny przecinkiem (polska notacja: "A3,5") zamiast kropką ("A3.5",
 * format używany w katalogu). Jeśli znormalizowana wersja pasuje do katalogu danej
 * linii — zwraca ją, w przeciwnym razie zwraca oryginał bez zmian.
 *
 * Dla Ivostar Chromascop dopasowuje sufiks-only (np. "1c" -> "140/1C").
 */
export function resolveOcrColor(color: string, productLine: TeethProductLine): string {
  const trimmed = color.trim();
  const commaNormalized = trimmed.replace(",", ".");
  if (commaNormalized !== trimmed && teethColorsForLine(productLine).includes(commaNormalized)) {
    return commaNormalized;
  }

  // Ivostar Chromascop suffix-only matching (e.g., "1c" -> "140/1C")
  const ivostarColors = teethColorsForLine(productLine);
  const isIvostar = ivostarColors.some((c) => c.includes("/"));
  if (isIvostar && !trimmed.includes("/")) {
    const suffixUpper = trimmed.toUpperCase();
    const match = ivostarColors.find((c) => c.endsWith(`/${suffixUpper}`));
    if (match) return match;
  }

  return trimmed;
}

export function isValidOcrMould(
  mould: string | null | undefined,
  kind: TeethKind,
  productLine: TeethProductLine,
): boolean {
  if (mould == null || mould === "") {
    return lineOptionalMould(productLine) || !hasMouldsForLineKind(productLine, kind);
  }
  return toothMouldsForLine(productLine, kind).includes(mould);
}

export function isValidOcrKind(kind: string): kind is TeethKind {
  return kind === "anterior" || kind === "posterior";
}

export function isValidOcrJaw(jaw: string | null | undefined): boolean {
  return jaw == null || jaw === "upper" || jaw === "lower";
}

export function isValidOcrProductLine(line: string): line is TeethProductLine {
  return isTeethProductLine(line);
}

/**
 * Próbuje dopasować odczytany numer fasonu do katalogu, tolerując typowe rozbieżności
 * notacji klientów (np. brak sufiksu "N" dla fasonów N-cusp: "79" -> "79N").
 * Jeśli fason pasuje do listy innego kind niż zgłoszony przez AI — poprawia kind
 * (numer fasonu w katalogu jest źródłem prawdy, nie deklaracja AI).
 */
export function resolveOcrMouldAndKind(
  productLine: TeethProductLine,
  rawMould: string,
  aiKind: TeethKind,
): { kind: TeethKind; mould: string } | null {
  const trimmed = rawMould.trim();
  if (!trimmed) return null;

  const candidates = new Set<string>([trimmed]);
  if (/n$/i.test(trimmed)) {
    candidates.add(trimmed.slice(0, -1));
  } else {
    candidates.add(`${trimmed}N`);
  }

  const kindsToTry: TeethKind[] = aiKind === "anterior" ? ["anterior", "posterior"] : ["posterior", "anterior"];
  for (const kind of kindsToTry) {
    const list = toothMouldsForLine(productLine, kind);
    for (const candidate of candidates) {
      if (list.includes(candidate)) {
        return { kind, mould: candidate };
      }
    }
  }
  return null;
}
