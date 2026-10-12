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
  "health.unavailable": "Service status: unavailable. The service is up but cannot reach its database.",
  "health.unreachable": "Service status: unreachable. Check your connection and try again.",
  "health.retry": "Try again",
  "auth.checking": "Checking your sign-in...",

  // Navigation
  "nav.label": "Main",
  "nav.today": "Today",
  "nav.chores": "Chores",
  "nav.home": "Home",
  "nav.me": "Me",

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
  "home.leave.heading": "Leave this Home",
  "home.leave.intro":
    "If you move out or no longer share this Home, you can leave it. You can join or create another Home afterwards.",
  "home.leave.open": "Leave this Home",
  "home.leave.title": "Leave this Home?",
  "home.leave.removes":
    "Your Preferences and Restrictions for this Home's Chores are removed, and so are your places in its Day Plan.",
  "home.leave.stays":
    "Your Baseline and your general Preferences and Restrictions stay with you and come to your next Home.",
  "home.leave.last":
    "If you are the last Resident, the Home and all its Chores are deleted, and that cannot be undone.",
  "home.leave.cancel": "Cancel",
  "home.leave.confirm": "Leave Home",
  "home.leave.leaving": "Leaving...",
  "home.leave.offline":
    "Homeowner cannot reach the service, so you have not left. Check your connection and try again.",
  "home.leave.error": "Something went wrong and you have not left. Try again in a moment.",
  "home.invalid.summary": "Some details need fixing. Check the fields below.",
  "home.field.timezone.required": "Choose a timezone.",
  "home.field.timezone.unknown": "That timezone is not recognised. Choose one from the list.",
  "home.field.allocationTime.required": "Choose an Allocation time.",
  "home.field.allocationTime.invalid": "That is not a valid time. Choose one from the list.",
  "home.field.allocationTime.not_quarter_hour": "The Allocation time must be on a quarter hour: :00, :15, :30 or :45.",
  "home.field.unknown": "This value is not accepted. Check it and try again.",

  // Reminders
  "reminders.on": "Reminders are on for this device.",
  "reminders.enable": "Enable reminders",
  "reminders.enabling": "Turning on...",
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
  "profile.intro":
    "Homeowner uses this to share the housework fairly: it gives you fewer Chores on tiring days and avoids the work you dislike or cannot do. It stays with you if you move to another Home.",
  "profile.loading": "Loading your details...",
  "profile.offline": "Could not reach the service, so your details are not shown. Check your connection and try again.",
  "profile.error": "Something went wrong loading your details. Try again in a moment.",
  "profile.notSignedIn": "You are not signed in any more. Sign in again to see your details.",
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
  "chores.empty": "Your Home has no Chores yet. Tap \"Add a Chore\" to write your own, or \"Add from the Catalog\" to start from a ready-made one.",
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
  "dayplan.greeting.morning": "Good morning",
  "dayplan.greeting.afternoon": "Good afternoon",
  "dayplan.greeting.evening": "Good evening",
  "dayplan.chip.label": "Energy today: {text}",
  "dayplan.chip.unset": "Check in to set today's Energy",
  "dayplan.chip.noBaseline": "Set your Baseline to get Energy",
  "dayplan.chip.drained": "Drained today, no Tasks",
  "dayplan.chip.energy": "Energy {energy}",
  "dayplan.chip.pending": "Checked in",
  "dayplan.mine.heading": "Your Tasks",
  "dayplan.mine.empty": "Nothing for you today. Enjoy the day.",
  "dayplan.mine.empty.noBaseline":
    "You have no Baseline for today's weekday, so your Energy is 0 and no Tasks were given to you. When you are ready, you can set your Baseline to get Tasks on that day.",
  "dayplan.mine.empty.noBaseline.link": "Set your Baseline",
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
  "dayplan.mine.empty.drained": "You checked in as Drained, so no Tasks were given to you today. Rest up.",

  // The start choice, at the end of both onboarding flows
  "startChoice.heading": "When do you want your Tasks?",
  "startChoice.intro":
    "Your Home shares out Tasks every day at its Allocation time. You can start now, or wait for the next one.",
  "startChoice.now.button": "Get my tasks right away",
  "startChoice.now.hint":
    "Homeowner plans only you, now, from the open Tasks nobody has been given today. Other Residents' Tasks do not change.",
  "startChoice.tomorrow.button": "Start tomorrow",
  "startChoice.tomorrow.hint": "Wait for the next daily Allocation. Nothing is planned for you until then.",
  "startChoice.planning": "Planning your Tasks...",
  "startChoice.retry": "Try again",
  "startChoice.failed.offline":
    "You seem to be offline, so your Tasks were not planned. Check your connection and try again.",
  "startChoice.failed.error": "Something went wrong planning your Tasks. Try again in a moment.",
  "startChoice.done.tasks": "Your Tasks for today are ready. You can see them in Today, below.",
  "startChoice.done.noEnergy":
    "Your Energy for today is 0, so no Tasks were given to you. If you have no Baseline for this weekday, set it on the Me tab to get Tasks on that day.",
  "startChoice.done.nothing": "No open Tasks were left for you today. Enjoy the day.",
  "startChoice.done.close": "Got it",

  // Check-in
  "checkin.heading": "Check-in",
  "checkin.intro":
    "Tell Homeowner how much Energy you have today. It scales your Baseline for today only, so your Tasks fit how you really feel. You can change it later today, and your Tasks will be planned again.",
  "checkin.loading": "Loading your Check-in...",
  "checkin.load.offline":
    "Your Check-in could not be loaded because Homeowner cannot reach the service. Check your connection and try again.",
  "checkin.load.error": "Something went wrong loading your Check-in. Try again in a moment.",
  "checkin.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "checkin.retry": "Try again",
  "checkin.level.legend": "How is your Energy today?",
  "checkin.level.drained": "Drained",
  "checkin.level.drained.hint": "No Energy at all. You get no Tasks today.",
  "checkin.level.low": "Low",
  "checkin.level.low.hint": "Half of your usual Energy, so fewer and lighter Tasks.",
  "checkin.level.normal": "Normal",
  "checkin.level.normal.hint": "Your usual Energy, as set in your Baseline.",
  "checkin.level.energized": "Energized",
  "checkin.level.energized.hint": "A bit more than usual, so you can take on more.",
  "checkin.level.required": "Choose how your Energy is today, then save.",
  "checkin.restrictions.legend": "Anything your body cannot do today?",
  "checkin.restrictions.hint":
    "Tick what you cannot take on today, such as heavy lifting with a sore back. This counts for today only and does not change the Restrictions on the Me tab.",
  "checkin.submit": "Save Check-in",
  "checkin.saving": "Saving...",
  "checkin.cancel": "Cancel",
  "checkin.change": "Change",
  "checkin.saved": "Check-in saved. Today's plan has been updated.",
  "checkin.save.offline":
    "Your Check-in was not saved because Homeowner cannot reach the service. Check your connection and try again.",
  "checkin.save.error": "Something went wrong saving your Check-in. Try again in a moment.",
  "checkin.save.invalid": "Homeowner did not accept that Check-in. Choose again and try once more.",
  "checkin.summary": "Today's Check-in: {level}",
  "checkin.summary.restrictions": "Not today: {demands}",

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
  "auth.failure.invalidPassword": "That password is not strong enough. Choose a different password. {rules}",
  "auth.failure.invalidInput": "Check the email and the details you typed, then try again.",
  "auth.failure.wrongCode": "That code is not right. Check the latest email and try again.",
  "auth.failure.expiredCode": "That code has expired. Request a new code and use the latest email.",
  "auth.failure.notConfirmed":
    "Confirm your email first: enter the code we sent, or request a new code.",
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

  // Catalog: the questionnaire, the review of suggested Chores, and adding from the Catalog
  "home.create.step": "Step {step} of {total}",
  "home.create.next": "Next: about your Home",
  "home.create.back": "Back",
  "home.create.recovered.chores":
    "You already have a Home, so Homeowner loaded it instead. The Chores you reviewed were not added; add them from the Catalog in the Chores section.",
  "catalog.questions.heading": "About your Home",
  "catalog.questions.intro":
    "A few answers let Homeowner suggest the Chores your Home needs, so you do not start from an empty list. Nothing is saved yet, and you can change every suggestion on the next step. Leave alone any question that does not apply.",
  "catalog.questions.submit": "Suggest Chores",
  "catalog.questions.submitting": "Working out your Chores...",
  "catalog.questions.skip": "Skip and add Chores later",
  "catalog.questions.invalid": "Some answers need fixing. Check the fields below.",
  "catalog.questions.offline":
    "Homeowner cannot reach the service, so no Chores could be suggested. Your answers are still here; check your connection and try again.",
  "catalog.questions.error":
    "Something went wrong suggesting Chores. Your answers are still here; try again in a moment.",
  "catalog.answers.error.invalid": "This answer is not valid.",
  "catalog.answers.error.out_of_range": "This answer is outside the allowed range.",
  "catalog.answers.error.unknown": "This answer is not recognised.",
  "catalog.rooms.legend": "Rooms",
  "catalog.rooms.hint": "Each room gets its own Chores, so two bathrooms mean two bathroom Chores.",
  "catalog.rooms.range": "From 0 to {max}",
  "catalog.rooms.bedrooms": "Bedrooms",
  "catalog.rooms.bathrooms": "Bathrooms",
  "catalog.rooms.kitchens": "Kitchens",
  "catalog.rooms.livingRooms": "Living rooms",
  "catalog.rooms.laundryAreas": "Laundry areas",
  "catalog.outdoor.legend": "Outdoor space",
  "catalog.outdoor.hint": "Decides whether outdoor Chores such as sweeping or mowing are suggested.",
  "catalog.outdoor.none": "None",
  "catalog.outdoor.balcony": "Balcony",
  "catalog.outdoor.yard": "Yard",
  "catalog.outdoor.garden": "Garden",
  "catalog.pets.legend": "Pets",
  "catalog.pets.hint": "Each pet adds feeding and care Chores. Tick none if you have no pets.",
  "catalog.pets.dog": "Dog",
  "catalog.pets.cat": "Cat",
  "catalog.pets.fish": "Fish",
  "catalog.pets.bird": "Bird",
  "catalog.pets.other": "Another kind of pet",
  "catalog.collection.legend": "Trash and recycling collection",
  "catalog.collection.hint":
    "Tick the days the collection comes. The Chore of putting it out is then limited to those days. Leave a group empty if it is not collected.",
  "catalog.collection.trash": "Trash collection days",
  "catalog.collection.recycling": "Recycling collection days",
  "catalog.habits.legend": "Cooking and appliances",
  "catalog.habits.hint":
    "Cooking at home more often makes the kitchen need more care. The appliances you have change which Chores are suggested.",
  "catalog.habits.cooking.legend": "How often do you cook at home?",
  "catalog.habits.cooking.rarely": "Rarely",
  "catalog.habits.cooking.sometimes": "Sometimes",
  "catalog.habits.cooking.daily": "Every day",
  "catalog.habits.dishwasher": "We have a dishwasher",
  "catalog.habits.washingMachine": "We have a washing machine",
  "catalog.regenerate.prompt":
    "You changed your answers, so the suggested Chores will be worked out again and your edits to them will be lost. Continue?",
  "catalog.regenerate.confirm": "Yes, suggest again",
  "catalog.regenerate.cancel": "Keep my edits",
  "catalog.review.heading": "Review your Chores",
  "catalog.review.intro":
    "These are the Chores Homeowner suggests from your answers. Edit any that do not fit and remove any you do not want, then create your Home. You can add or change Chores at any time afterwards.",
  "catalog.review.count": { one: "{count} Chore suggested", other: "{count} Chores suggested" },
  "catalog.review.empty":
    "No Chores are suggested. You can create your Home now and add Chores from the Catalog afterwards.",
  "catalog.review.edit": "Edit",
  "catalog.review.remove": "Remove",
  "catalog.review.remove.label": "Remove {name}",
  "catalog.review.remove.prompt": "Remove {name} from the suggestions?",
  "catalog.review.remove.confirm": "Yes, remove",
  "catalog.review.remove.cancel": "Keep it",
  "catalog.review.removed": "{name} was removed.",
  "catalog.review.edited": "{name} was updated.",
  "catalog.review.item.invalid": "Fix this Chore before creating your Home.",
  "catalog.review.tooMany": "That is more Chores than can be created at once. Remove some and try again.",
  "catalog.review.lists.loading": "Getting ready to edit Chores...",
  "catalog.review.lists.error":
    "Something went wrong loading the lists needed to edit Chores. Try again in a moment.",
  "chores.addFromCatalog": "Add from the Catalog",
  "chores.catalog.heading": "Add from the Catalog",
  "chores.catalog.intro":
    "The Catalog is Homeowner's list of common Chores. Pick one to add it to your Home; you can change anything before it is saved. Pick a room Chore again to add it for another room.",
  "chores.catalog.loading": "Loading the Catalog...",
  "chores.catalog.load.offline":
    "Homeowner cannot reach the service, so the Catalog could not be loaded. Check your connection and try again.",
  "chores.catalog.load.error": "Something went wrong loading the Catalog. Try again in a moment.",
  "chores.catalog.perRoom": "Once for each room",
  "chores.catalog.add": "Add",
  "chores.catalog.add.label": "Add {name}",
  "chores.catalog.close": "Close the Catalog",
  "catalog.clean_kitchen": "Clean the kitchen",
  "catalog.wash_dishes": "Wash the dishes",
  "catalog.load_dishwasher": "Load and unload the dishwasher",
  "catalog.clean_fridge": "Clean the fridge",
  "catalog.clean_oven": "Clean the oven",
  "catalog.clean_bathroom": "Clean the bathroom",
  "catalog.change_bed_linen": "Change the bed linen",
  "catalog.tidy_living_room": "Tidy the living room",
  "catalog.clean_laundry_area": "Clean the laundry area",
  "catalog.wash_laundry": "Wash the laundry",
  "catalog.fold_laundry": "Fold and put away the laundry",
  "catalog.vacuum_floors": "Vacuum the floors",
  "catalog.mop_floors": "Mop the floors",
  "catalog.put_out_trash": "Put out the trash",
  "catalog.put_out_recycling": "Put out the recycling",
  "catalog.sweep_balcony": "Sweep the balcony",
  "catalog.mow_lawn": "Mow the lawn",
  "catalog.sweep_yard": "Sweep the yard",
  "catalog.weed_garden": "Weed the garden",
  "catalog.water_garden": "Water the garden",
  "catalog.walk_dog": "Walk the dog",
  "catalog.feed_dog": "Feed the dog",
  "catalog.bathe_dog": "Bathe the dog",
  "catalog.clean_litter_box": "Clean the litter box",
  "catalog.feed_cat": "Feed the cat",
  "catalog.feed_fish": "Feed the fish",
  "catalog.clean_fish_tank": "Clean the fish tank",
  "catalog.feed_bird": "Feed the bird",
  "catalog.clean_bird_cage": "Clean the bird cage",
  "catalog.care_for_pet": "Care for the pet",

  // Onboarding: the walk through install, reminders, profile and the Home for a new User
  "onboarding.progress": "Setting up: step {step} of {total}",
  "onboarding.loading": "Loading your setup...",
  "onboarding.load.offline":
    "Homeowner cannot reach the service, so we cannot tell where you left off. Check your connection and try again.",
  "onboarding.load.error": "Something went wrong loading your setup. Try again in a moment.",
  "onboarding.load.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "onboarding.retry": "Try again",
  "onboarding.next": "Next",
  "onboarding.back": "Back",
  "onboarding.saving": "Saving...",
  "onboarding.advance.offline":
    "Could not reach the service, so you are still on this step. Check your connection and try again.",
  "onboarding.advance.error": "Something went wrong saving your progress, so you are still on this step. Try again.",
  "onboarding.advance.notSignedIn": "Your sign-in has ended. Sign in again to carry on.",
  "onboarding.install.heading": "Add Homeowner to your Home Screen",
  "onboarding.install.why":
    "On iPhone, Apple only lets an app send notifications once it is on your Home Screen. Adding it now means the next step can turn reminders on, and Homeowner opens like any other app. Your progress is saved, so when you open Homeowner from its icon and sign in again, you will pick up right here.",
  "onboarding.install.done": "I have added it",
  "onboarding.reminders.heading": "Turn on reminders",
  "onboarding.reminders.why":
    "Homeowner decides each day who does which Task, and it can only tell you when the app is closed through a notification. Without reminders you would have to remember to open the app. They are a nudge: nothing breaks if you skip this, and you can turn them on later.",
  "onboarding.reminders.needsInstall":
    "Reminders can only be turned on once you open Homeowner from its Home Screen icon. Carry on from there to pick up this step, or skip it for now.",
  "onboarding.reminders.unsupported":
    "This browser cannot show reminders, so there is nothing to turn on here. You can carry on without them.",
  "onboarding.reminders.continue": "Continue",
  "onboarding.reminders.notNow": "Not now",
  "onboarding.baseline.heading": "Your Baseline",
  "onboarding.baseline.why":
    "Your Baseline is the Energy you can usually give on each day of the week. Homeowner uses it as the starting point for how much Effort to hand you, and your daily Check-in then says how today compares. We ask for all seven days so that it fits your week; enter 0 for a day when you cannot take on any Chores.",
  "onboarding.baseline.incomplete": "Enter a number for every day of the week before you continue. Use 0 if you cannot do any Chores that day.",
  "onboarding.restrictions.heading": "Your Restrictions",
  "onboarding.restrictions.why":
    "Some work asks too much of the body, such as heavy lifting or strong chemicals. Telling Homeowner now means a Chore with that Demand is never given to you. If nothing applies to you, leave everything unticked: that is a complete answer.",
  "onboarding.preferences.heading": "Your Preferences",
  "onboarding.preferences.why":
    "Everyone likes some housework more than other housework. Your Preferences help Homeowner give you more of the work you like and less of the work you dislike, and share out the work nobody likes in turns. Leaving a kind of work on Neutral is a fine answer.",
  "onboarding.home.heading": "Create your Home",
  "onboarding.home.why":
    "The last step. Your Home is where the daily sharing happens. The next questions tell Homeowner when your days start and what your Home needs done, so it can suggest the first Chores for you to review. You can change all of it later.",

  // Toasts
  "toast.dismiss": "Dismiss message",
  "toast.region": "Messages",
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof enUS;
