export type TaskRole = "mine" | "other" | "pool";
export type TaskAction = "accept" | "refuse" | "done" | "take";
export type SwapAction = "acceptSwap" | "declineSwap" | "cancelSwap";

/** Every action that runs on a Swap; `Record` makes a new action fail the typecheck until it is listed here. */
const IS_SWAP_ACTION: Record<NonNullable<Acting>["action"], boolean> = {
  accept: false,
  refuse: false,
  done: false,
  take: false,
  acceptAll: false,
  offerSwap: true,
  acceptSwap: true,
  declineSwap: true,
  cancelSwap: true,
};

export const isSwapAction = (action: NonNullable<Acting>["action"]): boolean => IS_SWAP_ACTION[action];

/**
 * The action in flight: one on a Task, Accept all (which belongs to no card), or a Swap action. A Swap action
 * has no `taskId` on purpose, so no Task card can mistake it for its own.
 */
export type Acting =
  | { taskId: string; action: TaskAction }
  | { taskId: null; action: "acceptAll" }
  | { action: "offerSwap"; offeredTaskId: string; requestedTaskId: string }
  | { action: SwapAction; swapId: string }
  | null;

/**
 * What the Resident can do with a Task in the Day Plan, as the Task card shows it: `primary` are the buttons
 * under the card (one clear action, or Recusar and Aceitar for a Proposed Task, in that order), `menu` the items
 * of its ⋯ menu. `committed` says whether the Task is Committed, which the card shows as a status.
 */
export interface TaskActions {
  primary: TaskAction[];
  menu: TaskAction[];
  committed: boolean;
}

/**
 * The actions a Task gets. `mine` is a Task assigned to the caller: Proposed until they accept it (Refuse,
 * Accept; Done only once it is Committed), then Committed (Done). A pool Task can be taken (Take), or done in one
 * step, which sits in the menu so the card keeps one clear action; except those that need two people, which the
 * API refuses for now. Other Residents' Tasks are theirs: nothing to do. Swap is not a Task action: it opens
 * from the ⋯ menu of your own Task's Sheet (`canOfferFor`).
 */
export function actionsFor(
  task: { people: number; committed?: boolean },
  role: TaskRole,
): TaskActions {
  switch (role) {
    case "mine":
      return task.committed
        ? { primary: ["done"], menu: [], committed: true }
        : { primary: ["refuse", "accept"], menu: [], committed: false };
    case "pool":
      return task.people === 2
        ? { primary: [], menu: [], committed: false }
        : { primary: ["take"], menu: ["done"], committed: false };
    case "other":
      return { primary: [], menu: [], committed: false };
  }
}

/** The action of this card that is in flight, if any. Another card's action, Accept all or none give null. */
export function pendingAction(acting: Acting, taskId: string): TaskAction | null {
  if (!acting || !("taskId" in acting) || acting.taskId === null) return null;
  return acting.taskId === taskId ? acting.action : null;
}

/** The Swap action in flight on this offer, if any. Another offer's action, a Task action or none give null. */
export function pendingSwap(acting: Acting, swapId: string): SwapAction | null {
  return acting && "swapId" in acting && acting.swapId === swapId ? acting.action : null;
}
