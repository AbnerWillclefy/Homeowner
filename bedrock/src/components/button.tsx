import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent px-4 body-strong cursor-pointer outline-none motion-safe:transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) aria-busy:cursor-progress",
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-hover",
        secondary: "bg-surface-raised text-text border-border hover:bg-surface-hover active:bg-surface-hover",
        ghost: "bg-transparent text-text hover:bg-surface-hover active:bg-surface-hover",
        danger: "bg-danger text-on-danger",
        success: "bg-positive text-on-brand",
      },
      // sm and md keep their look and get a 48px hit area from touch-target.
      size: {
        sm: "h-control-sm px-2 touch-target",
        md: "h-control-md touch-target",
        lg: "h-control-lg px-6",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = Omit<ComponentProps<"button">, "children"> &
  VariantProps<typeof buttonVariants> & {
    /** Required: a Button without text is a type error. */
    children: ReactNode;
    /** A leading icon; while loading, the spinner takes its place. */
    icon?: LucideIcon;
    /**
     * Disables the button, sets aria-busy and shows a spinner in place of the icon, so a
     * Button with an icon keeps its width; one without an icon grows by the spinner.
     */
    loading?: boolean;
    /**
     * Renders the child element instead of a <button>. On an <a>, Space does not
     * activate the link; that is native behaviour, not a bug.
     */
    asChild?: boolean;
  };

export function Button({ variant, size, icon, loading, asChild, type = "button", disabled, className, children, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const Icon = loading ? LoaderCircle : icon;
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {Icon && <Icon className={cn("size-4", loading && "motion-safe:animate-spin")} aria-hidden />}
      {children}
    </button>
  );
}

export type { ButtonProps };
