import { describe, expect, it } from "vitest";
import type { RolInvoiceView, RolLineView } from "./data";
import type { RolBatchFiles } from "./files";
import { ensureRolZd, sendRolMail, type RolMailSender, type RolSendStore, type RolZdApi } from "./send";

const inv: RolInvoiceView = {
  fsDokId: 10,
  fsNr: "FS 10",
  fsDate: null,
  otherLinesCount: 0,
  kfsDokIds: [],
  excluded: false,
  excludedReason: "",
  pdf: "gotowy",
  pdfError: "",
};
const line = (twId: number, qtyFs: number): RolLineView => ({
  id: twId,
  fsDokId: 10,
  twId,
  symbol: `76400${twId}`,
  ivoclarCatalogNo: `76400${twId}`,
  name: `Towar ${twId}`,
  qtyFs,
  qtyKfs: 0,
  qtyOverride: null,
  excluded: false,
});
const batch = (p: { zdDokId?: number | null; zdNr?: string | null } = {}) => ({
  id: "b1",
  period: "2026-09-01",
  invoices: [inv],
  lines: [line(1, 2), line(2, 3)],
  zdDokId: p.zdDokId ?? null,
  zdNr: p.zdNr ?? null,
});

function fakes(opts: { lockFails?: boolean; existing?: { dokId: number; nr: string }; saved?: Map<number, number>; markSentFails?: boolean } = {}) {
  const log: string[] = [];
  const store: RolSendStore = {
    lock: async () => {
      log.push("lock");
      return opts.lockFails ? { ok: false, error: "Ktoś właśnie wysyła tę paczkę." } : { ok: true };
    },
    unlock: async () => void log.push("unlock"),
    saveZd: async (_id, zd) => void log.push(`saveZd:${zd.nr}`),
    markSent: async (_id, r) => {
      if (opts.markSentFails) throw new Error("db down");
      log.push(`markSent:${r.messageId}:${r.attachments.map((a) => a.name).join("+")}`);
    },
  };
  const zd: RolZdApi = {
    findExisting: async (q) => {
      log.push(`find:${q.uwagi}`);
      return opts.existing ?? null;
    },
    create: async (body) => {
      log.push(`create:${body.uwagi}:${body.pozycje.map((p) => `${p.towarId}x${p.ilosc}`).join(",")}:${body.personelId ?? "-"}`);
      return { dokId: 500, nr: "ZD 500/M/11/2026" };
    },
    readLines: async (dokId) => {
      log.push(`read:${dokId}`);
      return opts.saved ?? new Map([[1, 2], [2, 3]]);
    },
  };
  return { log, store, zd };
}

const ctx = (b = batch(), missingPdf: string[] = []) => ({
  batch: b,
  programLabel: "Przykładowa",
  missingPdf,
  ivoclarKhId: 688,
  personelId: 7,
  todayKey: "2026-11-02",
});

