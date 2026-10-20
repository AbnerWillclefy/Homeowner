import { Slot } from "@radix-ui/react-slot";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link";

interface Props extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  /** Render the child (for example a router Link) with the button's look instead of a <button>. */
  asChild?: boolean;
  /** A square, icon-only button. Give it an aria-label. */
  icon?: boolean;
  /** Span the container's width, for a form's or a screen's main action. */
  fullWidth?: boolean;
  /**
   * The action is running: the button is disabled and busy, and a spinner takes the leading icon's place, or covers
   * the label when there is no icon. The width does not change. `disabled` still means "not available". Ignored with `asChild`, since a link cannot be busy.
   */
  pending?: boolean;
  /** An icon before the label (for example a lucide icon). The spinner replaces it while pending. Ignored with `asChild`. */
  leadingIcon?: ReactNode;
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

// The one slot for a leading icon or the spinner, 1rem square, so swapping them never moves the label.
const SLOT = "inline-flex size-4 shrink-0 items-center justify-center";

export function Button({
  variant = "primary",
  asChild = false,
  icon = false,
  fullWidth = false,
  className = "",
  type,
  pending,
  leadingIcon,
  children,
  disabled,
  ...rest
}: Props) {
  const classes = `${BASE} ${VARIANTS[variant]} ${padding(variant, icon)} ${fullWidth ? "w-full" : ""} ${className}`;
  if (asChild) {
    return (
      <Slot className={classes} {...(disabled === undefined ? {} : { disabled })} {...rest}>
        {children}
      </Slot>
    );
  }
  // The one continuous animation the "under 200ms" motion rule allows, because it carries state.
  // With reduced motion the same icon is simply static. currentColor keeps it visible in forced colours.
  const spinner = <LoaderCircle aria-hidden="true" size={16} className="motion-safe:animate-spin" />;
  // Without a leading icon the spinner covers the label, which keeps its space so the width does not change.
  const overLabel = pending === true && leadingIcon === undefined;
  return (
    <button
      type={type ?? "button"}
      className={overLabel ? `${classes} relative` : classes}
      disabled={disabled || pending === true}
      aria-busy={pending ? true : undefined}
      {...rest}
    >
      {leadingIcon !== undefined && (
        <span data-slot="leading" className={SLOT}>
          {pending ? spinner : leadingIcon}
        </span>
      )}
      {overLabel ? (
        <>
          <span className="absolute inset-0 flex items-center justify-center">{spinner}</span>
          <span className="opacity-0">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
