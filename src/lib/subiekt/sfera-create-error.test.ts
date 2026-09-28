import { describe, expect, it } from "vitest";
import {
  formatZdCreateSferaUserMessage,
  humanizeSferaCreateError,
} from "./sfera-create-error";

describe("humanizeSferaCreateError", () => {
  it("mapuje 0x800413D5 na limit licencji (nie SQL)", () => {
    const raw =
      "[ZD / krok: Uruchom] HRESULT=0x800413D5 — nieznany kod InsERT/COM | COM: 0x800413D5: 0x800413D5 | Wskazówka: Sprawdź: login/hasło SQL, operator + hasło, czy…";
    const h = humanizeSferaCreateError(raw);
    expect(h?.kind).toBe("license_limit");
    expect(h?.title).toMatch(/Zajęta licencja/i);
    expect(h?.message).toMatch(/Sfery są zajęte/i);
    expect(h?.message).not.toMatch(/login\/hasło SQL/i);
  });

  it("mapuje 0x800412BE na limit stanowisk Sfery", () => {
    const h = humanizeSferaCreateError(
      "HRESULT=0x800412BE INS_E_GTA_LICENSE_HOST_LIMIT_REACHED"
    );
    expect(h?.kind).toBe("sfera_host_limit");
    expect(h?.title).toMatch(/stanowiska Sfery/i);
  });

  it("mapuje tekst o przekroczonym limicie licencji bez hex", () => {
    const h = humanizeSferaCreateError(
      "INS_E_PRZEKROCZONY_LIMIT_LICENCJI — przekroczony limit wykupionych licencji"
    );
    expect(h?.kind).toBe("license_limit");
  });

  it("timeout Subiekta NIE jest zajętą licencją (SubiektTimeoutError)", () => {
    const h = humanizeSferaCreateError("Przekroczono limit czasu (60000 ms)");
    expect(h?.kind).toBe("timeout");
    expect(h?.title).not.toMatch(/licencj/i);
    expect(h?.message).toMatch(/nie jest problem z licencją/i);
  });

  it("timeout SQL / HTTP z ORDERS to timeout, nie licencja", () => {
    for (const raw of [
      "Subiekt: Przekroczono limit czasu wykonania zapytania SQL",
      "Execution Timeout Expired. The timeout period elapsed",
      "Upłynął limit czasu operacji",
      "request timed out",
    ]) {
      expect(humanizeSferaCreateError(raw)?.kind).toBe("timeout");
    }
  });

  it("inny „przekroczony limit” (bez licencji) nie daje zajętej licencji", () => {
    expect(
      humanizeSferaCreateError("Przekroczony limit pozycji w dokumencie")?.kind
    ).not.toBe("license_limit");
  });

  it("jawny HRESULT licencji wygrywa nawet z tekstem o timeout", () => {
    expect(
      humanizeSferaCreateError("HRESULT=0x800413D5 po timeout operacji")?.kind
    ).toBe("license_limit");
  });

  it("tekst „przekroczono limit licencji” nadal mapuje na licencję", () => {
    expect(
      humanizeSferaCreateError("Przekroczono limit licencji programu")?.kind
    ).toBe("license_limit");
  });

  it("zwraca null dla nierozpoznanego błędu", () => {
    expect(humanizeSferaCreateError("random failure xyz")).toBeNull();
  });
});

describe("formatZdCreateSferaUserMessage", () => {
  it("dla 0x800413D5 daje czytelny tytuł i treść", () => {
    const msg = formatZdCreateSferaUserMessage(
      "[ZD / krok: Uruchom] HRESULT=0x800413D5 — nieznany kod | Wskazówka: Sprawdź: login/hasło SQL, operator"
    );
    expect(msg.title).toMatch(/Zajęta licencja/i);
    expect(msg.message).toMatch(/Sfery są zajęte/i);
    expect(msg.message).not.toMatch(/login\/hasło SQL/i);
  });

  it("obcina mylącą wskazówkę SQL przy nieznanym HRESULT", () => {
    const msg = formatZdCreateSferaUserMessage(
      "[ZD / krok: Uruchom] HRESULT=0x8004ABCD — nieznany kod | Wskazówka: Sprawdź: login/hasło SQL, operator + hasło"
    );
    expect(msg.title).toMatch(/Błąd Sfery/i);
    expect(msg.message).toContain("0x8004ABCD");
    expect(msg.message).not.toMatch(/login\/hasło SQL/i);
  });
});
