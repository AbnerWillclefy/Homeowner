export type FlowNotice = "rating" | "already-here";

export type DialogName = "join" | "rating" | "start-choice" | "checkin";

/**
 * The one dialog to show over Today, and only on Today. A pending Invite comes first, then the rating step that
 * follows a join, then the start choice (held back while rating is showing). The Check-in comes last: it opens
 * by itself when today has none and the Resident has not said "not now" for this date in this session.
 * Nothing pending gives null.
 */
export function dialogToShow(state: {
  onToday: boolean;
  inviteToken: string | null;
  after: FlowNotice | null;
  choosing: boolean;
  /** Today's Check-in, or null until it is read. */
  checkIn: { date: string; checkedIn: boolean } | null;
  /** The date the Resident dismissed the Check-in for, in this session only. */
  checkInDismissedFor: string | null;
}): DialogName | null {
  if (!state.onToday) return null;
  if (state.inviteToken !== null) return "join";
  if (state.after === "rating") return "rating";
  if (state.choosing) return "start-choice";
  const { checkIn } = state;
  if (checkIn !== null && !checkIn.checkedIn && state.checkInDismissedFor !== checkIn.date) return "checkin";
  return null;
}
