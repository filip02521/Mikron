/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { EmojiPicker } from "./EmojiPicker";

function Harness({ initial }: { initial: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  return (
    <div>
      <textarea ref={ref} aria-label="Treść" value={value} onChange={(e) => setValue(e.target.value)} />
      <EmojiPicker textareaRef={ref} value={value} onChange={setValue} />
    </div>
  );
}

describe("EmojiPicker", () => {
  afterEach(() => cleanup());

  it("wstawia emotkę w miejscu kursora i zamyka listę", async () => {
    render(<Harness initial="Dzień dobry, dziękuję" />);
    const area = screen.getByLabelText("Treść") as HTMLTextAreaElement;
    area.setSelectionRange(12, 12);
    fireEvent.click(screen.getByRole("button", { name: "Wstaw emotkę" }));
    fireEvent.click(screen.getByRole("button", { name: "Wstaw 👍" }));
    expect(area.value).toBe("Dzień dobry,👍 dziękuję");
    expect(screen.queryByRole("group", { name: "Emotki" })).toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    expect(document.activeElement).toBe(area);
    expect(area.selectionStart).toBe(14);
  });

  it("Escape zamyka listę i oddaje fokus przyciskowi", () => {
    render(<Harness initial="" />);
    const trigger = screen.getByRole("button", { name: "Wstaw emotkę" });
    fireEvent.click(trigger);
    expect(screen.getByRole("group", { name: "Emotki" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Emotki" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
