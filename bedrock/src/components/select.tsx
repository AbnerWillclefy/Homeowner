import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import { cn } from "../lib/cn";
import { Field, fieldClass } from "./field";
import { menuContentClass, menuItemClass } from "./menu";

export type SelectProps = {
  label: string;
  hideLabel?: boolean;
  options: { value: string; label: string }[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** A leading icon; it also draws the trigger as a `secondary` button instead of a field (PageHeader's period). */
  icon?: LucideIcon;
};

export function Select({ label, hideLabel, options, value, onValueChange, placeholder, hint, error, disabled, icon: Icon }: SelectProps) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error}>
      {(control) => (
        <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
          {/* A Radix trigger is a button, so the label names it through aria-labelledby. */}
          <RadixSelect.Trigger
            {...control}
            className={cn(
              fieldClass(!!error),
              "flex items-center justify-between px-4 text-left data-[placeholder]:text-text-muted",
              Icon && "w-auto gap-2 border-border bg-surface-raised body-strong hover:bg-surface-hover max-tablet:w-full max-tablet:justify-start",
            )}
          >
            {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
            <RadixSelect.Value placeholder={placeholder} />
            <RadixSelect.Icon asChild>
              <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-text-muted", Icon && "max-tablet:ml-auto")} />
            </RadixSelect.Icon>
          </RadixSelect.Trigger>
          <RadixSelect.Portal>
            <RadixSelect.Content
              position="popper"
              sideOffset={4}
              className={cn(menuContentClass, "max-h-(--radix-select-content-available-height)")}
            >
              <RadixSelect.Viewport>
                {options.map((o) => (
                  <RadixSelect.Item key={o.value} value={o.value} className={menuItemClass}>
                    <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator className="ml-auto">
                      <Check aria-hidden className="size-4 text-brand" />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
      )}
    </Field>
  );
}
