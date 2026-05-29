import { describe, expect, it } from "vitest";
import { collectNotepadTodayTasks } from "./notepad-today-tasks";
import type { SalesNote, SalesPaymentWatch } from "@/types/database";

const watch = (partial: Partial<SalesPaymentWatch>): SalesPaymentWatch => ({
  id: "w1",
  sales_person_id: "sp1",
  subiekt_dok_id: 1,
  zk_number: "ZK 1/2026",
  client_label: "Klient",
  client_kh_id: null,
  amount_net: null,
  amount_gross: 100,
  zk_issued_at: null,
  due_at: "2026-05-01",
  note: null,
  line_summary: null,
  subiekt_snapshot: null,
  follow_up_at: null,
  settled_at: null,
  archived_at: null,
  created_at: "",
  updated_at: "",
  ...partial,
});

const note = (partial: Partial<SalesNote>): SalesNote => ({
  id: "n1",
  sales_person_id: "sp1",
  title: null,
  body: "Oddzwonić",
  color: "default",
  pinned: false,
  archived_at: null,
  follow_up_at: null,
  created_at: "",
  updated_at: "",
  ...partial,
});

describe("collectNotepadTodayTasks", () => {
  it("zbiera ZK po terminie i notatki z follow-up", () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const tasks = collectNotepadTodayTasks(
      [watch({ id: "w-over", due_at: "2026-01-01" })],
      [note({ id: "n-fu", follow_up_at: iso })]
    );
    expect(tasks.map((t) => t.kind)).toEqual(["zk-overdue", "note-follow-up"]);
  });
});
