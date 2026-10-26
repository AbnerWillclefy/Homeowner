import type { ComponentProps } from "react";

type Variant = "primary" | "secondary";

// Whole class strings, so Tailwind finds them. min-h-11 keeps the 44px target.
const VARIANTS: Record<Variant, string> = {
  primary: "border-accent bg-accent text-accent-contrast",
  secondary: "border-border bg-surface-raised text-text",
};

interface Props extends ComponentProps<"button"> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", type, ...rest }: Props) {
  return (
    <button
      type={type ?? "button"}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill border px-5 py-2 font-semibold motion-safe:transition-colors motion-safe:duration-150 disabled:cursor-not-allowed disabled:border-dashed disabled:border-border disabled:bg-surface disabled:text-muted ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
