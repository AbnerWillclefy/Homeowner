import type { Level } from "../api/checkIn";
import type { MessageKey } from "../i18n";

// A level added to the API without a text here fails the typecheck.
export const LEVEL_KEYS = {
  drained: { label: "checkin.level.drained", hint: "checkin.level.drained.hint" },
  low: { label: "checkin.level.low", hint: "checkin.level.low.hint" },
  normal: { label: "checkin.level.normal", hint: "checkin.level.normal.hint" },
  energized: { label: "checkin.level.energized", hint: "checkin.level.energized.hint" },
} as const satisfies Record<Level, { label: MessageKey; hint: MessageKey }>;
