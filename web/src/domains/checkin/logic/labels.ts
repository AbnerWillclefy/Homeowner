import type { Level } from "../api/api";
import type { EnergyLevel } from "@homeowner/bedrock/home";
import type { MessageKey } from "../../../shared/i18n";

// A level added to the API without a text here fails the typecheck. Only Drained has a hint: it is the one
// answer whose effect (no Tasks today) is not obvious from its name.
export const LEVEL_KEYS = {
  drained: { label: "checkin.level.drained", hint: "checkin.level.drained.hint" },
  low: { label: "checkin.level.low" },
  normal: { label: "checkin.level.normal" },
  energized: { label: "checkin.level.energized" },
} as const satisfies Record<Level, { label: MessageKey; hint?: MessageKey }>;

// How many of Bedrock's four Energy bars each level lights, as on the Hoje artboards. Decoration: the name is always written beside it.
export const LEVEL_BARS = { drained: 0, low: 2, normal: 3, energized: 4 } as const satisfies Record<Level, EnergyLevel>;
