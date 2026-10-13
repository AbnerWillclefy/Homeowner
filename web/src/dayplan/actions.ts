export type TaskRole = "mine" | "other" | "pool";
export type TaskAction = "accept" | "refuse" | "done" | "take";

/** What the Resident can do with a Task in the Day Plan, and whether to say it is Committed. */
export interface TaskActions {
  actions: TaskAction[];
  committed: boolean;
}

/**
 * The buttons a Task gets. `mine` is a Task assigned to the caller: Proposed until they accept it, then
 * Committed (it can no longer be refused). Pool Tasks can be taken, except those that need two people, which
 * the API refuses for now. Other Residents' Tasks are theirs: nothing to do and nothing to say.
 */
export function actionsFor(task: { people: number; committed?: boolean }, role: TaskRole): TaskActions {
  switch (role) {
    case "mine":
      return task.committed
        ? { actions: ["done"], committed: true }
        : { actions: ["done", "refuse", "accept"], committed: false };
    case "pool":
      return { actions: task.people === 2 ? [] : ["take"], committed: false };
    case "other":
      return { actions: [], committed: false };
  }
}
