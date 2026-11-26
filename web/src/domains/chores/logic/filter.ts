/** Lower case with the accent marks taken off: "Louça" and "louca" compare equal. */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * The Chores whose name holds the search text (any case, any accent), and, when a Category chip is chosen, only
 * that Category's. An empty or blank query and `null` for the chip ("All") filter nothing, so the list keeps its order.
 * `category` is compared as stored: pass the resolved Category id of the chip against the Chore's own.
 */
export function filterChores<T extends { name: string; category: string }>(
  chores: readonly T[],
  query: string,
  category: string | null,
  categoryOf: (chore: T) => string = (chore) => chore.category,
): T[] {
  const needle = normalizeText(query.trim());
  return chores.filter(
    (chore) => (category === null || categoryOf(chore) === category) && (needle === "" || normalizeText(chore.name).includes(needle)),
  );
}
