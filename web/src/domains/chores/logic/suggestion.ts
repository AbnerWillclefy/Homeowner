/** From this Effort up, a one-person Chore gets the "make it two-person" suggestion. */
export const TWO_PERSON_EFFORT_THRESHOLD = 4;

/** Whether to hint that a Chore this draining might be better shared. A hint only: it never blocks saving. */
export function suggestTwoPerson(effort: number, people: number): boolean {
  return people === 1 && effort >= TWO_PERSON_EFFORT_THRESHOLD;
}
