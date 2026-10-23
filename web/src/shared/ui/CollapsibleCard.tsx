import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card } from "./Card";
import { IconTile, TONES } from "./IconTile";

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
  /**
   * What the icon means, for a screen reader. Rendered `hidden` outside the heading (so it does not name the
   * region) and added to the button's description. Without it nothing changes.
   */
  iconLabel?: string;
  /** The heading level: 4 when the card sits under an h3 group heading. Never skip a level. */
  headingLevel?: 3 | 4;
  /** Extra classes for the card, for the spacing around it. */
  className?: string;
  children?: ReactNode;
}

/**
 * A SectionCard that folds. The head row (icon tile, title, hint, chevron) is one full-width native button inside the
 * h3, so the whole row toggles it, with Enter and Space for free (the WAI-ARIA disclosure pattern; ADR 0007, native
 * first). The body stays mounted when closed, only `hidden`, so nothing inside re-runs effects and a pending blur save
 * is not lost. The open state is local: leaving the screen closes it again.
 */
export function CollapsibleCard({
  id,
  icon,
  tone = "accent",
  title,
  hint,
  defaultOpen = false,
  iconLabel,
  headingLevel = 3,
  className = "",
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${id}-body`;
  const titleId = `${id}-title`;
  const hintId = `${id}-hint`;
  const iconId = `${id}-icon`;
  const Heading = `h${headingLevel}` as const;
  const describedBy = [hint ? hintId : null, iconLabel ? iconId : null].filter(Boolean).join(" ") || undefined;

  return (
    <Card as="section" aria-labelledby={id} className={`mt-0 flex flex-col gap-3 ${className}`}>
      <Heading id={id} className="my-0 text-lg font-bold leading-snug">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-labelledby={titleId}
          aria-describedby={describedBy}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-start gap-3 rounded-control bg-transparent p-0 text-start font-[inherit] text-inherit"
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
      </Heading>
      {iconLabel && (
        <span id={iconId} hidden>
          {iconLabel}
        </span>
      )}
      <div id={bodyId} hidden={!open} className="flex flex-col gap-3">
        {children}
      </div>
    </Card>
  );
}
