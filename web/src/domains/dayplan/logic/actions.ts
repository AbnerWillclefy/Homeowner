export type TaskRole = "mine" | "other" | "pool";
export type TaskAction = "accept" | "refuse" | "done" | "take";
export type ActionSlot = "start" | "end";

/** The action in flight: one on a Task, or Accept all, which belongs to no card. */
export type Acting = { taskId: string; action: TaskAction } | { taskId: null; action: "acceptAll" } | null;

/**
 * What the Resident can do with a Task in the Day Plan, as slots of the card's button row: `start` holds the
 * action that needs a moment of thought, `end` the one most likely taken (under the right thumb). `committed`
 * says whether to show the Committed mark, which the card puts first in the start slot.
 */
export interface TaskActions {
  start: TaskAction[];
  end: TaskAction[];
  committed: boolean;
}

/**
 * The buttons a Task gets. `mine` is a Task assigned to the caller: Proposed until they accept it (Refuse,
 * Accept; Done only once it is Committed), then Committed. Pool Tasks can be taken, or done in one step (Done, secondary, at the start), except those that need two
 * people, which the API refuses for now. Other Residents' Tasks are theirs: nothing to do and nothing to say.
 */
export function actionsFor(task: { people: number; committed?: boolean }, role: TaskRole): TaskActions {
  switch (role) {
    case "mine":
      return task.committed
        ? { start: [], end: ["done"], committed: true }
        : { start: ["refuse"], end: ["accept"], committed: false };
    case "pool":
      return task.people === 2
        ? { start: [], end: [], committed: false }
        : { start: ["done"], end: ["take"], committed: false };
    case "other":
      return { start: [], end: [], committed: false };
  }
}

/** The variant follows the slot, not the action: the end is primary, the start secondary. */
export function variantFor(slot: ActionSlot): "primary" | "secondary" {
  return slot === "end" ? "primary" : "secondary";
}

/** The action of this card that is in flight, if any. Another card's action, Accept all or none give null. */
export function pendingAction(acting: Acting, taskId: string): TaskAction | null {
  return acting && acting.action !== "acceptAll" && acting.taskId === taskId ? acting.action : null;
}
