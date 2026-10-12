import type { HTMLAttributes } from "react";

export interface Tint {
  fill: string;
  ink: string;
}

const NEUTRAL: Tint = { fill: "bg-surface-raised", ink: "text-text" };

interface Props extends HTMLAttributes<HTMLElement> {
  /** Render a <section> (give it aria-labelledby) when the card is a landmark of its own. */
  as?: "div" | "section";
  /** Background and text classes, for example a Category's pastel. Leave it out for the neutral card. */
  tint?: Tint;
}

/** A rounded surface. The edge keeps it visible in forced-colors mode. */
export function Card({ as: Tag = "div", tint = NEUTRAL, className = "", ...rest }: Props) {
  const { fill, ink } = tint;
  return <Tag className={`box-border rounded-card border border-border p-4 ${fill} ${ink} ${className}`} {...rest} />;
}
