import type { ReactNode } from "react";
import { Card, type Tint } from "./Card";

interface Props {
  /** The number or short value, shown large. */
  value: ReactNode;
  /** What the value counts. Always text; wraps rather than truncating. */
  label: ReactNode;
  tint?: Tint;
  className?: string;
}

/** A static tile: a big value over its label. Not interactive. */
export function StatTile({ value, label, tint, className = "" }: Props) {
  return (
    <Card tint={tint} className={`flex flex-col gap-1 ${className}`}>
      <span className="text-3xl font-bold leading-tight [overflow-wrap:anywhere]">{value}</span>
      <span className="text-sm font-semibold [overflow-wrap:anywhere]">{label}</span>
    </Card>
  );
}
