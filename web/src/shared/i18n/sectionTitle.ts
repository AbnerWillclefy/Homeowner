import type { Translate } from "./context";

/** A section's name, with how many it holds after a "·" when there are any: "Cozinha · 2". */
export function sectionTitle(t: Translate, title: string, count = 0): string {
  return count > 0 ? t("section.withCount", { title, count }) : title;
}
