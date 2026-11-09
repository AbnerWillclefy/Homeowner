import type { ReactNode } from "react";
import { Card } from "../../../shared/ui/Card";

interface Props {
  /** Names the heading, which labels the section. */
  id: string;
  title: ReactNode;
  /** One short muted line under the title. */
  hint?: ReactNode;
  children?: ReactNode;
}

/**
 * A titled card with no icon tile: at 320px and the largest text an icon beside the title leaves it a few letters
 * per line, so the title gets the whole width.
 */
export function FinanceCard({ id, title, hint, children }: Props) {
  return (
    <Card as="section" aria-labelledby={id} className="mt-0 flex flex-col gap-3">
      <h3 id={id} className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
        {title}
      </h3>
      {hint && <p className="my-0 text-sm text-muted">{hint}</p>}
      {children}
    </Card>
  );
}
