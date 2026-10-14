import type { MessageKey, Translate } from "../../../shared/i18n";

// The Catalog ids the app has a name for. The API sends an id with every entry and proposal; a Chore's
// stored name is text, so the app builds it in the Resident's language (ADR 0006). An id missing from the
// message catalogs fails the typecheck here.
const NAME_KEYS = {
  clean_kitchen: "catalog.clean_kitchen",
  wash_dishes: "catalog.wash_dishes",
  load_dishwasher: "catalog.load_dishwasher",
  clean_fridge: "catalog.clean_fridge",
  clean_oven: "catalog.clean_oven",
  clean_bathroom: "catalog.clean_bathroom",
  change_bed_linen: "catalog.change_bed_linen",
  tidy_living_room: "catalog.tidy_living_room",
  clean_laundry_area: "catalog.clean_laundry_area",
  wash_laundry: "catalog.wash_laundry",
  fold_laundry: "catalog.fold_laundry",
  vacuum_floors: "catalog.vacuum_floors",
  mop_floors: "catalog.mop_floors",
  put_out_trash: "catalog.put_out_trash",
  put_out_recycling: "catalog.put_out_recycling",
  sweep_balcony: "catalog.sweep_balcony",
  mow_lawn: "catalog.mow_lawn",
  sweep_yard: "catalog.sweep_yard",
  weed_garden: "catalog.weed_garden",
  water_garden: "catalog.water_garden",
  walk_dog: "catalog.walk_dog",
  feed_dog: "catalog.feed_dog",
  bathe_dog: "catalog.bathe_dog",
  clean_litter_box: "catalog.clean_litter_box",
  feed_cat: "catalog.feed_cat",
  feed_fish: "catalog.feed_fish",
  clean_fish_tank: "catalog.clean_fish_tank",
  feed_bird: "catalog.feed_bird",
  clean_bird_cage: "catalog.clean_bird_cage",
  care_for_pet: "catalog.care_for_pet",
} as const satisfies Record<string, MessageKey>;

export const CATALOG_IDS: readonly string[] = Object.keys(NAME_KEYS);

/**
 * The name to save for a Chore made from the Catalog: the name in the Resident's language, with the
 * instance number after it when the answers produced several (a second bathroom is "... 2"). An id the app
 * does not know yet keeps the API's English `fallback`, so a newer API never shows a blank.
 */
export function catalogName(catalogId: string, instance: number | null, fallback: string, t: Translate): string {
  const base = Object.hasOwn(NAME_KEYS, catalogId) ? t(NAME_KEYS[catalogId as keyof typeof NAME_KEYS]) : fallback;
  return instance === null ? base : `${base} ${instance}`;
}
