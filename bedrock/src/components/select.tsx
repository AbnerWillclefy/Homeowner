import { Check, ChevronDown } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import { cn } from "../lib/cn";
import { Field, fieldClass } from "./field";
import { menuContentClass, menuItemClass } from "./menu";

export type SelectProps = {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
};

export function Select({ label, options, value, onValueChange, placeholder, hint, error, disabled }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
          {/* A Radix trigger is a button, so the label names it through aria-labelledby. */}
          <RadixSelect.Trigger
            {...control}
            className={cn(
              fieldClass(!!error),
              "flex items-center justify-between px-4 text-left data-[placeholder]:text-text-muted",
            )}
          >
            <RadixSelect.Value placeholder={placeholder} />
            <RadixSelect.Icon asChild>
              <ChevronDown aria-hidden className="size-4 shrink-0 text-text-muted" />
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
