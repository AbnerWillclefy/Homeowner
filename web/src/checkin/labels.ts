import type { Level } from "./api";
import type { MessageKey } from "../shared/i18n";

// A level added to the API without a text here fails the typecheck. Only Drained has a hint: it is the one
// answer whose effect (no Tasks today) is not obvious from its name.
export const LEVEL_KEYS = {
  drained: { label: "checkin.level.drained", hint: "checkin.level.drained.hint" },
  low: { label: "checkin.level.low" },
  normal: { label: "checkin.level.normal" },
  energized: { label: "checkin.level.energized" },
} as const satisfies Record<Level, { label: MessageKey; hint?: MessageKey }>;
