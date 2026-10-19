import {
  Bath,
  BedDouble,
  Brush,
  CookingPot,
  PawPrint,
  Shapes,
  Shirt,
  Sofa,
  Trash2,
  Trees,
  type LucideIcon,
} from "lucide-react";

export type CategoryTone = "peach" | "mint" | "lavender" | "blue" | "yellow" | "salmon" | "neutral";

export interface CategoryStyle {
  /** The id resolved to one the app knows: an unknown, empty or missing id is "other". */
  id: string;
  tone: CategoryTone;
  /** Whole class strings: Tailwind scans for literal names, so they are never built from parts. */
  fill: string;
  ink: string;
  icon: LucideIcon;
}

export const TONES: Record<CategoryTone, Pick<CategoryStyle, "fill" | "ink">> = {
  peach: { fill: "bg-cat-peach", ink: "text-cat-peach-ink" },
  mint: { fill: "bg-cat-mint", ink: "text-cat-mint-ink" },
  lavender: { fill: "bg-cat-lavender", ink: "text-cat-lavender-ink" },
  blue: { fill: "bg-cat-blue", ink: "text-cat-blue-ink" },
  yellow: { fill: "bg-cat-yellow", ink: "text-cat-yellow-ink" },
  salmon: { fill: "bg-cat-salmon", ink: "text-cat-salmon-ink" },
  neutral: { fill: "bg-surface-raised", ink: "text-text" },
};

/** The six pastels, never neutral: the Category pastels and the initials Avatar share them. */
export const PASTEL_TONES = (Object.keys(TONES) as CategoryTone[]).filter((tone) => tone !== "neutral");

const BY_CATEGORY: Record<string, { tone: CategoryTone; icon: LucideIcon }> = {
  kitchen: { tone: "peach", icon: CookingPot },
  bathroom: { tone: "mint", icon: Bath },
  bedroom: { tone: "lavender", icon: BedDouble },
  living_room: { tone: "lavender", icon: Sofa },
  laundry: { tone: "blue", icon: Shirt },
  floors: { tone: "blue", icon: Brush },
  trash: { tone: "yellow", icon: Trash2 },
  outdoor: { tone: "yellow", icon: Trees },
  pets: { tone: "salmon", icon: PawPrint },
  other: { tone: "neutral", icon: Shapes },
};

/**
 * The id, pastel and icon for a Category id. The API can send an id the app does not know (or none, from an
 * older version), and the raw id must never reach the screen, so it resolves to "other", the neutral style.
 */
export function categoryStyle(id: string | null | undefined): CategoryStyle {
  const known = id && Object.hasOwn(BY_CATEGORY, id) ? id : "other";
  const entry = BY_CATEGORY[known]!;
  return { id: known, tone: entry.tone, icon: entry.icon, ...TONES[entry.tone] };
}
