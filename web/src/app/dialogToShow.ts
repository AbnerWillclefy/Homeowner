export type FlowNotice = "rating" | "already-here";

export type DialogName = "join" | "rating" | "start-choice";

/**
 * The one dialog to show over Today. A pending Invite comes first, then the rating step that follows a join,
 * then the start choice (held back while rating is showing). Nothing pending gives null.
 */
export function dialogToShow(state: {
  inviteToken: string | null;
  after: FlowNotice | null;
  choosing: boolean;
}): DialogName | null {
  if (state.inviteToken !== null) return "join";
  if (state.after === "rating") return "rating";
  if (state.choosing) return "start-choice";
  return null;
}
