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

/** The `chore-*` token suffix in Bedrock's tokens.css (`living_room` is `living-room`). */
export type ChoreTone =
  | "kitchen" | "bathroom" | "bedroom" | "living-room" | "laundry" | "floors" | "trash" | "outdoor" | "pets" | "other";

export interface ChoreCategory {
  /** The id resolved to one the app knows: an unknown, empty or missing id is "other". */
  id: string;
  tone: ChoreTone;
  icon: LucideIcon;
}

const BY_CATEGORY: Record<string, { tone: ChoreTone; icon: LucideIcon }> = {
  kitchen: { tone: "kitchen", icon: CookingPot },
  bathroom: { tone: "bathroom", icon: Bath },
  bedroom: { tone: "bedroom", icon: BedDouble },
  living_room: { tone: "living-room", icon: Sofa },
  laundry: { tone: "laundry", icon: Shirt },
  floors: { tone: "floors", icon: Brush },
  trash: { tone: "trash", icon: Trash2 },
  outdoor: { tone: "outdoor", icon: Trees },
  pets: { tone: "pets", icon: PawPrint },
  other: { tone: "other", icon: Shapes },
};

/** A Category id's `chore-*` tone and icon. The raw id never reaches the screen: unknown becomes "other". */
export function choreCategory(id: string | null | undefined): ChoreCategory {
  const known = id && Object.hasOwn(BY_CATEGORY, id) ? id : "other";
  return { id: known, ...BY_CATEGORY[known]! };
}
