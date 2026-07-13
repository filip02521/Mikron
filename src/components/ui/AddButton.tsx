import { forwardRef } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export const AddButton = forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg";
    iconSize?: number;
  }
>(function AddButton(
  { children, variant = "outline", size = "md", iconSize, className, ...props },
  ref
) {
  const icon = iconSize ?? (size === "sm" ? 15 : 18);
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      {...props}
    >
      <IconPlusCircle size={icon} className="shrink-0" />
      {children}
    </Button>
  );
});
