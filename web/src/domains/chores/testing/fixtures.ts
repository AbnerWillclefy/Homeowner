import type { Chore } from "../api/api";

/** A stored Chore for tests; only the id and name matter to most of them. */
export function chore(id: string, name: string): Chore {
  return {
    id,
    name,
    category: "kitchen",
    demands: [],
    baseEffort: 3,
    importance: "normal",
    people: 1,
    intervalDays: 7,
    allowedWeekdays: [],
    buildsUp: false,
  };
}
