import { describe, expect, it } from "vitest";
import { forwardedConversationText } from "./forward-text";

describe("forwardedConversationText", () => {
  it("wiadomości od najstarszej, z nagłówkiem jak w programie pocztowym; bez treści — snippet", () => {
    const text = forwardedConversationText([
      { from_name: "Inge Hahn", from_address: "i@renfert.de", subject: "Re: order", snippet: "x", received_at: new Date("2026-10-08T12:45:00Z"), text: "Dear Filip,\nconfirmed." },
      { from_name: "", from_address: "zakupy@mikran.com", subject: "order", snippet: "Please confirm", received_at: new Date("2026-10-07T07:00:00Z"), text: null },
    ]);
    expect(text).toBe(
      [
        "---------- Przekazana wiadomość ----------",
        "Od: zakupy@mikran.com",
        "Data: 07.10.2026, 09:00",
        "Temat: order",
        "",
        "Please confirm",
        "",
        "---------- Przekazana wiadomość ----------",
        "Od: Inge Hahn <i@renfert.de>",
        "Data: 08.10.2026, 14:45",
        "Temat: Re: order",
        "",
        "Dear Filip,\nconfirmed.",
      ].join("\n")
    );
  });
});
