"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionImportOcChecks } from "@/app/actions/oc-check";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";

export function OcCheckImportForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await actionImportOcChecks(value);
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({ ok: true, text: `Zapisano. Nowe: ${result.created}, zaktualizowane: ${result.updated}.` });
      setValue("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <label htmlFor="oc-import" className="block text-sm font-medium text-slate-900">
        Wynik kontroli (JSON)
      </label>
      <textarea
        id="oc-import"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        spellCheck={false}
        className={fieldControlClass("default", "font-mono text-xs leading-relaxed")}
        placeholder='{ "checks": [ { "supplier_name": "Polirapid", "oc_number": "2027-20320", "status": "rozbieznosci", ... } ] }'
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={submit} disabled={pending || value.trim() === ""}>
          {pending ? "Importuję…" : "Importuj"}
        </Button>
        {message ? (
          <p className={message.ok ? "text-sm text-emerald-800" : "text-sm text-red-700"} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
