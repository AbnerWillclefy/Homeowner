import { cva } from "class-variance-authority";
import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

const bannerVariants = cva(
  "grid min-h-control-lg grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-md py-2 pr-2 pl-4 text-text body",
  {
    variants: {
      tone: {
        danger: "bg-danger-soft",
        warning: "bg-warning-soft",
        neutral: "bg-surface-hover",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const tones = {
  danger: { role: "alert", icon: CircleAlert, color: "text-danger" },
  warning: { role: "status", icon: TriangleAlert, color: "text-warning" },
  neutral: { role: "status", icon: Info, color: "text-text-muted" },
} as const;

type BannerProps = Omit<ComponentProps<"div">, "children" | "role"> & {
  tone?: keyof typeof tones;
  /** Required: the message. The tone is in the words, never in colour alone. */
  children: ReactNode;
  /** Overrides the tone's default icon. */
  icon?: LucideIcon;
  /** Usually a `<Button variant="ghost" size="sm">`. */
  action?: ReactNode;
};

/**
 * `danger` is a live region with `role="alert"` (assertive); the other tones use `role="status"` (polite).
 * A screen reader announces a live region's content when it is inserted, so mount the Banner when the
 * error happens rather than rendering it hidden and toggling it. It has no close button: it leaves when its cause does.
 */
export function Banner({ tone = "neutral", icon, action, className, children, ...props }: BannerProps) {
  const { role, icon: DefaultIcon, color } = tones[tone];
  const Icon = icon ?? DefaultIcon;
  return (
    <div role={role} className={cn(bannerVariants({ tone }), className)} {...props}>
      <Icon className={cn("size-4", color)} aria-hidden />
      <p>{children}</p>
      {action}
    </div>
  );
}

export type { BannerProps };
