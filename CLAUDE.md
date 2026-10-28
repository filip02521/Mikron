@AGENTS.md

# Szkice maili (Gmail MCP)

- Zero załączników, chyba że użytkownik wprost poda plik do dołączenia.
- Nie używaj `replyToMessageId`. Odpowiedź w wątku dokleja cytat oryginału z obrazkami z podpisów (`~WRD*.jpg`, `image00*.png`), z których Gmail robi puste załączniki. `update_draft` cytatu nie usuwa — serwer dokleja go z powrotem.
- Zamiast tego nowy szkic z tematem `Re: <temat wątku>` i numerem zamówienia/sprawy w treści.
- Przed oddaniem szkicu sprawdź `get_draft`: brak `attachments`.
