// en-US is the source of truth for message keys.
//
// - Keys are stable identifiers, grouped by screen (home.*, health.*).
// - One whole sentence per key, so translators can reorder words freely.
// - Placeholders are written {name}; a plural is { one, other, many? } and
//   needs a {count} placeholder.
// - No markup and no literal braces inside a message.
// - The agreed pt-BR wording for domain terms is in docs/glossary-pt-BR.md.
import type { Message } from "../translate";

export const enUS = {
  "app.name": "Homeowner",
  "home.tagline": "Share the housework in your Home fairly.",
  "health.loading": "Checking the service...",
  "health.ok": "Service status: ok",
  "health.unavailable": "Service status: unavailable. The service is up but cannot reach its database.",
  "health.unreachable": "Service status: unreachable. Check your connection and try again.",
  "health.retry": "Try again",
  "auth.checking": "Checking your sign-in...",

  // Home
  "home.loading": "Loading your Home...",
  "home.load.offline":
    "Homeowner cannot reach the service, so your Home could not be loaded. Check your connection and try again.",
  "home.load.error": "Something went wrong loading your Home. Try again in a moment.",
  "home.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "home.retry": "Try again",
  "home.create.heading": "Create your Home",
  "home.create.intro":
    "Your Home is the place you and the other Residents look after together. Homeowner needs its timezone and Allocation time to know when each day starts and when to propose the Day Plan. You can change both later, and you can live in only one Home.",
  "home.create.submit": "Create Home",
  "home.create.submitting": "Creating...",
  "home.create.recovered": "You already have a Home, so Homeowner loaded it instead. Check its settings below.",
  "home.settings.heading": "Your Home",
  "home.settings.intro":
    "All Residents of a Home have an equal say, so any Resident can change these settings. The Allocation time is when Homeowner proposes each day's Day Plan.",
  "home.settings.save": "Save changes",
  "home.settings.saving": "Saving...",
  "home.settings.saved": "Your changes are saved.",
  "home.timezone.label": "Timezone",
  "home.timezone.hint": "Where your Home is, so Homeowner knows when each day starts.",
  "home.allocationTime.label": "Allocation time",
  "home.allocationTime.hint":
    "The time each day when Homeowner proposes the Day Plan, in your Home's timezone. Times come in 15-minute steps.",
  "home.save.offline":
    "Homeowner cannot reach the service. What you typed is still here; check your connection and try again.",
  "home.save.error": "Something went wrong and nothing was saved. What you typed is still here; try again in a moment.",
  "home.invalid.summary": "Some details need fixing. Check the fields below.",
  "home.field.timezone.required": "Choose a timezone.",
  "home.field.timezone.unknown": "That timezone is not recognised. Choose one from the list.",
  "home.field.allocationTime.required": "Choose an Allocation time.",
  "home.field.allocationTime.invalid": "That is not a valid time. Choose one from the list.",
  "home.field.allocationTime.not_quarter_hour": "The Allocation time must be on a quarter hour: :00, :15, :30 or :45.",
  "home.field.unknown": "This value is not accepted. Check it and try again.",

  // Reminders
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

  // iPhone install steps
  "install.heading": "Add Homeowner to your Home Screen",
  "install.intro":
    "Reminders tell you when your Check-in is waiting and which Tasks are proposed for you. On iPhone, Apple only allows notifications for apps added to the Home Screen, and it needs iOS 16.4 or newer.",
  "install.step1": "Open this page in Safari (not inside another app).",
  "install.step2": "Tap the Share button, the square with an arrow, at the bottom of the screen.",
  "install.step3": "Scroll down and tap Add to Home Screen, then tap Add.",
  "install.step4": "Close Safari and open Homeowner from its new icon on your Home Screen.",
  "install.outro": "Once you open Homeowner from the icon, this page will let you turn on reminders.",

  // Settings
  "settings.heading": "Settings",
  "settings.appearance.label": "Appearance",
  "settings.appearance.system": "System",
  "settings.appearance.light": "Light",
  "settings.appearance.dark": "Dark",
  "settings.language.label": "Language",
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof enUS;
