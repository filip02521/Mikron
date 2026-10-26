@AGENTS.md

# Szkice maili (Gmail MCP)

- Zero załączników, chyba że użytkownik wprost poda plik do dołączenia.
- Odpowiedź w wątku (`replyToMessageId`) dokleja cytat oryginału, a z nim osierocone obrazki z podpisów (`~WRD*.jpg`, `image00*.png`, „Das Bild wurde vom Absender entfernt”). Gmail robi z nich puste załączniki.
- Dlatego po `create_draft` z `replyToMessageId` od razu wołaj `update_draft` z tym samym `body` i bez `attachments` — czyści załączniki i cytat, zostaje wątek.
- Przed oddaniem szkicu sprawdź `get_draft`: `attachments` ma być puste.
