export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
      <div className="min-w-0 space-y-2">
        {badge}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem] sm:leading-tight">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto [&_a]:flex-1 [&_button]:min-h-11 sm:[&_a]:flex-none sm:[&_button]:min-h-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
