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

  "importance.essential": "Essential",
  "importance.normal": "Normal",
  "importance.nice_to_have": "Nice to have",

  // Chores
  "chores.heading": "Chores",
  "chores.intro":
    "Chores are the work your Home needs done. Homeowner shares them out each day, so the more accurately you describe each one, the fairer the sharing is.",
  "chores.loading": "Loading your Chores...",
  "chores.load.offline":
    "Your Chores could not be loaded because Homeowner cannot reach the service. Check your connection and try again.",
  "chores.load.error": "Something went wrong loading your Chores. Try again in a moment.",
  "chores.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "chores.retry": "Try again",
  "chores.empty": "Your Home has no Chores yet. Add the first one to get started.",
  "chores.add": "Add a Chore",
  "chores.item.effort": "Effort {effort} of 5",
  "chores.item.people.one": "1 person",
  "chores.item.people.two": "2 people",
  "chores.item.once": "One-off",
  "chores.item.daily": "Every day",
  "chores.item.every": "Every {days} days",
  "chores.item.weekdays": "Only on {days}",
  "chores.item.buildsUp": "Builds up while undone",
  "chores.item.edit": "Edit",
  "chores.item.edit.label": "Edit {name}",
  "chores.item.delete": "Delete",
  "chores.item.delete.label": "Delete {name}",
  "chores.delete.prompt": "Delete {name}? This cannot be undone.",
  "chores.delete.confirm": "Yes, delete",
  "chores.delete.cancel": "Keep it",
  "chores.delete.deleting": "Deleting...",
  "chores.delete.offline":
    "The Chore was not deleted because Homeowner cannot reach the service. Check your connection and try again.",
  "chores.delete.error": "Something went wrong and the Chore was not deleted. Try again in a moment.",
  "chores.delete.notSignedIn": "Your sign-in has ended, so the Chore was not deleted. Sign in again to continue.",
  "chores.form.create.heading": "Add a Chore",
  "chores.form.edit.heading": "Edit Chore",
  "chores.form.name.label": "Name",
  "chores.form.name.hint": "What the Chore is called, for example \"Wash the dishes\".",
  "chores.form.category.label": "Category",
  "chores.form.category.hint": "What kind of work it is. It decides who likes or dislikes it.",
  "chores.form.category.placeholder": "Choose a Category",
  "chores.form.demands.legend": "Demands",
  "chores.form.demands.hint": "What the Chore asks of the body. Residents with a matching Restriction are never given it.",
  "chores.form.baseEffort.legend": "Effort",
  "chores.form.baseEffort.hint": "How draining it is for each person doing it, from 1 (very light) to 5 (very draining).",
  "chores.form.baseEffort.option": "{effort}",
  "chores.form.importance.legend": "Importance",
  "chores.form.importance.hint": "How much it matters that this gets done. Essential Chores are shared out first.",
  "chores.form.people.legend": "People it takes",
  "chores.form.people.hint": "Whether one Resident does it alone or two do it together.",
  "chores.form.people.one": "One person",
  "chores.form.people.two": "Two people",
  "chores.form.suggestion": "A Chore this draining is easier shared. You could make it a two-person Chore.",
  "chores.form.suggestion.action": "Make it two-person",
  "chores.form.intervalDays.label": "Repeat every (days)",
  "chores.form.intervalDays.hint": "Leave blank for a one-off Chore that comes due once.",
  "chores.form.allowedWeekdays.legend": "Only on these days",
  "chores.form.allowedWeekdays.hint": "Tick the days it may be given out. Tick none to allow any day.",
  "chores.form.buildsUp.label": "Builds up while undone",
  "chores.form.buildsUp.hint": "Tick this if leaving it makes it harder, like laundry piling up. Its Effort then grows each day it stays undone.",
  "chores.form.submit.create": "Add Chore",
  "chores.form.submit.save": "Save Chore",
  "chores.form.saving": "Saving...",
  "chores.form.cancel": "Cancel",
  "chores.form.saved": "The Chore is saved.",
  "chores.form.invalid.summary": "Some details need fixing. Check the fields below.",
  "chores.form.save.offline":
    "The Chore was not saved because Homeowner cannot reach the service. What you typed is still here; check your connection and try again.",
  "chores.form.save.error":
    "Something went wrong and the Chore was not saved. What you typed is still here; try again in a moment.",
  "chores.form.save.notSignedIn": "Your sign-in has ended, so the Chore was not saved. Sign in again to continue.",
  "chores.form.save.gone": "This Chore no longer exists, perhaps because another Resident deleted it.",
  "chores.field.name.required": "Give the Chore a name.",
  "chores.field.name.too_long": "That name is too long. Use 100 characters or fewer.",
  "chores.field.category.required": "Choose a Category.",
  "chores.field.category.unknown": "That Category is not recognised. Choose one from the list.",
  "chores.field.importance.required": "Choose an Importance.",
  "chores.field.importance.unknown": "That Importance is not recognised. Choose one from the list.",
  "chores.field.demands.unknown": "One of the Demands is not recognised. Untick it and try again.",
  "chores.field.baseEffort.required": "Choose an Effort from 1 to 5.",
  "chores.field.baseEffort.invalid": "Effort must be a whole number from 1 to 5.",
  "chores.field.baseEffort.out_of_range": "Effort must be from 1 to 5.",
  "chores.field.people.required": "Choose one or two people.",
  "chores.field.people.invalid": "People must be 1 or 2.",
  "chores.field.people.out_of_range": "A Chore takes one or two people.",
  "chores.field.intervalDays.required": "Enter how many days, or leave it blank for a one-off Chore.",
  "chores.field.intervalDays.invalid": "Enter a whole number of days, or leave it blank for a one-off Chore.",
  "chores.field.intervalDays.out_of_range": "Repeat every 1 to 365 days, or leave it blank for a one-off Chore.",
  "chores.field.allowedWeekdays.invalid": "One of the days is not valid. Untick it and try again.",
  "chores.field.allowedWeekdays.out_of_range": "One of the days is not valid. Untick it and try again.",
  "chores.field.unknown": "This value is not accepted. Check it and try again.",

  // Today (the Day Plan)
  "dayplan.heading": "Today",
  "dayplan.intro":
    "Each day at your Home's Allocation time, Homeowner proposes who does which Tasks, without asking anyone for more Energy than they have. This is today's Day Plan. It is a proposal: nothing here is final.",
  "dayplan.loading": "Loading today's plan...",
  "dayplan.load.offline":
    "Today's plan could not be loaded because Homeowner cannot reach the service. Check your connection and try again.",
  "dayplan.load.error": "Something went wrong loading today's plan. Try again in a moment.",
  "dayplan.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "dayplan.retry": "Try again",
  "dayplan.notPlanned":
    "Today's plan has not been made yet. Homeowner plans your Home's day at {time}, so check back after that. These are the open Tasks it will choose from.",
  "dayplan.rejected":
    "Today's plan could not be used, so no Tasks were given to anyone today. Your open Tasks are still listed below.",
  "dayplan.energy": "Your Energy today: {energy}",
  "dayplan.energy.none":
    "You have no Baseline for today's weekday, so your Energy is 0 and no Tasks were given to you. Set your Baseline in your profile to get Tasks on that day.",
  "dayplan.mine.heading": "Your Tasks",
  "dayplan.mine.empty": "Nothing for you today. Enjoy the day.",
  "dayplan.others.heading": "Other Residents' Tasks",
  "dayplan.others.resident": "Resident {number}",
  "dayplan.pool.heading": "Still to do",
  "dayplan.pool.intro": "Open Tasks that are not given to anyone today, and why.",
  "dayplan.pool.empty": "No other open Tasks. Everything is planned or done.",
  "dayplan.task.effort": "Effort {effort}",
  "dayplan.task.effort.grown": "Effort {effort} (usually {base})",
  "dayplan.task.due": "Due {date}",
  "dayplan.task.reason": "Why: {reason}",
  "dayplan.assigned.reason.deadline_today": "It is due today.",
  "dayplan.assigned.reason.importance": "It matters most.",
  "dayplan.assigned.reason.lateness": "It has waited the longest.",
  "dayplan.assigned.reason.fits_energy": "It fits your Energy.",
  "dayplan.pool.reason.no_energy_left": "No one has enough Energy left today.",
  "dayplan.pool.reason.restricted_for_all": "No one can do it: every Resident has a Restriction on it.",
  "dayplan.pool.reason.weekday_not_allowed": "It is not allowed on this day of the week.",
  "dayplan.pool.reason.two_person_deferred": "It needs two people, and they were not both free today.",
  "dayplan.pool.reason.invalid_effort": "Its Effort is not valid, so it was left out. Edit the Chore to fix it.",
  "dayplan.pool.reason.added_after_plan": "It was added after today's plan was made.",

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

  // Invites: arriving from a link, joining, and sharing one
  "invite.checking": "Checking your Invite...",
  "invite.signedOut.heading": "You were invited to a Home",
  "invite.signedOut.intro":
    "A Resident invited you to join their Home. Create a login, or sign in if you have one, and you become a Resident with an equal say in the Home. Your Invite is saved on this device, so you can confirm your email and come back to it.",
  "invite.lookup.problem":
    "Homeowner could not check your Invite right now. Your link is kept, so you can still sign in and try again.",
  "invite.dead.not_found":
    "This Invite link is not valid. It may have been copied wrongly. Ask the Resident for a new Invite.",
  "invite.dead.used": "This Invite was already used. An Invite works only once, so ask the Resident for a new one.",
  "invite.dead.expired": "This Invite has expired. An Invite lasts seven days, so ask the Resident for a new one.",
  "invite.dead.continue": "Continue",
  "invite.join.heading": "Join a Home",
  "invite.join.loading": "Getting your Invite ready...",
  "invite.join.intro":
    "You were invited to a Home. Joining makes you a Resident, with an equal say in it. Fill in your Baseline, Preferences and Restrictions below first if you like: Homeowner uses them to share the work fairly. You can also do it after joining.",
  "invite.join.submit": "Join this Home",
  "invite.join.submitting": "Joining...",
  "invite.join.dismiss": "Not now",
  "invite.leave.heading": "Joining means leaving your Home",
  "invite.leave.warning":
    "You already live in a Home, and a User can be a Resident of only one. Joining this one means leaving your current Home. Your Preferences and Restrictions for its Chores are deleted. If you are its last Resident, the Home and all its Chores are deleted too.",
  "invite.leave.confirm": "Leave my Home and join this one",
  "invite.leave.cancel": "Stay in my Home",
  "invite.alreadyHere": "You already live in this Home, so there was nothing to join. The Invite was not used up.",
  "invite.failure.offline":
    "Homeowner cannot reach the service, so you have not joined. Your Invite is kept; check your connection and try again.",
  "invite.failure.error": "Something went wrong and you have not joined. Your Invite is kept; try again in a moment.",
  "invite.failure.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "invite.failure.retry": "Try again",
  "invite.rating.heading": "Rate the biggest Chores",
  "invite.rating.intro":
    "You are now a Resident. These are the Home's most demanding Chores by Effort. Tell Homeowner which you like or dislike, and mark any you cannot do, so your first Tasks suit you. Each choice saves on its own, and you can change them later.",
  "invite.rating.loading": "Loading the Chores...",
  "invite.rating.problem":
    "The Chores could not be loaded, so there is nothing to rate right now. You can skip this step.",
  "invite.rating.restricted": "I cannot do this Chore",
  "invite.rating.saved": "Saved.",
  "invite.rating.saveFailed":
    "Your change could not be saved, so it was undone. Check your connection and try again.",
  "invite.rating.done": "Done",
  "invite.rating.skip": "Skip for now",
  "invite.share.heading": "Invite a Resident",
  "invite.share.intro":
    "An Invite is a link you can send in any app. It works once and lasts seven days. Whoever opens it can join your Home, so send it only to the person you mean.",
  "invite.share.button": "Invite a Resident",
  "invite.share.creating": "Making the Invite...",
  "invite.share.title": "Join my Home on Homeowner",
  "invite.share.text": "Join my Home on Homeowner. This link works once and lasts seven days.",
  "invite.share.shared": "Your Invite is ready and was handed to the app you chose.",
  "invite.share.copied": "Your Invite link is copied. Paste it into a message to send it.",
  "invite.share.cancelled": "The Invite was not sent. Its link still works if you made it by mistake, so ask again only if you need it.",
  "invite.share.failed": "The Invite link could not be shared or copied. Try again.",
  "invite.share.tooMany": "Your Home already has the most open Invites allowed. Wait for some to be used or to expire.",
  "invite.share.noHome": "You need a Home before you can invite anyone.",
  "invite.share.offline": "Homeowner cannot reach the service, so no Invite was made. Check your connection and try again.",
  "invite.share.error": "Something went wrong and no Invite was made. Try again in a moment.",

  // Settings
  "settings.heading": "Settings",
  "settings.appearance.label": "Appearance",
  "settings.appearance.system": "System",
  "settings.appearance.light": "Light",
  "settings.appearance.dark": "Dark",
  "settings.language.label": "Language",
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof enUS;
