import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { useId, type ComponentProps } from "react";
import { cn } from "../lib/cn";

type CheckboxProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, "id" | "children" | "aria-label"> & {
  /** Required: what is checked, tied to the box by a native label. */
  label: string;
  /** Hides the label visually (it stays for screen readers) when a row's own text already names it. */
  hideLabel?: boolean;
};

export function Checkbox({ label, hideLabel, className, ...props }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex min-h-control-lg items-center gap-2">
      <CheckboxPrimitive.Root
        id={id}
        className={cn(
          "touch-target inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border-strong bg-surface-sunken text-on-brand outline-none motion-safe:transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) data-[state=checked]:border-brand data-[state=checked]:bg-brand",
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-4" strokeWidth={3} aria-hidden="true" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "body text-text"}>
        {label}
      </label>
    </div>
  );
}

export type { CheckboxProps };
