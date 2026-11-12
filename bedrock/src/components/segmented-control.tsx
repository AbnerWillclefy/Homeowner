import { ToggleGroup } from "radix-ui";
import { cn } from "../lib/cn";

export type SegmentedControlProps = {
  /** The group's accessible name. */
  label: string;
  /** 2 to 5 short options. */
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  /** Full width, items share the space. */
  block?: boolean;
};

export function SegmentedControl({ label, options, value, onValueChange, block }: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type="single"
      loop
      aria-label={label}
      value={value}
      // Radix sends "" when the active item is pressed again; one option stays selected.
      onValueChange={(next) => next && onValueChange(next)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface-sunken p-1",
        block && "flex w-full",
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          // shortcut: active pill fades instead of sliding, add a measured sliding indicator if design asks
          className={cn(
            "touch-target label h-control-sm rounded-full px-4 text-text-muted outline-none",
            "motion-safe:transition-colors duration-(--duration-base) ease-standard",
            "hover:bg-surface-hover active:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus",
            "data-[state=on]:bg-surface-raised data-[state=on]:text-text data-[state=on]:shadow-[0_0_0_1px_var(--border)]",
            block && "flex-1",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
