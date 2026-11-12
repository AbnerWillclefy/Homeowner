import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpRight } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const cardVariants = cva("relative flex flex-col gap-4 border text-text", {
  variants: {
    variant: {
      default: "rounded-lg border-border bg-surface p-6 shadow-(--shadow-card)",
      compact: "rounded-lg border-border bg-surface p-4 shadow-(--shadow-card)",
      // Redefining the text tokens recolours every Amount and label inside, with no prop.
      hero: "rounded-xl border-transparent bg-hero p-6 [--text-muted:var(--on-hero-muted)] [--text:var(--on-hero)]",
    },
    interactive: {
      true: "cursor-pointer outline-none motion-safe:transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      false: "",
    },
  },
  // Hero keeps its --on-hero text, so a surface-hover background would wash it out.
  compoundVariants: [
    { interactive: true, variant: ["default", "compact"], className: "hover:bg-surface-hover active:bg-surface-hover" },
    { interactive: true, variant: "hero", className: "hover:brightness-95 active:brightness-95" },
  ],
  defaultVariants: { variant: "default", interactive: false },
});

type CardProps = ComponentProps<"div"> &
  Pick<VariantProps<typeof cardVariants>, "variant"> & {
    /**
     * Makes the single child (an <a> or router Link) the card, with the arrow cue. An interactive
     * card holds no buttons or links inside: nested interactive content is invalid. Not a
     * <button>: the Card parts are divs, which a button cannot hold.
     */
    asChild?: boolean;
  };

export function Card({ variant, asChild, className, children, ...props }: CardProps) {
  const classes = cn(cardVariants({ variant, interactive: asChild }), className);
  if (!asChild) {
    return (
      <div className={classes} {...props}>
        {children}
      </div>
    );
  }
  // Slottable marks the consumer's element; the arrow lands inside it as a sibling of its content.
  return (
    <Slot.Root className={classes} {...props}>
      <Slot.Slottable>{children}</Slot.Slottable>
      <ArrowUpRight aria-hidden className="absolute right-4 top-4 size-4 text-text-muted" />
    </Slot.Root>
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

/** A plain element, not a heading: the label names the subject, it is not a title. */
export function CardLabel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("card-label text-text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 border-t border-border pt-4", className)} {...props} />;
}

export type { CardProps };
