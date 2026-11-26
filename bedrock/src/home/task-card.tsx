import { Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../components/badge";
import { Button, type ButtonProps } from "../components/button";
import { Menu, type MenuProps } from "../components/menu";
import { cn } from "../lib/cn";
import { ChoreIcon, type ChoreCategory } from "./chore-tag";
import { Effort, type EffortProps } from "./effort";

type TaskAction = {
  label: string;
  onClick: () => void;
  variant?: ButtonProps["variant"];
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Names the Task too, such as "Aceitar Lavar a louça"; it starts with `label` so voice control finds the button. */
  ariaLabel?: string;
};

type TaskCardProps = {
  /** The Category's tone and icon; `categoryLabel` is its name, always written in the caption. */
  category: ChoreCategory;
  categoryLabel: string;
  /** The Chore's name, one line. */
  name: string;
  effort: EffortProps;
  /** Such as "Hoje" or "Concluída às 9:02". */
  caption?: string;
  /** The one-line why. */
  why: string;
  /** Such as "Assumida": a brand badge at the start of the caption. */
  status?: string;
  /** Dashed, the name struck through. */
  done?: boolean;
  /** Opens the whole Task. Without it the name is plain text. */
  onOpen?: () => void;
  /** The ⋯ menu. The consumer decides which items a Task has. */
  menu?: MenuProps;
  /** Shown in place of the menu, such as another Resident's Avatar. */
  trailing?: ReactNode;
  /** Buttons for the Task's state; the consumer decides which. One fills the row, two share it. */
  actions?: TaskAction[];
};

/** One Task of the Day Plan. Presentational: which actions it has is the caller's decision. */
export function TaskCard({ category, categoryLabel, name, effort, caption, why, status, done, onOpen, menu, trailing, actions = [] }: TaskCardProps) {
  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 rounded-lg border p-4",
        done ? "border-dashed border-border bg-transparent" : "border-border bg-surface motion-safe:transition-colors duration-(--duration-fast) hover:bg-surface-hover",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
        <ChoreIcon category={category} size="lg" />
        <div className="flex min-w-0 flex-col">
          <h3 className={cn("truncate text-[16px] leading-6 font-semibold", done && "text-text-muted line-through")}>
            {onOpen ? (
              // The button's ::after covers the card, so tapping anywhere but the buttons above it opens the Task.
              <button type="button" onClick={onOpen} className="max-w-full cursor-pointer truncate text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus">
                {name}
              </button>
            ) : (
              name
            )}
          </h3>
          <p className="flex items-center gap-2 overflow-hidden whitespace-nowrap caption text-text-muted">
            {status && <Badge tone="brand" className="shrink-0">{status}</Badge>}
            <span className="truncate">{categoryLabel}</span>
            <Effort {...effort} />
            {caption && <span className="truncate">{caption}</span>}
          </p>
        </div>
        {(menu || trailing) && <div className="relative z-10">{menu ? <Menu {...menu} /> : trailing}</div>}
      </div>
      <p className="flex items-start gap-2 body text-text-muted">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="line-clamp-1">{why}</span>
      </p>
      {actions.length > 0 && (
        <div className={cn("relative z-10 grid gap-2", actions.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {actions.map(({ label, onClick, ariaLabel, ...rest }) => (
            <Button key={label} size="lg" onClick={onClick} aria-label={ariaLabel} {...rest}>
              {label}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}

export type { TaskAction, TaskCardProps };
