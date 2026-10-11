import type { TestResult } from "../api/push";
import { problemText } from "./problemText";
import { usePush } from "./usePush";

const TEST_TEXT: Record<TestResult["kind"], string> = {
  ok: "Test notification sent. It should arrive in a few seconds.",
  unknown: "The service does not know this device yet. Turn on reminders again.",
  gone: "Your phone's notification service rejected this device, so it was removed. Turn on reminders again.",
  "push-service-error": "The notification service could not deliver it right now. Try again in a moment.",
  error: "Could not reach the service. Check your connection and try again.",
};

function InstallSteps() {
  return (
    <section aria-labelledby="install-heading">
      <h2 id="install-heading">Add Homeowner to your Home Screen</h2>
      <p>
        Reminders tell you when your Check-in is waiting and which Tasks are proposed for you. On iPhone, Apple only
        allows notifications for apps added to the Home Screen, and it needs iOS 16.4 or newer.
      </p>
      <ol>
        <li>Open this page in Safari (not inside another app).</li>
        <li>Tap the Share button, the square with an arrow, at the bottom of the screen.</li>
        <li>Scroll down and tap Add to Home Screen, then tap Add.</li>
        <li>Close Safari and open Homeowner from its new icon on your Home Screen.</li>
      </ol>
      <p>Once you open Homeowner from the icon, this page will let you turn on reminders.</p>
    </section>
  );
}

export function Reminders() {
  const { availability, reminders, enable, test, sendTest } = usePush();

  if (availability.kind === "needs-install") return <InstallSteps />;

  if (availability.kind === "unsupported") {
    return (
      <section aria-labelledby="reminders-heading">
        <h2 id="reminders-heading">Reminders</h2>
        <p>
          This browser cannot show reminders. On iPhone you need iOS 16.4 or newer; on Android, use an up-to-date
          Chrome and add Homeowner to your Home Screen.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="reminders-heading">
      <h2 id="reminders-heading">Reminders</h2>
      <p>
        Reminders are the only way Homeowner can nudge you when the app is closed, for example to do today's Check-in so
        your Day Plan matches how you feel. They are a nudge: the app works without them.
      </p>

      {reminders.kind === "on" ? (
        <>
          <p role="status">Reminders are on for this device.</p>
          <button type="button" onClick={sendTest} disabled={test.kind === "sending"}>
            {test.kind === "sending" ? "Sending..." : "Send test notification"}
          </button>
          {test.kind === "done" && <p role="status">{TEST_TEXT[test.result.kind]}</p>}
        </>
      ) : (
        <>
          <button type="button" onClick={enable} disabled={reminders.kind === "working"}>
            {reminders.kind === "working" ? "Turning on..." : "Enable reminders"}
          </button>
          {reminders.kind === "problem" && <p role="alert">{problemText(reminders.problem)}</p>}
          {test.kind === "done" && <p role="status">{TEST_TEXT[test.result.kind]}</p>}
        </>
      )}
    </section>
  );
}
