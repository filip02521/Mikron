---
version: 1
slug: "src-app-serwis"
primary_target: "src/app/serwis"
related_targets: ["src/components/serwis"]
---

# Panel Serwisu (/serwis/*)

Tryb: Operate. Użytkownik: serwisant sprzętu stomatologicznego (rola `serwis`), komputer przy stole serwisowym z ekranem dotykowym; ok. 10 zgłoszeń tygodniowo, kilka–kilkanaście zleceń w toku naraz. Praca: przyjąć sprzęt (często ze zgłoszenia helpdesku), wiedzieć, co ruszyć dziś, prowadzić naprawę i części, wydać z dokumentami, pilnować sprzętu zastępczego. Ograniczenia: dotyk (min. 44 px), ten sam kod komponentów OnTime, motyw jasny i ciemny, Subiekt jako źródło prawdy.

## Direction contract

THESIS: Każde zlecenie to karta serwisowa, na której kroki naprawy są przybite pieczątką z datą. Odrzuca kanban statusów w szarości z jednym akcentem — kategorię, w której każdy panel serwisowy wygląda tak samo.

OWN-WORLD: Grunt bladego papieru zabezpieczającego (szaro-zielony), białe karty z cienkimi liniami rubryk, ciemnofioletowy pas Serwisu, fiolet atramentu pieczątki jako jedyny akcent (główna akcja, wybór, pieczątki); bursztyn, czerwień i zieleń tylko dla stanu, nad fioletem. Etykiety rubryk drobnym krojem formularza, cyfry tabelaryczne.

STORY: Serwisant widzi najpierw, co wymaga ruchu dziś, rozumie z rzędu pieczątek, gdzie jest każda naprawa i od kiedy, i jednym dotknięciem otwiera kartę zlecenia, żeby przybić następną pieczątkę.

FIRST VIEWPORT: Pas Serwisu u góry (marka, cztery widoki, „Przyjmij sprzęt”). Pod nim zdanie stanu z liczbą i kafle-filtry. Kolejka „Teraz” (część dotarła, termin minął, gotowe — zadzwoń), potem zgłoszenia z helpdesku do przyjęcia, potem w toku. Każdy wiersz kończy pasek pięciu rubryk Przyjęto · Diagnoza · Naprawa · Gotowe · Wydano; główna akcja w pasie i w panelu zlecenia.

FORM: Karta serwisowa z pieczątkami — pozycja 5 na liście (1 taśma wskaźnikowa autoklawu, 2 przywieszka naprawcza, 3 rysunek rozstrzelony, 4 tablica z obrysami, 5 karta gwarancyjna z pieczątkami, 6 tablica planowania z magnesami, 7 list przewozowy). seed:1b2dc60a2054f251 (roll degraded: bez challengerów i plansz). Ruch charakterystyczny: pasek rubryk z pieczątkami (wiersz listy i nagłówek karty zlecenia); nowa pieczątka „wbija się” krótko (skala i obrót), z wariantem bez ruchu.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Nierozstrzygnięte

- Zapis statusu zgłoszenia z powrotem do helpdesku (4 przy przyjęciu, 5 przy wydaniu, `notify:false`) — czeka na decyzję właściciela; wymaga scope `helpdesk:write`.
