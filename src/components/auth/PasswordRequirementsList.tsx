import { cn } from "@/lib/cn";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import type { EvaluatedPasswordRequirement } from "@/lib/auth/password-policy";

export function PasswordRequirementsList({
  requirements,
  id,
  className,
}: {
  requirements: EvaluatedPasswordRequirement[];
  id?: string;
  className?: string;
}) {
  const allMet = requirements.every((requirement) => requirement.met);

  return (
    <ul
      id={id}
      aria-label="Wymagania hasła"
      className={cn(
        "space-y-1.5 rounded-md border px-3.5 py-3",
        allMet
          ? "border-emerald-200/90 bg-emerald-50/50"
          : "border-slate-200/90 bg-slate-50/70",
        className
      )}
    >
      {requirements.map((requirement) => (
        <li
          key={requirement.id}
          className={cn(
            "flex items-start gap-2 text-xs leading-snug",
            requirement.met ? "text-emerald-800" : "text-slate-600"
          )}
        >
          {requirement.met ? (
            <IconCircleCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300"
              aria-hidden
            />
          )}
          <span>{requirement.label}</span>
        </li>
      ))}
    </ul>
  );
}
