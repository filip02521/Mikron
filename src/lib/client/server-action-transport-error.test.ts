import { describe, expect, it } from "vitest";
import { isServerActionTransportError } from "./server-action-transport-error";

describe("isServerActionTransportError", () => {
  it("wykrywa typowy błąd Next.js po udanym zapisie", () => {
    expect(
      isServerActionTransportError(
        new Error("An unexpected response was received from the server.")
      )
    ).toBe(true);
  });

  it("wykrywa zdigestowany komunikat Server Components (produkcja)", () => {
    expect(
      isServerActionTransportError(
        new Error(
          "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details."
        )
      )
    ).toBe(true);
  });

  it("ignoruje błędy biznesowe", () => {
    expect(isServerActionTransportError(new Error("ZK jest już na liście."))).toBe(
      false
    );
  });
});
