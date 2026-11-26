import { Avatar as BedrockAvatar } from "@homeowner/bedrock";
import { avatarTone, type AvatarSource } from "../logic/avatarView";
import type { ChoreTone } from "../../chores/logic/choreCategory";

type Size = "md" | "lg";

interface Props {
  /** Who to draw, or null for the neutral placeholder (the list is loading, or the Resident is unknown). */
  resident: AvatarSource | null;
  /** `md` sits in a list row; `lg` leads a screen about one person. */
  size?: Size;
}

// Whole class strings, so Tailwind finds them. The soft fill and the full tone as ink, as the Chore tiles.
const TONES: Record<ChoreTone, { fill: string; ink: string }> = {
  kitchen: { fill: "bg-chore-kitchen-soft", ink: "text-chore-kitchen" },
  bathroom: { fill: "bg-chore-bathroom-soft", ink: "text-chore-bathroom" },
  bedroom: { fill: "bg-chore-bedroom-soft", ink: "text-chore-bedroom" },
  "living-room": { fill: "bg-chore-living-room-soft", ink: "text-chore-living-room" },
  laundry: { fill: "bg-chore-laundry-soft", ink: "text-chore-laundry" },
  floors: { fill: "bg-chore-floors-soft", ink: "text-chore-floors" },
  trash: { fill: "bg-chore-trash-soft", ink: "text-chore-trash" },
  outdoor: { fill: "bg-chore-outdoor-soft", ink: "text-chore-outdoor" },
  pets: { fill: "bg-chore-pets-soft", ink: "text-chore-pets" },
  other: { fill: "bg-chore-other-soft", ink: "text-chore-other" },
};

/**
 * A Resident's face, over Bedrock's `Avatar`: their photo, or else the initials on the Category colour the server
 * chose (`avatarTone`), so the same person always gets the same colours on every screen. It is decorative: the name
 * is always written next to it. Bedrock falls back to the initials when the photo fails to load, and to a neutral
 * person icon with no Resident or no initials.
 */
export function Avatar({ resident, size = "md" }: Props) {
  if (resident === null) return <BedrockAvatar size={size} />;
  const tone = TONES[avatarTone(resident)];
  return <BedrockAvatar size={size} src={resident.photoUrl} initials={resident.initials} fillClass={tone.fill} inkClass={tone.ink} />;
}
