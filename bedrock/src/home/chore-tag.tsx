import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

/** The `chore-*` token suffix: `living_room` is written `living-room`. */
export type ChoreTone =
  | "kitchen" | "bathroom" | "bedroom" | "living-room" | "laundry" | "floors" | "trash" | "outdoor" | "pets" | "other";

// Every tile is a whole literal: Tailwind finds classes as complete strings, so never build them from the tone.
const tiles: Record<ChoreTone, string> = {
  kitchen: "bg-chore-kitchen-soft text-chore-kitchen",
  bathroom: "bg-chore-bathroom-soft text-chore-bathroom",
  bedroom: "bg-chore-bedroom-soft text-chore-bedroom",
  "living-room": "bg-chore-living-room-soft text-chore-living-room",
  laundry: "bg-chore-laundry-soft text-chore-laundry",
  floors: "bg-chore-floors-soft text-chore-floors",
  trash: "bg-chore-trash-soft text-chore-trash",
  outdoor: "bg-chore-outdoor-soft text-chore-outdoor",
  pets: "bg-chore-pets-soft text-chore-pets",
  other: "bg-chore-other-soft text-chore-other",
};

type ChoreSize = "sm" | "md" | "lg";
const sizes: Record<ChoreSize, { tile: string; icon: string }> = {
  sm: { tile: "size-6 rounded-sm", icon: "size-3.5" },
  md: { tile: "size-8 rounded-md", icon: "size-4" },
  lg: { tile: "size-10 rounded-md", icon: "size-5" },
};

type ChoreCategory = { tone: ChoreTone; icon: LucideIcon };

/** The bare tile, for rows that write the name elsewhere. Decorative. */
export function ChoreIcon({ category, size = "md", className }: { category: ChoreCategory; size?: ChoreSize; className?: string }) {
  const Icon = category.icon;
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center", sizes[size].tile, tiles[category.tone], className)}>
      <Icon className={sizes[size].icon} />
    </span>
  );
}

/** A Chore Category: its icon and its name, which always shows as text. */
export function ChoreTag({ category, label, size = "md" }: { category: ChoreCategory; label: string; size?: ChoreSize }) {
  return (
    <span className="inline-flex items-center gap-2">
      <ChoreIcon category={category} size={size} />
      <span className="label text-text-muted">{label}</span>
    </span>
  );
}

export type { ChoreCategory, ChoreSize };
