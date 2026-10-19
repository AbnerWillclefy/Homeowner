import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card } from "./Card";
import { IconTile } from "./IconTile";

// Whole class strings, so Tailwind finds them. Same tones as SectionCard.
const TONES = {
  accent: "bg-accent/10 text-accent",
  danger: "bg-danger/10 text-danger",
} as const;

interface Props {
  /** Names the heading, which labels the section; the body is `${id}-body`. */
  id: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  title: ReactNode;
  /** One short muted line under the title saying what the card is for. */
  hint?: ReactNode;
  /** Whether the card starts open. Closed by default; the state is never remembered. */
  defaultOpen?: boolean;
  children?: ReactNode;
}

/**
 * A SectionCard that folds. The head row (icon tile, title, hint, chevron) is one full-width native button inside the
 * h3, so the whole row toggles it, with Enter and Space for free (the WAI-ARIA disclosure pattern; ADR 0007, native
 * first). The body stays mounted when closed, only `hidden`, so nothing inside re-runs effects and a pending blur save
 * is not lost. The open state is local: leaving the screen closes it again.
 */
export function CollapsibleCard({ id, icon, tone = "accent", title, hint, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${id}-body`;
  const titleId = `${id}-title`;
  const hintId = `${id}-hint`;

  return (
    <Card as="section" aria-labelledby={id} className="mt-0 flex flex-col gap-3">
      <h3 id={id} className="my-0 text-lg font-bold leading-snug">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-labelledby={titleId}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center gap-3 rounded-control bg-transparent p-0 text-start font-[inherit] text-inherit"
        >
          <IconTile icon={icon} className={TONES[tone]} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span id={titleId} className="[overflow-wrap:anywhere]">
              {title}
            </span>
            {hint && (
              <span id={hintId} className="text-sm font-normal text-muted [overflow-wrap:anywhere]">
                {hint}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            size={22}
            className={`shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="flex flex-col gap-3">
        {children}
      </div>
    </Card>
  );
}
