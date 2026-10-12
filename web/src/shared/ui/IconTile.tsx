import type { LucideIcon } from "lucide-react";

/** An icon on a rounded square, coloured by `className`. Decoration only: the text next to it says what it means. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-control ${className}`}>
      <Icon size={22} />
    </span>
  );
}
