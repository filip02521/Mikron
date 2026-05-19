"use client";

export function SalesCancelRequestLink({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <p className="mt-4 border-t border-dashed border-slate-200 pt-3 text-center text-[11px] leading-relaxed text-slate-500">
      Klient się rozmyślił?{" "}
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Wycofaj prośbę…
      </button>
    </p>
  );
}
