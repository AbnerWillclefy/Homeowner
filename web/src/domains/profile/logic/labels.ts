import type { MessageKey } from "../../../shared/i18n";

// The ids the app has a translation for. A key that is not in the catalogs fails the typecheck.
export const CATEGORY_KEYS = {
  kitchen: "category.kitchen",
  bathroom: "category.bathroom",
  bedroom: "category.bedroom",
  living_room: "category.living_room",
  laundry: "category.laundry",
  floors: "category.floors",
  trash: "category.trash",
  outdoor: "category.outdoor",
  pets: "category.pets",
  other: "category.other",
} as const satisfies Record<string, MessageKey>;

const DEMAND_KEYS = {
  heavy_lifting: "demand.heavy_lifting",
  bending: "demand.bending",
  heights: "demand.heights",
  strong_chemicals: "demand.strong_chemicals",
} as const satisfies Record<string, MessageKey>;

const IMPORTANCE_KEYS = {
  essential: "importance.essential",
  normal: "importance.normal",
  nice_to_have: "importance.nice_to_have",
} as const satisfies Record<string, MessageKey>;

/** A catalog key to translate, or the plain id when the API sent one the app has no text for. */
export type Label = { key: MessageKey } | { text: string };

/** Resolve a Label to text with the translate function from `useI18n`. */
export const labelText = (t: (key: MessageKey) => string, label: Label): string =>
  "key" in label ? t(label.key) : label.text;

function label(keys: Readonly<Record<string, MessageKey>>, id: string): Label {
  return Object.hasOwn(keys, id) ? { key: keys[id]! } : { text: id };
}

export const categoryLabel = (id: string): Label => label(CATEGORY_KEYS, id);
export const demandLabel = (id: string): Label => label(DEMAND_KEYS, id);
export const importanceLabel = (id: string): Label => label(IMPORTANCE_KEYS, id);
