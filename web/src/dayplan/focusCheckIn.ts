/** The id of the Check-in heading, which takes focus when the Energy chip sends the Resident there. */
export const CHECKIN_HEADING_ID = "checkin-heading";

/** Scrolls to the Check-in and moves focus to its heading, so keyboard and screen reader users arrive there too. */
export function focusCheckIn(): void {
  const heading = document.getElementById(CHECKIN_HEADING_ID);
  if (!heading) return;
  heading.scrollIntoView({ block: "start" });
  heading.focus();
}
