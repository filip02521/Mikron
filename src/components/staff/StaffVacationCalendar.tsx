"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionSetStaffVacationPeriod,
  actionRemoveStaffVacationPeriod,
} from "@/app/actions/staff-vacation-periods";
import type { StaffVacationRow } from "@/lib/data/staff-vacation-periods";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconSun } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { ROLE_LABELS } from "@/lib/users/labels";
import type { UserRole } from "@/types/database";

type StaffMember = {
  id: string;
  name: string;
  role: UserRole;
};

function statusBadge(startDate: string, endDate: string, todayKey: string) {
  if (todayKey < startDate) return <Badge variant="default" className="text-[10px]">Nadchodzące</Badge>;
  if (todayKey > endDate) return <Badge variant="default" className="text-[10px] opacity-60">Zakończone</Badge>;
  return <Badge variant="success" className="text-[10px]">Aktywne</Badge>;
}

function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function StaffVacationCalendar({
  staff,
  periodsByUser,
  currentUserId,
  isAdmin: adminMode,
  todayDateKey,
}: {
  staff: StaffMember[];
  periodsByUser: Record<string, StaffVacationRow[]>;
  currentUserId: string;
  isAdmin: boolean;
  todayDateKey: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    startDate: todayDateKey,
    endDate: addDaysStr(7),
    note: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<StaffVacationRow | null>(null);

  const resetForm = useCallback(() => {
    setForm({ startDate: todayDateKey, endDate: addDaysStr(7), note: "" });
    setFormOpen(false);
  }, [todayDateKey]);

  const save = useCallback(() => {
    if (!form.startDate || !form.endDate) return;
    if (form.startDate > form.endDate) return;
    start(async () => {
      const r = await actionSetStaffVacationPeriod({
        userId: currentUserId,
        startDate: form.startDate,
        endDate: form.endDate,
        note: form.note || null,
      });
      if ("error" in r) return;
      resetForm();
      router.refresh();
    });
  }, [form, currentUserId, resetForm, router]);

  const removePeriod = useCallback((id: string) => {
    start(async () => {
      const r = await actionRemoveStaffVacationPeriod(id);
      if ("error" in r) return;
      setDeleteTarget(null);
      router.refresh();
    });
  }, [router]);

  const sortedStaff = [...staff].sort((a, b) => a.name.localeCompare(b.name));
  const myPeriods = (periodsByUser[currentUserId] ?? []).sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );

  return (
    <div className="space-y-4">
      {/* Moje urlopy */}
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Moje urlopy"
          description="Ustaw daty swojego urlopu, aby współpracownicy z Twojego działu wiedzieli, kiedy jesteś niedostępny."
          leading={
            <SectionHeadingIcon tileClassName="bg-amber-100 text-amber-800">
              <IconSun size={20} />
            </SectionHeadingIcon>
          }
          action={
            !formOpen ? (
              <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                + Dodaj urlop
              </Button>
            ) : null
          }
        />
        <div className="p-4">
          {formOpen ? (
            <div className="mb-4 space-y-4 rounded-md border border-slate-200 bg-slate-50/50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Od">
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </Field>
                <Field label="Do">
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notatka (opcjonalna)">
                <Input
                  type="text"
                  value={form.note}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Anuluj
                </Button>
                <Button size="sm" onClick={save} disabled={pending}>
                  Zapisz
                </Button>
              </div>
            </div>
          ) : null}

          {!myPeriods.length ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Brak zaplanowanych urlopów. Kliknij „Dodaj urlop”, aby ustawić daty.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {myPeriods.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 tabular-nums">
                      {p.startDate} → {p.endDate}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
                      {statusBadge(p.startDate, p.endDate, todayDateKey)}
                      {p.note ? <span className="text-slate-500">{p.note}</span> : null}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    disabled={pending}
                    onClick={() => setDeleteTarget(p)}
                  >
                    Usuń
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Urlopy działu */}
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Urlopy działu"
          description="Osoby z Twojego działu i ich zaplanowane urlopy."
          leading={
            <SectionHeadingIcon tileClassName="bg-sky-100 text-sky-800">
              <IconSun size={20} />
            </SectionHeadingIcon>
          }
        />
        <div className="p-4">
          {sortedStaff.length <= 1 && !adminMode ? (
            <EmptyState
              brandAccent
              icon={<IconSun size={28} />}
              title="Tylko Ty w tym dziale"
              description="Nie ma innych osób z Twoim działem, które mogłyby planować urlopy."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedStaff.map((member) => {
                const periods = (periodsByUser[member.id] ?? []).sort((a, b) =>
                  b.startDate.localeCompare(a.startDate)
                );
                const isMe = member.id === currentUserId;
                return (
                  <li key={member.id} className="py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", isMe ? "text-indigo-700" : "text-slate-900")}>
                        {member.name}
                        {isMe ? <span className="ml-1.5 text-xs text-indigo-400">(Ty)</span> : null}
                      </span>
                      <span className="text-xs text-slate-400">
                        {ROLE_LABELS[member.role]}
                      </span>
                    </div>
                    {!periods.length ? (
                      <p className="mt-1 text-sm text-slate-400">Brak zaplanowanych urlopów.</p>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {periods.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs tabular-nums text-slate-700"
                          >
                            {statusBadge(p.startDate, p.endDate, todayDateKey)}
                            {p.startDate} → {p.endDate}
                            {p.note ? <span className="text-slate-400">· {p.note}</span> : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {deleteTarget ? (
        <ConfirmDialog
          open
          title="Usunąć urlop?"
          message={`Urlop od ${deleteTarget.startDate} do ${deleteTarget.endDate} zostanie usunięty.`}
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          danger
          onConfirm={() => removePeriod(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
