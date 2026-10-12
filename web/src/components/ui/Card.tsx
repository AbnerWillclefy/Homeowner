import type { HTMLAttributes } from "react";
import { categoryStyle } from "./categoryStyle";

interface Props extends HTMLAttributes<HTMLElement> {
  /** Render a <section> (give it aria-labelledby) when the card is a landmark of its own. */
  as?: "div" | "section";
  /** A Category id picks its pastel; leave it out (or pass an unknown id) for the neutral card. */
  category?: string;
}

/** A rounded surface. The edge keeps it visible in forced-colors mode. */
export function Card({ as: Tag = "div", category, className = "", ...rest }: Props) {
  const { fill, ink } = categoryStyle(category);
  return <Tag className={`box-border rounded-card border border-border p-4 ${fill} ${ink} ${className}`} {...rest} />;
}
