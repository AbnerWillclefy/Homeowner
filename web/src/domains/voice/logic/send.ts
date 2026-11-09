import { createChore, updateChore } from "../../chores/api/api";
import { acceptTask, completeTask, refuseTask, takeTask } from "../../dayplan/api/api";
import type { VoiceAction } from "../api/api";
import type { SendResult } from "./apply";

/** What an existing API function answers: the raw kind (and a conflict's code) becomes the failure reason. */
const toResult = (r: { kind: string; code?: string }): SendResult =>
  r.kind === "ok" ? { kind: "ok" } : { kind: "failed", reason: r.code ? `${r.kind}:${r.code}` : r.kind };

const TASK_CALLS = { accept: acceptTask, take: takeTask, refuse: refuseTask, complete: completeTask };

/**
 * Sends one action through the existing typed API function for its kind. A server-supplied `path` is never used:
 * the kind plus the id pick the call, and only a Chore's `request.body` is passed on.
 */
export async function sendAction(action: VoiceAction): Promise<SendResult> {
  switch (action.kind) {
    case "create_chore":
      return toResult(await createChore(action.body));
    case "edit_chore":
      return toResult(await updateChore(action.choreId, action.body));
    case "choice":
      return { kind: "failed", reason: "choice" };
    default:
      return toResult(await TASK_CALLS[action.kind](action.taskId));
  }
}
