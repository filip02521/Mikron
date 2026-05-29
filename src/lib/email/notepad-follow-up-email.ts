import { getAppUrl } from "@/lib/env/app-config";
import { escapeHtml } from "@/lib/security/escape-html";
import type { NotepadTodayTask } from "@/lib/sales/notepad-today-tasks";
import {
  EMAIL_THEME,
  emailButton,
  emailDocument,
  emailGreeting,
  emailMutedParagraph,
  emailParagraph,
} from "@/lib/email/sales-email-layout";

function notatnikUrl(): string {
  return `${getAppUrl().replace(/\/$/, "")}/notatnik`;
}

function taskLine(task: NotepadTodayTask): string {
  const label =
    task.kind === "zk-overdue"
      ? "ZK po terminie"
      : task.kind === "zk-follow-up"
        ? "Follow-up ZK"
        : "Follow-up notatka";
  const subtitle = task.subtitle ? `<div style="color:${EMAIL_THEME.muted};font-size:13px;margin-top:4px">${escapeHtml(task.subtitle)}</div>` : "";
  return `<li style="margin:0 0 12px;padding:12px 14px;border:1px solid ${EMAIL_THEME.border};border-radius:10px;background:#fff"><strong style="color:${EMAIL_THEME.foreground}">${escapeHtml(label)}:</strong> ${escapeHtml(task.title)}${subtitle}</li>`;
}

export function renderNotepadFollowUpEmail(params: {
  recipientName: string;
  tasks: NotepadTodayTask[];
}): { subject: string; html: string } {
  const count = params.tasks.length;
  const subject =
    count === 1
      ? "Notatnik — 1 rzecz na dziś"
      : `Notatnik — ${count} ${count < 5 ? "rzeczy" : "rzeczy"} na dziś`;

  const list = params.tasks.map(taskLine).join("");

  const html = emailDocument({
    preheader: subject,
    headerTitle: "Notatnik handlowca",
    headerSubtitle: "Przypomnienia na dziś",
    bodyHtml: [
      emailGreeting(params.recipientName),
      emailParagraph(
        `Masz <strong>${count}</strong> ${count === 1 ? "wpis wymagający" : "wpisy wymagające"} uwagi w notatniku — ZK po terminie lub ustawione przypomnienia.`
      ),
      `<ul style="list-style:none;margin:16px 0 20px;padding:0">${list}</ul>`,
      emailButton("Otwórz notatnik", notatnikUrl()),
      emailMutedParagraph("E-mail wysłany automatycznie o 7:00 w dni robocze."),
    ].join(""),
  });

  return { subject, html };
}
