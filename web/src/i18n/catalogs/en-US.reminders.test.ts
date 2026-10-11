import { describe, expect, it } from "vitest";
import { enUS } from "./en-US";

// Characterisation: the reminders and install wording is unchanged from the
// literals in Reminders.tsx, problemText.ts and testText.ts before the move.
const today: Record<string, string> = {
  "reminders.heading": "Reminders",
  "reminders.intro":
    "Reminders are the only way Homeowner can nudge you when the app is closed, for example to do today's Check-in so your Day Plan matches how you feel. They are a nudge: the app works without them.",
  "reminders.unsupported":
    "This browser cannot show reminders. On iPhone you need iOS 16.4 or newer; on Android, use an up-to-date Chrome and add Homeowner to your Home Screen.",
  "reminders.on": "Reminders are on for this device.",
  "reminders.enable": "Enable reminders",
  "reminders.enabling": "Turning on...",
  "reminders.sendTest": "Send test notification",
  "reminders.sendingTest": "Sending...",
  "reminders.sendDelayed": "Send in {seconds} seconds",
  "reminders.testPending": "Close the app now; the notification arrives in about {seconds} seconds.",
  "reminders.test.ok": "Test notification sent. It should arrive in a few seconds.",
  "reminders.test.okDelayed": "Test notification sent.",
  "reminders.test.notSignedIn": "You are not signed in any more. Sign in again to send a test.",
  "reminders.test.unknown": "The service does not know this device yet. Turn on reminders again.",
  "reminders.test.gone":
    "Your phone's notification service rejected this device, so it was removed. Turn on reminders again.",
  "reminders.test.pushServiceError": "The notification service could not deliver it right now. Try again in a moment.",
  "reminders.test.error": "Could not reach the service. Check your connection and try again.",
  "reminders.problem.denied":
    "Notifications are blocked for Homeowner. Open your phone's Settings, find Homeowner under Notifications, allow them, then come back. The app cannot ask a second time.",
  "reminders.problem.dismissed":
    "You closed the permission question without answering. Tap the button to try again when you are ready.",
  "reminders.problem.notConfigured": "Reminders are not set up on the service yet. Try again later.",
  "reminders.problem.notSignedIn": "You are not signed in any more. Sign in again, then turn on reminders.",
  "reminders.problem.error": "Something went wrong turning on reminders. Check your connection and try again.",
  "reminders.problem.browserRegister":
    "This browser could not register with its notification service. Use Chrome and make sure Google Play services is up to date.",
  "reminders.problem.browserNotAllowed":
    "Notifications are not allowed for this app. Check Settings, Apps, Homeowner, Notifications.",
  "reminders.problem.browserRefused": "Your browser refused to turn on reminders ({name}).",
  "install.heading": "Add Homeowner to your Home Screen",
  "install.intro":
    "Reminders tell you when your Check-in is waiting and which Tasks are proposed for you. On iPhone, Apple only allows notifications for apps added to the Home Screen, and it needs iOS 16.4 or newer.",
  "install.step1": "Open this page in Safari (not inside another app).",
  "install.step2": "Tap the Share button, the square with an arrow, at the bottom of the screen.",
  "install.step3": "Scroll down and tap Add to Home Screen, then tap Add.",
  "install.step4": "Close Safari and open Homeowner from its new icon on your Home Screen.",
  "install.outro": "Once you open Homeowner from the icon, this page will let you turn on reminders.",
};

describe("en-US reminders wording", () => {
  it.each(Object.entries(today))("keeps today's literal for %s", (key, text) => {
    expect((enUS as Record<string, string>)[key]).toBe(text);
  });
});
