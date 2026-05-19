export type AuthQuote = {
  text: string;
  attribution?: string;
};

/** Rotujące cytaty na ekranach logowania — logistyka, plan, spokój operacyjny. */
export const AUTH_QUOTES: AuthQuote[] = [
  {
    text: "Najlepszy plan tygodnia to ten, który wszyscy widzą — bez telefonów w poniedziałek rano.",
  },
  {
    text: "Dobra dostawa zaczyna się od jasnej daty u dostawcy, nie od pośpiechu w ostatniej chwili.",
  },
  {
    text: "Spokój w magazynie buduje się z harmonogramu, nie z domysłów.",
    attribution: "System Dostaw",
  },
  {
    text: "Krótkie potwierdzenie dziś oszczędza godzinę szukania „czy to już zamówione”.",
  },
  {
    text: "Handlowiec wie, co czeka. Zakupy wiedzą, co dziś wysłać. Reszta się układa.",
  },
];
