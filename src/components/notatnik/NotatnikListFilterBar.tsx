import { NOTATNIK_SEARCH_CLASS } from "./notatnik-layout";

export function NotatnikListFilterBar({
  value,
  onChange,
  placeholder = "Filtruj po kliencie lub numerze ZK…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const active = value.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={NOTATNIK_SEARCH_CLASS}
        autoComplete="off"
        spellCheck={false}
      />
      {active ? (
        <button
          type="button"
          className="text-xs text-indigo-700 hover:text-indigo-900"
          onClick={() => onChange("")}
        >
          Wyczyść filtr
        </button>
      ) : null}
    </div>
  );
}
