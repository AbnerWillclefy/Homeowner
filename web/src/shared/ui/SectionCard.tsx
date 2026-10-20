import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile, TONES } from "./IconTile";
import { Card } from "./Card";

interface Props {
  /** Names the heading, which labels the section. */
  id: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  title: ReactNode;
  /** One short muted line under the title saying what the card is for. */
  hint?: ReactNode;
  children?: ReactNode;
}

/** A titled card on a tab: an icon tile and an h3 (the tab's title is the h2), an optional hint, then its body. */
export function SectionCard({ id, icon, tone = "accent", title, hint, children }: Props) {
  return (
    <Card as="section" aria-labelledby={id} className="mt-0 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} className={TONES[tone]} />
        <h3 id={id} className="my-0 min-w-0 flex-1 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
          {title}
        </h3>
      </div>
      {hint && <p className="my-0 text-sm text-muted">{hint}</p>}
      {children}
    </Card>
  );
}
