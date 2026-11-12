import { Switch as SwitchPrimitive } from "radix-ui";
import { useId, type ComponentProps } from "react";
import { cn } from "../lib/cn";

type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, "id" | "children" | "aria-label"> & {
  /** Required: what is on, tied to the switch by a native label. */
  label: string;
};

export function Switch({ label, className, ...props }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex min-h-control-lg items-center justify-between gap-4">
      <label htmlFor={id} className="body text-text">
        {label}
      </label>
      <SwitchPrimitive.Root
        id={id}
        className={cn(
          "touch-target inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-sunken outline-none motion-safe:transition-colors duration-(--duration-base) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) data-[state=checked]:border-brand data-[state=checked]:bg-brand",
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-4 translate-x-1 rounded-full bg-text-muted motion-safe:transition-transform duration-(--duration-base) data-[state=checked]:translate-x-5 data-[state=checked]:bg-on-brand" />
      </SwitchPrimitive.Root>
    </div>
  );
}

export type { SwitchProps };
