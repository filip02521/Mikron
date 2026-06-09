/** Sekcja wewnątrz HelpPopover — spójny nagłówek i odstępy. */
export function HelpBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="space-y-1.5 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}
