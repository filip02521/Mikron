# Marka OnTime

Znak: wskazówki zegara układają się w ptaszek — „na czas, załatwione”.

| Plik | Użycie |
|---|---|
| `ontime-znak.svg` | Znak na kaflu (64×64, promień 15) — avatar, ikona |
| `ontime-logo.svg` | Logo poziome z hasłem — jasne tło |
| `ontime-logo-ciemne.svg` | Logo poziome z hasłem — ciemne tło |

Kolory: petrol `#0f7380`, grafit `#151920` (na ciemnym: „Time” `#5fb7c1`). Font: Geist 700.
Napis w SVG jest tekstem — do druku / zewnętrznych materiałów zamień go na krzywe.

Źródło znaku w aplikacji: `src/lib/ui/brand-app-icon-svg.ts` (z niego `app/icon.svg`,
`app/apple-icon.tsx` i `AppBrandMark`). Po zmianie znaku przegeneruj `src/app/icon.svg`
— pilnuje tego test `brand-app-icon-svg.test.ts`.
