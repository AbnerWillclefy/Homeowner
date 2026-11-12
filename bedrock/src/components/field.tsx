import { CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "../lib/cn";

type ControlProps = { id: string; "aria-labelledby": string;"aria-describedby"?: string; "aria-invalid"?: true };

/** Shared by Input, MoneyInput and Select: label above, hint below, an error that replaces the hint. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const uid = useId();
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label id={`${uid}-label`} htmlFor={uid} className="label text-text-muted">
        {label}
      </label>
      {children({ id: uid, "aria-labelledby": `${uid}-label`, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={errorId} role="alert" className="caption flex items-start gap-1 text-danger">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="caption text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** pointer-coarse:text-base is 16px on touch screens: iOS Safari zooms into fields under 16px on focus. */
export const fieldClass = (invalid: boolean) =>
  cn(
    "body w-full rounded-md border bg-surface-sunken px-3 text-text placeholder:text-text-muted",
    "h-control-md pointer-coarse:h-control-lg pointer-coarse:text-base",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:opacity-(--opacity-disabled)",
    invalid ? "border-danger" : "border-border-strong",
  );
