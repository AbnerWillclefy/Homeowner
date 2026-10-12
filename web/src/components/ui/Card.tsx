import type { HTMLAttributes } from "react";
import { categoryStyle } from "./categoryStyle";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** A Category id picks its pastel; leave it out (or pass an unknown id) for the neutral card. */
  category?: string;
}

/** A rounded surface. The edge keeps it visible in forced-colors mode. */
export function Card({ category, className = "", ...rest }: Props) {
  const { fill, ink } = categoryStyle(category);
  return (
    <div
      className={`box-border rounded-card border border-border p-4 ${fill} ${ink} ${className}`}
      {...rest}
    />
  );
}
