import type { ComponentProps, ReactNode } from "react";
import { Card } from "./Card";

interface Props extends Omit<ComponentProps<typeof Card>, "children"> {
  /** Usually a `CategoryGlyph`. */
  glyph?: ReactNode;
  /** Buttons or links on the right. They wrap under the content when the width would crush the text. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * A card with information on the left and actions on the right. Presentational only. Pass `as="section"` with
 * `aria-labelledby` when the card is a landmark of its own, as on `Card`.
 */
export function CardRow({ glyph, actions, className = "", children, ...card }: Props) {
  return (
    <Card {...card} className={`flex flex-wrap items-start gap-4 ${className}`}>
      {glyph}
      <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">{children}</div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </Card>
  );
}
