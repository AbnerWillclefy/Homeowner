import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

export type PillVariant = "primary" | "secondary" | "danger";

interface Props extends ComponentProps<"button"> {
  variant?: PillVariant;
  /** Render the child (for example a router Link) with the button's look instead of a <button>. */
  asChild?: boolean;
  /** A square, icon-only button: a real button with an edge, in contrast to a decorative glyph. */
  icon?: boolean;
}

// Whole class strings, so Tailwind finds them. Every variant keeps a border (forced-colors mode);
// danger also carries a thick edge so it is not told apart by colour alone.
const VARIANTS: Record<PillVariant, string> = {
  primary: "border-accent bg-accent text-accent-contrast",
  secondary: "border-border bg-surface-raised text-text",
  danger: "border-2 border-danger bg-surface-raised text-danger font-bold",
};

export function PillButton({ variant = "primary", asChild = false, icon = false, className = "", type, ...rest }: Props) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      {...(asChild ? {} : { type: type ?? "button" })}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-pill border py-2 text-center font-semibold [overflow-wrap:anywhere] motion-safe:transition-colors motion-safe:duration-150 disabled:cursor-not-allowed disabled:border-dashed disabled:border-border disabled:bg-surface disabled:text-muted ${icon ? "size-11 px-0" : "px-5"} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
