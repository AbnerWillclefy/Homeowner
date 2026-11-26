import type { LucideIcon } from "lucide-react";

// Whole class strings, so Tailwind finds them. The design's `hm-icotile`.
const TONES = {
  neutral: "bg-surface-hover text-text-muted",
  brand: "bg-brand-soft text-brand",
  danger: "bg-danger-soft text-danger",
} as const;

/** The 2.5rem icon tile that leads a Row of Home. Decoration only: the Row's title says what it is. */
export function RowTile({ icon: Icon, tone = "neutral" }: { icon: LucideIcon; tone?: keyof typeof TONES }) {
  return (
    <span aria-hidden="true" className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md ${TONES[tone]}`}>
      <Icon size={20} />
    </span>
  );
}
