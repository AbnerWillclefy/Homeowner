import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 label tabular-nums", {
  variants: {
    tone: {
      neutral: "bg-surface-hover text-text-muted",
      positive: "bg-positive-soft text-positive",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      brand: "bg-brand-soft text-brand",
      solid: "bg-positive text-on-brand",
    },
  },
  defaultVariants: { tone: "neutral" },
});

type BadgeProps = Omit<ComponentProps<"span">, "children"> &
  VariantProps<typeof badgeVariants> & {
    /** Required: the meaning lives in the words, never in colour alone. */
    children: ReactNode;
    icon?: LucideIcon;
  };

export function Badge({ tone, icon: Icon, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

export type { BadgeProps };
