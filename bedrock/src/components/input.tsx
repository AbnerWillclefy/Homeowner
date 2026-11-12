import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { Field, fieldClass } from "./field";

export type InputProps = Omit<ComponentProps<"input">, "id"> & { label: string; hint?: string; error?: string };

export function Input({ label, hint, error, className, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => <input {...rest} {...control} className={cn(fieldClass(!!error), className)} />}
    </Field>
  );
}
