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

  // Profile
  "profile.heading": "Your profile",
  "profile.intro":
    "Homeowner uses this to share the housework fairly: it gives you fewer Chores on tiring days and avoids the work you dislike or cannot do. It stays with you if you move to another Home.",
  "profile.loading": "Loading your profile...",
  "profile.offline": "Could not reach the service, so your profile is not shown. Check your connection and try again.",
  "profile.error": "Something went wrong loading your profile. Try again in a moment.",
  "profile.notSignedIn": "You are not signed in any more. Sign in again to see your profile.",
  "profile.retry": "Try again",
  "profile.saved": "Saved.",
  "profile.saveFailed": "Could not save your change, so it was undone. Check your connection and try again.",
  "profile.saveFailed.notSignedIn": "You are not signed in any more, so your change was undone. Sign in again.",
  "profile.baseline.heading": "Baseline",
  "profile.baseline.explain":
    "A point is a unit of Effort, which is how draining a piece of work is, from 1 to 5. Your Baseline is the Energy you can usually give on each day, in those points; leave a day empty if you are not sure yet.",
  "profile.baseline.hint": "A whole number from 0 to 20. It is saved when you leave the field.",
  "profile.baseline.invalid": "Enter a whole number from 0 to 20, or leave it empty.",
  "profile.preferences.heading": "Preferences",
  "profile.preferences.intro":
    "Say which kinds of work you like or dislike. Chores you dislike go to you less often, but never at the cost of what is essential. Anything you leave alone is neutral.",
  "profile.preference.like": "Like",
  "profile.preference.neutral": "Neutral",
  "profile.preference.dislike": "Dislike",
  "profile.restrictions.heading": "Restrictions",
  "profile.restrictions.intro":
    "Tick what your body cannot do. Chores that ask for it are never given to you. Untick it when that changes.",
  "category.kitchen": "Kitchen",
  "category.bathroom": "Bathroom",
  "category.bedroom": "Bedroom",
  "category.living_room": "Living room",
  "category.laundry": "Laundry",
  "category.floors": "Floors",
  "category.trash": "Trash",
  "category.outdoor": "Outdoor",
  "category.pets": "Pets",
  "category.other": "Other",
  "demand.heavy_lifting": "Heavy lifting",
  "demand.bending": "Bending",
  "demand.heights": "Heights",
  "demand.strong_chemicals": "Strong chemicals",

  // Sign up
  "signUp.heading": "Sign up",
  "signUp.intro":
    "Homeowner is for the people who look after a Home together. Signing up gives you a login of your own, so your Baseline, Preferences and Restrictions are yours and follow you, whoever else lives in the Home.",
  "signUp.emailLabel": "Email",
  "signUp.emailHint":
    "Your email is your login. We also send a code to it in the next step, which proves the email is really yours.",
  "signUp.passwordLabel": "Password",
  "signUp.passwordHint": "It keeps anyone else from signing in as you.",
  "signUp.confirmLabel": "Confirm password",
  "signUp.mismatch": "The two passwords do not match.",
  "signUp.submit": "Sign up",
  "signUp.submitting": "Signing up...",
  "signUp.haveLogin": "Already signed up?",
  "signUp.haveLoginAction": "Sign in",

  // Sign in
  "signIn.heading": "Sign in",
  "signIn.intro":
    "Signing in tells Homeowner whose Check-in and Tasks to show. You stay signed in on this device until you sign out.",
  "signIn.confirmedNotice": "Your email is confirmed. Sign in to start.",
  "signIn.emailLabel": "Email",
  "signIn.passwordLabel": "Password",
  "signIn.submit": "Sign in",
  "signIn.submitting": "Signing in...",
  "signIn.newHere": "New here?",
  "signIn.newHereAction": "Sign up",

  // Confirm email
  "confirm.heading": "Confirm your email",
  "confirm.intro":
    "We sent a code to {email}. Entering it proves the email is yours, so nobody can sign up in your name or take over your Preferences. Until you do, you cannot sign in.",
  "confirm.spamHint": "The email can take a minute, and it may land in your spam folder.",
  "confirm.codeLabel": "Code from the email",
  "confirm.submit": "Confirm",
  "confirm.submitting": "Checking...",
  "confirm.resend": "Send a new code",
  "confirm.useOtherEmail": "Use a different email",
  "confirm.resent": "A new code is on its way. Use the latest email.",

  // Signed in
  "signedIn.heading": "You are signed in",
  "signedIn.as": "Signed in as {email}.",
  "signedIn.emailFallback": "your email",
  "signedIn.offline":
    "Homeowner cannot reach the service right now, so this is the last sign-in this device remembers. Open the app again when you are back online to check.",
  "signedIn.signOut": "Sign out",

  // Shared by the auth screens
  "auth.showPassword": "Show password",

  "auth.failure.alreadyRegistered":
    "That email is already signed up. Sign in instead, or confirm it if you never entered the code.",
  "auth.failure.invalidPassword": "That password is not strong enough. {rules}",
  "auth.failure.invalidInput": "Check the email and the details you typed, then try again.",
  "auth.failure.wrongCode": "That code is not right. Check the latest email and try again.",
  "auth.failure.expiredCode": "That code has expired. Ask for a new one and use the latest email.",
  "auth.failure.notConfirmed":
    "This email has not been confirmed yet. Enter the code from your email, or ask for a new one.",
  "auth.failure.notAuthorized": "The email or password is not right. Check both and try again.",
  "auth.failure.rateLimited": "Too many attempts. Wait a few minutes, then try again.",
  "auth.failure.network": "Could not reach the sign-in service. Check your connection and try again.",
  "auth.failure.error": "Something went wrong. Try again in a moment.",

  // Password rules. The checklist uses auth.rule.*; the one-sentence text uses auth.rules.*.
  "auth.rule.length": { one: "At least {count} character", other: "At least {count} characters" },
  "auth.rule.lowercase": "A lower case letter",
  "auth.rule.uppercase": "An upper case letter",
  "auth.rule.number": "A number",
  "auth.rule.symbol": "A symbol",
  "auth.rule.status.met": "{rule}: Met",
  "auth.rule.status.notMet": "{rule}: Not met yet",
  "auth.rule.announce.met": "{rule} met.",
  "auth.rule.announce.notMet": "{rule} not met.",
  "auth.rule.announce.count": { one: "{met} of {count} rule met.", other: "{met} of {count} rules met." },
  "auth.rules.clause.lowercase": "a lower case letter",
  "auth.rules.clause.uppercase": "an upper case letter",
  "auth.rules.clause.number": "a number",
  "auth.rules.clause.symbol": "a symbol",
  "auth.rules.withClauses": "{length}, with {rules}.",
  "auth.rules.lengthOnly": "{length}.",
  "auth.rules.listEnd": "{rest} and {last}",

  // Settings
  "settings.heading": "Settings",
  "settings.appearance.label": "Appearance",
  "settings.appearance.system": "System",
  "settings.appearance.light": "Light",
  "settings.appearance.dark": "Dark",
  "settings.language.label": "Language",
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof enUS;
