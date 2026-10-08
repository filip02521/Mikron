import { afterEach, describe, expect, it, vi } from "vitest";
import { getSubiektOrdersZdPdf, setSubiektOrdersZdTermin } from "@/lib/subiekt/api";

vi.mock("@/lib/subiekt/config", () => ({
  resolveSubiektOrdersConfig: () => ({
    ok: true as const,
    config: { baseUrl: "http://orders.local/api/v1", apiKey: "x", timeoutMs: 5000 },
  }),
}));

const fetchMock = vi.fn();
const jsonMock = vi.fn();
vi.mock("@/lib/subiekt/client", () => ({
  subiektFetch: (...args: unknown[]) => fetchMock(...args),
  subiektJson: (...args: unknown[]) => jsonMock(...args),
}));

const pdf = () => new Response("%PDF-1.4 ZD 412/2026", { status: 200 });

describe("getSubiektOrdersZdPdf", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.useRealTimers();
  });

  it("ponawia wydruk po 503 (Sfera zajęta)", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response("Sfera zajęta", { status: 503 })).mockResolvedValueOnce(pdf());
    const p = getSubiektOrdersZdPdf(1867748);
    await vi.runAllTimersAsync();
    expect((await p).subarray(0, 4).toString()).toBe("%PDF");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("po wyczerpaniu prób pokazuje treść odpowiedzi mostka", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => new Response("Sfera nie odpowiada", { status: 503 }));
    const p = getSubiektOrdersZdPdf(1867749);
    const assertion = expect(p).rejects.toThrow("Subiekt nie wydrukował ZD do PDF (HTTP 503: Sfera nie odpowiada).");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("podgląd i wysyłka w tej samej chwili — jeden wydruk; inna treść ZD — nowy wydruk", async () => {
    fetchMock.mockImplementation(async () => pdf());
    await Promise.all([getSubiektOrdersZdPdf(1867751, { version: "a" }), getSubiektOrdersZdPdf(1867751, { version: "a" })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getSubiektOrdersZdPdf(1867751, { version: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getSubiektOrdersZdPdf(1867751, { version: "b" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("zmiana terminu w trakcie wydruku → ten wydruk nie trafia do pamięci", async () => {
    let release: (r: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => (release = r)));
    const first = getSubiektOrdersZdPdf(1867752, { version: "a" });
    await Promise.resolve();
    jsonMock.mockResolvedValueOnce({ data: { dok_TerminRealizacji: "2026-10-07" } });
    await setSubiektOrdersZdTermin(1867752, "2026-10-07");
    release(pdf());
    await first;
    fetchMock.mockImplementation(async () => pdf());
    await getSubiektOrdersZdPdf(1867752, { version: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("nie ponawia przy 500", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(getSubiektOrdersZdPdf(1867750)).rejects.toThrow("(HTTP 500).");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
