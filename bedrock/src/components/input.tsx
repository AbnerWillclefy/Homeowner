import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { Field, fieldClass } from "./field";

export type InputProps = Omit<ComponentProps<"input">, "id"> & { label: string; hideLabel?: boolean; hint?: string; error?: string };

export function Input({ label, hideLabel, hint, error, className, ...rest }: InputProps) {
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error}>
      {(control) => <input {...rest} {...control} className={cn(fieldClass(!!error), className)} />}
    </Field>
  );
}
