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
import { CATEGORY_KEYS } from "../../profile/labels";

export type CategoryTone = "peach" | "mint" | "lavender" | "blue" | "yellow" | "salmon" | "neutral";

export interface CategoryStyle {
  tone: CategoryTone;
  /** Whole class strings: Tailwind scans for literal names, so they are never built from parts. */
  fill: string;
  ink: string;
  icon: LucideIcon;
}

const TONES: Record<CategoryTone, Pick<CategoryStyle, "fill" | "ink">> = {
  peach: { fill: "bg-cat-peach", ink: "text-cat-peach-ink" },
  mint: { fill: "bg-cat-mint", ink: "text-cat-mint-ink" },
  lavender: { fill: "bg-cat-lavender", ink: "text-cat-lavender-ink" },
  blue: { fill: "bg-cat-blue", ink: "text-cat-blue-ink" },
  yellow: { fill: "bg-cat-yellow", ink: "text-cat-yellow-ink" },
  salmon: { fill: "bg-cat-salmon", ink: "text-cat-salmon-ink" },
  neutral: { fill: "bg-surface-raised", ink: "text-text" },
};

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
 * The id to name and style a card by: a Category the app has a name for, otherwise "other". The API can send an
 * id the app does not know (or none, from an older version), and the raw id must never reach the screen.
 */
export function knownCategory(id: string | null | undefined): string {
  return id && Object.hasOwn(CATEGORY_KEYS, id) ? id : "other";
}

/** The pastel and icon for a Category id; an unknown, empty or missing id is neutral, like "other". */
export function categoryStyle(id: string | null | undefined): CategoryStyle {
  const entry = id && Object.hasOwn(BY_CATEGORY, id) ? BY_CATEGORY[id]! : BY_CATEGORY["other"]!;
  return { tone: entry.tone, icon: entry.icon, ...TONES[entry.tone] };
}
