import type { LucideIcon } from "lucide-react";
import { Button } from "./button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  message: string;
} & (
  | { kind?: "first-use"; action?: { label: string; onClick: () => void } }
  | { kind: "no-results"; action?: { label: string; onClick: () => void } }
  // Done is a success, not an absence: nothing to start, so passing an action is a type error.
  | { kind: "done"; action?: never }
);

/** What shows when there is no data yet. The title is a paragraph, not a heading, so it fits any page outline. */
export function EmptyState({ icon: Icon, title, message, kind = "first-use", action }: EmptyStateProps) {
  const done = kind === "done";
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className={`flex size-12 items-center justify-center rounded-full ${done ? "bg-positive-soft text-positive" : "bg-brand-soft text-brand"}`}>
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="section-title">{title}</p>
      <p className="body max-w-[360px] text-text-muted">{message}</p>
      {action && (
        <Button variant={kind === "no-results" ? "secondary" : "primary"} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
