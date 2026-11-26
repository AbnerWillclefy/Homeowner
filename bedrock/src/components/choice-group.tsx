import { Check } from "lucide-react";
import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "../lib/cn";

type Group = { name: string; value: string | undefined; onValueChange: (value: string) => void; onHero?: boolean };
const GroupContext = createContext<Group | null>(null);

type ChoiceGroupProps = {
  /** Required: the question the choices answer; the group is named from it. */
  label: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  /** Drawn on a hero card: a dark wash on the green instead of a surface, so the hero's ink stays readable in both themes. */
  onHero?: boolean;
};

type ChoiceProps = {
  value: string;
  /** Required: the choice's text. */
  label: string;
  /** A second line in muted text. */
  hint?: string;
  /** A visual before the text (an icon); decorative, so it stays out of the accessible name. */
  leading?: ReactNode;
  disabled?: boolean;
};

/** Large tap choices on native radios: one question, one answer. Arrow keys move between them, as the browser does. */
export function ChoiceGroup({ label, value, onValueChange, children, className, onHero }: ChoiceGroupProps) {
  const name = useId();
  return (
    <GroupContext.Provider value={{ name, value, onValueChange, onHero }}>
      <div role="radiogroup" aria-label={label} className={cn("grid gap-2", className)}>
        {children}
      </div>
    </GroupContext.Provider>
  );
}

export function Choice({ value, label, hint, leading, disabled }: ChoiceProps) {
  const group = useContext(GroupContext);
  if (!group) throw new Error("Choice must be inside a ChoiceGroup");
  const checked = group.value === value;
  const onHero = group.onHero;
  return (
    <label
      className={cn(
        // m-0: the group's gap is the only space between choices, whatever margin a host app gives every label.
        "m-0 flex min-h-control-lg cursor-pointer items-center gap-4 rounded-md border px-4 py-2 body-strong",
        "motion-safe:transition-colors duration-(--duration-fast)",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
        onHero
          ? // Checked turns to the hero's ink, so the swap of light and dark says "selected" beyond the hue.
            cn("border-transparent", checked ? "bg-on-hero text-hero" : "bg-[rgb(0_0_0/0.24)] text-on-hero hover:bg-[rgb(0_0_0/0.32)] active:bg-[rgb(0_0_0/0.32)]")
          : // The check icon and the heavier border say "selected" beyond the colour.
            "border-border-strong bg-surface text-text hover:bg-surface-hover active:bg-surface-hover has-checked:border-brand has-checked:bg-brand-soft has-checked:ring-1 has-checked:ring-brand",
        "has-disabled:cursor-not-allowed has-disabled:opacity-(--opacity-disabled)",
      )}
    >
      <input type="radio" className="sr-only" name={group.name} value={value} checked={checked} disabled={disabled} onChange={() => group.onValueChange(value)} />
      {leading && (
        <span aria-hidden="true" className="shrink-0">
          {leading}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        {label}
        {hint && <span className={cn("caption", onHero ? (checked ? "text-hero" : "text-on-hero-muted") : "text-text-muted")}>{hint}</span>}
      </span>
      <span aria-hidden="true" className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border",
          onHero ? (checked ? "border-hero bg-hero text-on-hero" : "border-on-hero-muted") : checked ? "border-brand bg-brand text-on-brand" : "border-border-strong",
        )}>
        {checked && <Check className="size-4" />}
      </span>
    </label>
  );
}

export type { ChoiceGroupProps, ChoiceProps };
