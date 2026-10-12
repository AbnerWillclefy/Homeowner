import { describe, expect, it } from "vitest";
import { enUS } from "./en-US";

// Characterisation: the reminders and install wording is unchanged from the
// literals in problemText.ts and InstallSteps.tsx before the move.
const today: Record<string, string> = {
  "reminders.on": "Reminders are on for this device.",
  "reminders.enable": "Enable reminders",
  "reminders.enabling": "Turning on...",
  "reminders.problem.denied":
    "Notifications are blocked for Homeowner. Allow them in your phone's Settings, under Notifications.",
  "reminders.problem.dismissed": "You closed the permission question. Tap the button to try again.",
  "reminders.problem.notConfigured": "Reminders are not set up on the service yet. Try again later.",
  "reminders.problem.notSignedIn": "You are not signed in any more. Sign in again, then turn on reminders.",
  "reminders.problem.error": "Something went wrong turning on reminders. Check your connection and try again.",
  "reminders.problem.browserRegister":
    "This browser could not register with its notification service. Use Chrome and make sure Google Play services is up to date.",
  "reminders.problem.browserNotAllowed":
    "Notifications are not allowed for this app. Check Settings, Apps, Homeowner, Notifications.",
  "reminders.problem.browserRefused": "Your browser refused to turn on reminders ({name}).",
  "install.heading": "Add Homeowner to your Home Screen",
  "install.step1": "Open this page in Safari (not inside another app).",
  "install.step2": "Tap the Share button, the square with an arrow, at the bottom of the screen.",
  "install.step3": "Scroll down and tap Add to Home Screen, then tap Add.",
  "install.step4": "Close Safari and open Homeowner from its new icon on your Home Screen.",
};

describe("en-US reminders wording", () => {
  it.each(Object.entries(today))("keeps today's literal for %s", (key, text) => {
    expect((enUS as Record<string, unknown>)[key]).toBe(text);
  });
});
