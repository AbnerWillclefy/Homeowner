import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "../shared/ui/IconTile";
import { categoryStyle } from "./categoryStyle";

const MAX_EFFORT = 5;

/**
 * The Category icon on a rounded square. On a card already in the Category's pastel (`onTint`) it is a soft
 * shade of the ink; on a neutral card it carries the pastel itself. Decoration only, so the Category name
 * must be written next to it.
 */
export function CategoryTile({ category, onTint = false }: { category?: string | null; onTint?: boolean }) {
  const { icon, fill, ink } = categoryStyle(category);
  return <IconTile icon={icon} className={onTint ? "bg-current/10" : `${fill} ${ink}`} />;
}

/** Short facts as one wrapping line of icon and text pairs. */
export function FactList({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex flex-wrap gap-x-4 gap-y-1 p-0 text-sm font-semibold">{children}</ul>;
}

/** One fact; `icon` is a `FactIcon` or `EffortDots`, and the text always says the whole fact. */
export function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="my-0 flex list-none items-center gap-1.5 leading-normal">
      {icon}
      <span>{children}</span>
    </li>
  );
}

export function FactIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" size={16} className="shrink-0" />;
}

/** An Effort as five dots, filled up to its level. Decoration: the level is always written next to it. */
export function EffortDots({ effort }: { effort: number }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 gap-0.5">
      {Array.from({ length: MAX_EFFORT }, (_, point) => (
        <span key={point} className={`size-1.5 rounded-pill border border-current ${point < effort ? "bg-current" : ""}`} />
      ))}
    </span>
  );
}
