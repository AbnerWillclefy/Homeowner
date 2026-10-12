import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link";

interface Props extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  /** Render the child (for example a router Link) with the button's look instead of a <button>. */
  asChild?: boolean;
  /** A square, icon-only button. Give it an aria-label. */
  icon?: boolean;
}

// Whole class strings, so Tailwind finds them. min-h/min-w keep the 44px target on every variant.
const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 [overflow-wrap:anywhere] motion-safe:transition-colors motion-safe:duration-150 disabled:cursor-not-allowed";

// Pills keep a border (forced-colors mode) and a disabled pill is dashed as well as muted.
const PILL =
  "rounded-pill border py-2 text-center font-semibold disabled:border-dashed disabled:border-border disabled:bg-surface disabled:text-muted";

// Danger also carries a thick edge so it is not told apart by colour alone.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${PILL} border-accent bg-accent text-accent-contrast`,
  secondary: `${PILL} border-border bg-surface-raised text-text`,
  danger: `${PILL} border-2 border-danger bg-surface-raised text-danger font-bold`,
  // No visible edge, for a control in a bar, such as Back.
  ghost: "rounded-pill border border-transparent text-text disabled:text-muted",
  // A text-style button, for example "Sign up" inside a sentence.
  link: "text-accent underline underline-offset-[0.2em] disabled:text-muted disabled:decoration-dashed",
};

function padding(variant: ButtonVariant, icon: boolean): string {
  if (icon) return "size-11 px-0";
  return variant === "link" ? "px-1" : "px-5";
}

export function Button({ variant = "primary", asChild = false, icon = false, className = "", type, ...rest }: Props) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      {...(asChild ? {} : { type: type ?? "button" })}
      className={`${BASE} ${VARIANTS[variant]} ${padding(variant, icon)} ${className}`}
      {...rest}
    />
  );
}
