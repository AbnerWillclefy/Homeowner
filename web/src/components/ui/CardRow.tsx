import type { ReactNode } from "react";
import { Card } from "./Card";

interface Props {
  /** A Category id picks the pastel of the card, as on `Card`. */
  category?: string;
  /** Usually a `CategoryGlyph`. */
  glyph?: ReactNode;
  /** Buttons or links on the right. They wrap under the content when the width would crush the text. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A card with information on the left and actions on the right. Presentational only. */
export function CardRow({ category, glyph, actions, className = "", children }: Props) {
  return (
    <Card category={category} className={`flex flex-wrap items-start gap-4 ${className}`}>
      {glyph}
      <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">{children}</div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </Card>
  );
}
