/** Wiersz ustawienia z przełącznikiem — w karcie sekcji, oddzielony linią (bez ramki wokół wiersza). */
export function SettingToggleRow({
  label,
  description,
  ariaLabel,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: React.ReactNode;
  ariaLabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50 sm:px-6">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-slate-900">{label}</span>
        {description ? (
          <span className="text-xs leading-snug text-slate-500">{description}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="toggle-switch toggle-indigo shrink-0"
      />
    </label>
  );
}

/** Ciało karty ustawień: wiersze rozdzielone cienką linią. */
export const settingRowsClass = "divide-y divide-slate-100";

/** Wcięcie treści karty ustawień zgodne z `CardHeader inset`. */
export const settingCardInsetClass = "px-5 py-4 sm:px-6";
