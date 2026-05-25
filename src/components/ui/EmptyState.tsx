import { IconInbox } from "@/components/icons/StrokeIcons";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-14">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        {icon ?? <IconInbox size={28} strokeWidth={1.75} />}
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
