import { describe, expect, it } from "vitest";
import { collectNotepadTodayTasks } from "./notepad-today-tasks";
import type { SalesNote, SalesZkWatch } from "@/types/database";

const watch = (partial: Partial<SalesZkWatch>): SalesZkWatch => ({
  id: "w1",
  sales_person_id: "sp1",
  subiekt_dok_id: 1,
  zk_number: "ZK 1/2026",
  client_label: "Klient",
  client_kh_id: null,
  amount_net: null,
  amount_gross: 100,
  zk_issued_at: null,
  note: null,
  line_summary: null,
  subiekt_snapshot: null,
  follow_up_at: null,
  closed_at: null,
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
  it("zbiera ZK z przypomnieniem i notatki z follow-up", () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const tasks = collectNotepadTodayTasks(
      [watch({ id: "w-fu", follow_up_at: iso })],
      [note({ id: "n-fu", follow_up_at: iso })]
    );
    expect(tasks.map((t) => t.kind)).toEqual(["zk-follow-up", "note-follow-up"]);
  });
});
