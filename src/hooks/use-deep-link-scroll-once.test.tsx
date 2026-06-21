/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useDeepLinkScrollOnce } from "./use-deep-link-scroll-once";

function ScrollProbe({
  elementId,
  enabled,
}: {
  elementId: string | null;
  enabled: boolean;
}) {
  useDeepLinkScrollOnce(elementId, enabled, 0);
  return (
    <div>
      <div id="question-q1">Pytanie</div>
    </div>
  );
}

describe("useDeepLinkScrollOnce", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("przewija tylko raz dla tego samego id", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(<ScrollProbe elementId="question-q1" enabled />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(<ScrollProbe elementId="question-q1" enabled />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("przewija ponownie po zmianie id", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <div>
        <div id="question-q1">A</div>
        <div id="question-q2">B</div>
        <ScrollProbe elementId="question-q1" enabled />
      </div>
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <div>
        <div id="question-q1">A</div>
        <div id="question-q2">B</div>
        <ScrollProbe elementId="question-q2" enabled />
      </div>
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
