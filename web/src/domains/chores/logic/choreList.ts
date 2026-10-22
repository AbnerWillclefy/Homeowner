import type { Chore } from "../api/api";

/** Adds a new Chore at the end, or replaces the one with the same id in place. */
export function upsertChore(chores: Chore[], chore: Chore): Chore[] {
  return chores.some((c) => c.id === chore.id)
    ? chores.map((c) => (c.id === chore.id ? chore : c))
    : [...chores, chore];
}

/** The list without the Chore with this id. */
export function removeChore(chores: Chore[], id: string): Chore[] {
  return chores.filter((c) => c.id !== id);
}
