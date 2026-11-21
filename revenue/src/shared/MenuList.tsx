import { Card } from "@homeowner/bedrock";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

const TONES = {
  brand: "bg-brand-soft text-brand",
  warning: "bg-warning-soft text-warning",
  groceries: "bg-cat-groceries-soft text-cat-groceries",
} as const;

/** A card of link rows, for a phone screen that only lists where to go (Planejar, Mais). */
export function MenuCard({ children }: { children: ReactNode }) {
  return (
    <Card variant="compact">
      <ul className="divide-y divide-border">{children}</ul>
    </Card>
  );
}

/**
 * One link row: an icon in a soft circle, the title, a one-line caption, an end (a badge or a value) and a chevron, 56px
 * tall like the artboard's `rv-menu-list`. Plain, not a Bedrock `ListRow`, which draws an `Amount` most rows do not have.
 */
export function MenuRow({ to, icon: Icon, title, caption, end, tone = "brand" }: { to: string; icon: LucideIcon; title: string; caption?: string; end?: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-14 items-center gap-3 py-2 outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="body-strong truncate">{title}</span>
          {caption && <span className="body truncate text-text-muted">{caption}</span>}
        </span>
        {end && <span className="shrink-0">{end}</span>}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-text-muted" />
      </Link>
    </li>
  );
}