describe("ensureRolZd", () => {
  it("tworzy ZD, zapisuje numer przed weryfikacją i zwalnia blokadę", async () => {
    const f = fakes();
    expect(await ensureRolZd(ctx(), f.store, f.zd)).toEqual({ ok: true, zdNr: "ZD 500/M/11/2026", created: true });
    expect(f.log).toEqual([
      "lock",
      "find:ROL Przykładowa wrzesień",
      "create:ROL Przykładowa wrzesień:1x2,2x3:7",
      "saveZd:ZD 500/M/11/2026",
      "read:500",
      "unlock",
    ]);
  });

  it("po przerwanym zapisie używa istniejącej ZD zamiast tworzyć drugą", async () => {
    const f = fakes({ existing: { dokId: 400, nr: "ZD 400/M/11/2026" } });
    expect(await ensureRolZd(ctx(), f.store, f.zd)).toEqual({ ok: true, zdNr: "ZD 400/M/11/2026", created: false });
    expect(f.log.some((l) => l.startsWith("create"))).toBe(false);
    expect(f.log).toContain("saveZd:ZD 400/M/11/2026");
  });

  it("ZD już w paczce — tylko weryfikacja", async () => {
    const f = fakes();
    expect(await ensureRolZd(ctx(batch({ zdDokId: 300, zdNr: "ZD 300" })), f.store, f.zd)).toMatchObject({ ok: true, zdNr: "ZD 300" });
    expect(f.log).toEqual(["lock", "read:300", "unlock"]);
  });

  it("rozbieżność po zapisie: numer zostaje zapisany, błąd z numerem ZD", async () => {
    const f = fakes({ saved: new Map([[1, 2]]) });
    const res = await ensureRolZd(ctx(), f.store, f.zd);
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/ZD 500\/M\/11\/2026.*inna ilość albo brak: 1/) });
    expect(f.log).toContain("saveZd:ZD 500/M/11/2026");
    expect(f.log.at(-1)).toBe("unlock");
  });

  it("brak PDF albo zajęta paczka — bez ZD", async () => {
    const a = fakes();
    expect(await ensureRolZd(ctx(batch(), ["FS 10"]), a.store, a.zd)).toMatchObject({ ok: false, error: expect.stringMatching(/FS 10/) });
    expect(a.log).toEqual(["lock", "unlock"]);
    const b = fakes({ lockFails: true });
    expect(await ensureRolZd(ctx(), b.store, b.zd)).toMatchObject({ ok: false, error: expect.stringMatching(/wysyła/) });
    expect(b.log).toEqual(["lock"]);
  });

  it("błąd Subiekta przy tworzeniu — blokada zwolniona, wyjątek dalej", async () => {
    const f = fakes();
    f.zd.create = async () => {
      throw new Error("timeout");
    };
    await expect(ensureRolZd(ctx(), f.store, f.zd)).rejects.toThrow("timeout");
    expect(f.log.at(-1)).toBe("unlock");
  });
});

describe("sendRolMail", () => {
  const files: RolBatchFiles = {
    label: "ROL Przykładowa September 2026",
    sheet: { name: "ROL Przykładowa -25% September 2026.xlsx", contentType: "x", content: Buffer.from("PK") },
    pdfs: [{ name: "10 Przykładowa.pdf", contentType: "application/pdf", content: Buffer.from("%PDF") }],
    missingPdf: [],
  };
  const mail = { to: ["zamowienia@example.com"], cc: [], subject: "New Order", body: "Dear Sirs," };
  const okSend: RolMailSender = async () => ({ ok: true, from: "jan@example.com", messageId: "m1", threadId: "t1" });
  const run = (f: ReturnType<typeof fakes>, send: RolMailSender, b = batch({ zdDokId: 500 }), fl = files) =>
    sendRolMail({ batch: b, files: fl, mail, userId: "u1", sha256: () => "h" }, f.store, send);

  it("wysyła pliki tej paczki i zapisuje historię", async () => {
    const f = fakes();
    let sentFiles: string[] = [];
    const res = await run(f, async (i) => {
      sentFiles = i.attachments.map((a) => a.filename);
      return okSend(i);
    });
    expect(res).toEqual({ ok: true, from: "jan@example.com" });
    expect(sentFiles).toEqual(["ROL Przykładowa -25% September 2026.xlsx", "10 Przykładowa.pdf"]);
    expect(f.log).toEqual(["lock", "markSent:m1:ROL Przykładowa -25% September 2026.xlsx+10 Przykładowa.pdf", "unlock"]);
  });

  it("bez ZD albo bez PDF nie wysyła", async () => {
    const f = fakes();
    let called = false;
    const spy: RolMailSender = async (i) => ((called = true), okSend(i));
    expect(await run(f, spy, batch())).toMatchObject({ ok: false, error: expect.stringMatching(/ZD/) });
    expect(await run(f, spy, batch({ zdDokId: 500 }), { ...files, missingPdf: ["FS 10"] })).toMatchObject({ ok: false });
    expect(called).toBe(false);
  });

  it("niepewny wynik z Gmaila — nie oznacza jako wysłane, zwalnia blokadę", async () => {
    const f = fakes();
    const res = await run(f, async () => ({ ok: false, message: "Sprawdź „Wysłane”", uncertain: true }));
    expect(res).toEqual({ ok: false, error: "Sprawdź „Wysłane”" });
    expect(f.log).toEqual(["lock", "unlock"]);
  });

  it("mail wyszedł, historia się nie zapisała — ostrzega przed ponowną wysyłką", async () => {
    const f = fakes({ markSentFails: true });
    expect(await run(f, okSend)).toMatchObject({ ok: false, error: expect.stringMatching(/Nie wysyłaj go ponownie/) });
  });
});
