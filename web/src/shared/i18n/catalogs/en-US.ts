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
  "home.tagline": "Manage the housework in your Home.",
  "health.unavailable":
    "Service status: unavailable. The service is up but cannot reach its database.",
  "health.unreachable":
    "Service status: unreachable. Check your connection and try again.",
  "health.retry": "Try again",
  "auth.checking": "Checking your sign-in...",

  // Navigation
  "nav.label": "Main",
  "nav.today": "Today",
  "nav.chores": "Chores",
  "nav.home": "Home",
  "nav.me": "Me",
  "me.heading": "About you",

  // Home
  "home.loading": "Loading your Home",
  "home.load.offline":
    "Homeowner cannot reach the service, so your Home could not be loaded. Check your connection and try again.",
  "home.load.error":
    "Something went wrong loading your Home. Try again in a moment.",
  "home.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "home.retry": "Try again",
  "home.create.heading": "Create your Home",
  "home.create.submit": "Create Home",
  "home.create.submitting": "Creating...",
  "home.create.recovered":
    "You already have a Home, so Homeowner loaded it instead. Check its settings below.",
  "home.settings.heading": "Your Home",
  "home.settings.plan.heading": "Day Plan",
  "home.settings.plan.hint": "When each day's plan is made, in your Home's timezone.",
  "home.summary": "Plans are made at {time}, {zone} time.",
  "home.settings.save": "Save changes",
  "home.settings.saving": "Saving...",
  "home.settings.saved": "Your changes are saved.",
  "home.timezone.label": "Timezone",
  "home.allocationTime.label": "Allocation time",
  "home.save.offline":
    "Homeowner cannot reach the service. What you typed is still here; check your connection and try again.",
  "home.save.error":
    "Something went wrong and nothing was saved. What you typed is still here; try again in a moment.",
  "home.leave.heading": "Leave this Home",
  "home.leave.open": "Leave this Home",
  "home.leave.title": "Leave this Home?",
  "home.leave.removes":
    "Your Preferences and Restrictions for its Chores, and your places in its Day Plan, are removed.",
  "home.leave.stays":
    "Your Baseline and general Preferences and Restrictions come with you.",
  "home.leave.last":
    "If you are the last Resident, the Home and its Chores are deleted for good.",
  "home.leave.cancel": "Cancel",
  "home.leave.confirm": "Leave Home",
  "home.leave.leaving": "Leaving...",
  "home.leave.offline":
    "Homeowner cannot reach the service, so you have not left. Check your connection and try again.",
  "home.leave.error":
    "Something went wrong and you have not left. Try again in a moment.",
  "home.invalid.summary": "Some details need fixing. Check the fields below.",
  "home.field.timezone.required": "Choose a timezone.",
  "home.field.timezone.unknown":
    "That timezone is not recognised. Choose one from the list.",
  "home.field.allocationTime.required": "Choose an Allocation time.",
  "home.field.allocationTime.invalid":
    "That is not a valid time. Choose one from the list.",
  "home.field.allocationTime.not_quarter_hour":
    "The Allocation time must be on a quarter hour: :00, :15, :30 or :45.",
  "home.field.unknown": "This value is not accepted. Check it and try again.",

  // Reminders
  "reminders.on": "Reminders are on for this device.",
  "reminders.enable": "Enable reminders",
  "reminders.enabling": "Turning on...",
  "reminders.problem.denied":
    "Notifications are blocked for Homeowner. Allow them in your phone's Settings, under Notifications.",
  "reminders.problem.dismissed":
    "You closed the permission question. Tap the button to try again.",
  "reminders.problem.notConfigured":
    "Reminders are not set up on the service yet. Try again later.",
  "reminders.problem.notSignedIn":
    "You are not signed in any more. Sign in again, then turn on reminders.",
  "reminders.problem.error":
    "Something went wrong turning on reminders. Check your connection and try again.",
  "reminders.problem.browserRegister":
    "This browser could not register with its notification service. Use Chrome and make sure Google Play services is up to date.",
  "reminders.problem.browserNotAllowed":
    "Notifications are not allowed for this app. Check Settings, Apps, Homeowner, Notifications.",
  "reminders.problem.browserRefused":
    "Your browser refused to turn on reminders ({name}).",

  // iPhone install steps
  "install.heading": "Add Homeowner to your Home Screen",
  "install.step1": "Open this page in Safari (not inside another app).",
  "install.step2":
    "Tap the Share button, the square with an arrow, at the bottom of the screen.",
  "install.step3": "Scroll down and tap Add to Home Screen, then tap Add.",
  "install.step4":
    "Close Safari and open Homeowner from its new icon on your Home Screen.",

  // Profile
  "profile.loading": "Loading your details",
  "profile.offline":
    "Could not reach the service, so your details are not shown. Check your connection and try again.",
  "profile.error":
    "Something went wrong loading your details. Try again in a moment.",
  "profile.notSignedIn":
    "You are not signed in any more. Sign in again to see your details.",
  "profile.retry": "Try again",
  "profile.saved": "Saved.",
  "profile.saveFailed":
    "Could not save your change, so it was undone. Check your connection and try again.",
  "profile.saveFailed.notSignedIn":
    "You are not signed in any more, so your change was undone. Sign in again.",
  "profile.baseline.heading": "Baseline",
  "profile.baseline.hint": "Your usual Energy on each day of the week. Your Check-in adjusts it for the day.",
  "profile.baseline.level.low": "Low",
  "profile.baseline.level.normal": "Normal",
  "profile.baseline.level.high": "High",
  "profile.preferences.heading": "Preferences",
  "profile.preferences.hint": "Work you like is planned for you more often. Essential work still comes first.",
  "profile.preference.like": "Like",
  "profile.preference.neutral": "Neutral",
  "profile.preference.dislike": "Dislike",
  "profile.restrictions.heading": "Restrictions",
  "profile.restrictions.hint": "Work you cannot do. You are never given it.",
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
  "chores.count": {
    one: "{count} Chore in your Home",
    other: "{count} Chores in your Home",
  },
  "chores.loading": "Loading your Chores",
  "chores.load.offline":
    "Your Chores could not be loaded because Homeowner cannot reach the service. Check your connection and try again.",
  "chores.load.error":
    "Something went wrong loading your Chores. Try again in a moment.",
  "chores.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "chores.retry": "Try again",
  "chores.empty": "No Chores yet.",
  "chores.add": "Add a Chore",
  "effort.level.very_light": "Very light",
  "effort.level.light": "Light",
  "effort.level.medium": "Medium",
  "effort.level.heavy": "Heavy",
  "effort.level.very_heavy": "Very heavy",
  "chores.item.effort": "Effort: {level}",
  "chores.item.people.one": "1 person",
  "chores.item.people.two": "2 people",
  "chores.item.once": "One-off",
  "chores.item.daily": "Every day",
  "chores.item.every": "Every {days} days",
  "chores.interval.daily": "Daily",
  "chores.interval.weekly": "Weekly",
  "chores.interval.every_2_weeks": "Every 2 weeks",
  "chores.interval.monthly": "Monthly",
  "chores.interval.custom": "Custom",
  "chores.item.weekdays": "Only on {days}",
  "chores.item.buildsUp": "Builds up while undone",
  "chores.item.edit.label": "Edit {name}",
  "chores.item.delete.label": "Delete {name}",
  "chores.delete.prompt": "Delete {name}? This cannot be undone.",
  "chores.delete.confirm": "Yes, delete",
  "chores.delete.cancel": "Keep it",
  "chores.delete.deleting": "Deleting...",
  "chores.delete.offline":
    "The Chore was not deleted because Homeowner cannot reach the service. Check your connection and try again.",
  "chores.delete.error":
    "Something went wrong and the Chore was not deleted. Try again in a moment.",
  "chores.delete.notSignedIn":
    "Your sign-in has ended, so the Chore was not deleted. Sign in again to continue.",
  "chores.form.create.heading": "Add a Chore",
  "chores.form.edit.heading": "Edit Chore",
  "chores.form.name.label": "Name",
  "chores.form.category.label": "Category",
  "chores.form.category.placeholder": "Choose a Category",
  "chores.form.demands.legend": "Demands",
  "chores.form.baseEffort.legend": "Effort",
  "chores.form.importance.legend": "Importance",
  "chores.form.people.legend": "People it takes",
  "chores.form.people.one": "One person",
  "chores.form.people.two": "Two people",
  "chores.form.suggestion": "A Chore this draining is easier shared.",
  "chores.form.suggestion.action": "Make it two-person",
  "chores.form.interval.legend": "How often",
  "chores.form.intervalDays.label": "Repeat every (days)",
  "chores.form.intervalDays.hint": "Leave blank for a one-off Chore.",
  "chores.form.allowedWeekdays.legend": "Only on these days",
  "chores.form.buildsUp.label": "Builds up while undone",
  "chores.form.submit.create": "Add Chore",
  "chores.form.submit.save": "Save Chore",
  "chores.form.saving": "Saving...",
  "chores.form.cancel": "Cancel",
  "chores.form.saved": "The Chore is saved.",
  "chores.form.invalid.summary":
    "Some details need fixing. Check the fields below.",
  "chores.form.save.offline":
    "The Chore was not saved because Homeowner cannot reach the service. What you typed is still here; check your connection and try again.",
  "chores.form.save.error":
    "Something went wrong and the Chore was not saved. What you typed is still here; try again in a moment.",
  "chores.form.save.notSignedIn":
    "Your sign-in has ended, so the Chore was not saved. Sign in again to continue.",
  "chores.form.save.gone":
    "This Chore no longer exists, perhaps because another Resident deleted it.",
  "chores.field.name.required": "Give the Chore a name.",
  "chores.field.name.too_long":
    "That name is too long. Use 100 characters or fewer.",
  "chores.field.category.required": "Choose a Category.",
  "chores.field.category.unknown":
    "That Category is not recognised. Choose one from the list.",
  "chores.field.importance.required": "Choose an Importance.",
  "chores.field.importance.unknown":
    "That Importance is not recognised. Choose one from the list.",
  "chores.field.demands.unknown":
    "One of the Demands is not recognised. Untick it and try again.",
  "chores.field.baseEffort.required": "Choose an Effort level.",
  "chores.field.baseEffort.invalid": "Choose one of the Effort levels.",
  "chores.field.baseEffort.out_of_range": "Choose one of the Effort levels.",
  "chores.field.people.required": "Choose one or two people.",
  "chores.field.people.invalid": "People must be 1 or 2.",
  "chores.field.people.out_of_range": "A Chore takes one or two people.",
  "chores.field.intervalDays.required":
    "Enter how many days, or leave it blank for a one-off Chore.",
  "chores.field.intervalDays.invalid":
    "Enter a whole number of days, or leave it blank for a one-off Chore.",
  "chores.field.intervalDays.out_of_range":
    "Repeat every 1 to 365 days, or leave it blank for a one-off Chore.",
  "chores.field.allowedWeekdays.invalid":
    "One of the days is not valid. Untick it and try again.",
  "chores.field.allowedWeekdays.out_of_range":
    "One of the days is not valid. Untick it and try again.",
  "chores.field.unknown": "This value is not accepted. Check it and try again.",

  // Today (the Day Plan)
  "dayplan.heading": "Today",
  "dayplan.loading": "Loading today's plan",
  "dayplan.load.offline":
    "Today's plan could not be loaded because Homeowner cannot reach the service. Check your connection and try again.",
  "dayplan.load.error":
    "Something went wrong loading today's plan. Try again in a moment.",
  "dayplan.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "dayplan.retry": "Try again",
  "dayplan.notPlanned": "Today's plan is made at {time}.",
  "dayplan.rejected":
    "Today's plan could not be used, so no Tasks were given today.",
  "dayplan.greeting.morning": "Good morning",
  "dayplan.greeting.afternoon": "Good afternoon",
  "dayplan.greeting.evening": "Good evening",
  "dayplan.energy.value": "Energy {energy}",
  "dayplan.energy.planned": "{planned} of {energy} planned for you",
  "dayplan.energy.drained": "Drained today, no Tasks",
  "dayplan.energy.noBaseline": "Set your Baseline to get Energy",
  "dayplan.mine.heading": "Your Tasks",
  "dayplan.mine.empty": "Nothing for you today. Enjoy the day.",
  "dayplan.mine.empty.noBaseline":
    "No Baseline for today, so no Tasks for you.",
  "dayplan.mine.empty.noBaseline.link": "Set your Baseline",
  "dayplan.others.heading": "Other Residents' Tasks",
  "dayplan.others.resident": "Resident {number}",
  "dayplan.summary.mine": { one: "{count} Task for you", other: "{count} Tasks for you" },
  "dayplan.summary.others": { one: "{count} for others", other: "{count} for others" },
  "dayplan.summary.pool": { one: "{count} still to do", other: "{count} still to do" },
  "dayplan.pool.heading": "Still to do",
  "dayplan.pool.empty": "No other open Tasks. Everything is planned or done.",
  "dayplan.task.effort": "Effort: {level}",
  "dayplan.task.effort.grown": "Effort: {level}, usually {base}",
  "dayplan.task.due": "Due {date}",
  "dayplan.task.dueToday": "Due today",
  "dayplan.task.duePast": "Was due {date}",
  "dayplan.task.reason": "Why: {reason}",
  "dayplan.assigned.reason.deadline_today": "It is due today.",
  "dayplan.assigned.reason.importance": "It matters most.",
  "dayplan.assigned.reason.lateness": "It has waited the longest.",
  "dayplan.assigned.reason.fits_energy": "It fits your Energy.",
  "dayplan.pool.reason.no_energy_left": "No one has enough Energy left today.",
  "dayplan.pool.reason.restricted_for_all":
    "No one can do it: every Resident has a Restriction on it.",
  "dayplan.pool.reason.weekday_not_allowed":
    "It is not allowed on this day of the week.",
  "dayplan.pool.reason.two_person_deferred":
    "It needs two people, and they were not both free today.",
  "dayplan.pool.reason.invalid_effort":
    "Its Effort is not valid, so it was left out. Edit the Chore to fix it.",
  "dayplan.pool.reason.added_after_plan":
    "It was added after today's plan was made.",
  "dayplan.mine.empty.drained":
    "You checked in as Drained, so no Tasks today. Rest up.",
  "dayplan.pool.reason.refused": "It was refused, so it is back in the pool.",
  "dayplan.assigned.reason.taken": "You took it from the pool.",
  "dayplan.assigned.reason.liked": "You like this one.",
  "dayplan.assigned.reason.spared_dislike": "Spared a Chore you dislike.",
  "dayplan.assigned.reason.turn_taking": "It is your turn.",
  "dayplan.action.accept": "Accept",
  "dayplan.action.accept.named": "Accept {task}",
  "dayplan.action.acceptAll": {
    one: "Accept {count} Task",
    other: "Accept all {count} Tasks",
  },
  "dayplan.action.refuse": "Refuse",
  "dayplan.action.refuse.named": "Refuse {task}",
  "dayplan.action.take": "Take",
  "dayplan.action.take.named": "Take {task}",
  "dayplan.action.done": "Done",
  "dayplan.action.done.named": "Done with {task}",
  "dayplan.task.committed": "Committed",
  "dayplan.task.suggestTwoPerson": "This keeps growing. Make it two-person?",
  "dayplan.task.suggestTwoPerson.action": "Make it two-person",
  "dayplan.task.suggestTwoPerson.action.named": "Make {task} two-person",
  "dayplan.done.heading": "Done today",
  "dayplan.done.item": "{task} at {time}",
  "dayplan.action.failed.offline":
    "You seem to be offline, so that did not go through. Check your connection and try again.",
  "dayplan.action.failed.error":
    "Something went wrong and that did not go through. Try again in a moment.",
  "dayplan.replan.action": "Replan now",
  "dayplan.replan.waiting": "Replanning. This can take a minute.",
  "dayplan.replan.timedOut": "The new plan is taking a while. It may still arrive, so check back in a moment.",
  "dayplan.replan.done.llm": "The AI made this plan.",
  "dayplan.replan.done.baseline": "The baseline planner made this plan, without the AI.",
  "dayplan.replan.fallback.llm_daily_cap_reached":
    "This is the baseline plan, not the AI's: the daily AI limit was reached.",
  "dayplan.replan.fallback.llm_error": "This is the baseline plan, not the AI's: the AI had a problem.",
  "dayplan.replan.fallback.llm_timeout": "This is the baseline plan, not the AI's: the AI took too long.",
  "dayplan.replan.fallback.llm_invalid_response":
    "This is the baseline plan, not the AI's: the AI's answer could not be used.",
  "dayplan.replan.fallback.llm_rejected_by_checker":
    "This is the baseline plan, not the AI's: the AI's plan did not pass the check.",
  "dayplan.replan.fallback.unknown": "This is the baseline plan, not the AI's: the AI's plan was not used.",
  "dayplan.conflict.already_done":
    "That Task was already done. It is in Done today now.",
  "dayplan.conflict.not_proposed":
    "That Task changed since you looked. Your list is up to date.",
  "dayplan.conflict.already_committed":
    "That Task changed since you looked. Your list is up to date.",
  "dayplan.conflict.not_in_pool":
    "Someone else already has that Task. Your list is up to date.",
  "dayplan.conflict.not_yours":
    "Someone else has that Task. Your list is up to date.",
  "dayplan.conflict.no_plan_today": "There is no plan for today yet.",
  "dayplan.conflict.two_person_task":
    "That Task needs two people, which is not available yet.",
  "dayplan.conflict.restricted":
    "You have a Restriction on that Task, so it is not for you today.",
  "dayplan.conflict.drained":
    "You checked in Drained today, so rest: this can wait.",
  "dayplan.conflict.unknown":
    "The plan changed since you looked. Your list is up to date.",

  // The start choice, at the end of both onboarding flows
  "startChoice.heading": "When do you want your Tasks?",
  "startChoice.now.button": "Get my tasks right away",
  "startChoice.tomorrow.button": "Start tomorrow",
  "startChoice.planning": "Planning your Tasks...",
  "startChoice.retry": "Try again",
  "startChoice.failed.offline":
    "You seem to be offline, so your Tasks were not planned. Check your connection and try again.",
  "startChoice.failed.error":
    "Something went wrong planning your Tasks. Try again in a moment.",
  "startChoice.done.tasks": "Your Tasks for today are ready.",
  "startChoice.done.noEnergy":
    "Your Energy today is 0, so you have no Tasks. Set your Baseline on the Me tab.",
  "startChoice.done.nothing":
    "No open Tasks are left for you today. Enjoy the day.",
  "startChoice.done.close": "Got it",

  // Streak
  "streak.heading": "Streak",
  "streak.days": {
    one: "{count}-day Streak",
    other: "{count}-day Streak",
  },
  "streak.empty": "Finish a Task to start one",
  "streak.todayCounts": "Today counts",

  // Check-in
  "checkin.heading": "Check-in",
  "checkin.prompt": "How are you today?",
  "checkin.open": "Check in",
  "checkin.load.offline":
    "Your Check-in could not be loaded because Homeowner cannot reach the service. Check your connection and try again.",
  "checkin.load.error":
    "Something went wrong loading your Check-in. Try again in a moment.",
  "checkin.notSignedIn": "Your sign-in has ended. Sign in again to continue.",
  "checkin.retry": "Try again",
  "checkin.level.legend": "How is your Energy today?",
  "checkin.level.drained": "Drained",
  "checkin.level.drained.hint": "No Tasks today",
  "checkin.level.low": "Low",
  "checkin.level.normal": "Normal",
  "checkin.level.energized": "Energized",
  "checkin.level.required": "Choose how your Energy is today, then save.",
  "checkin.restrictions.legend": "Anything you cannot do today?",
  "checkin.submit": "Save",
  "checkin.cancel": "Cancel",
  "checkin.change": "Change",
  "checkin.saved": "Check-in saved",
  "checkin.save.offline":
    "Your Check-in was not saved because Homeowner cannot reach the service. Check your connection and try again.",
  "checkin.save.error":
    "Something went wrong saving your Check-in. Try again in a moment.",
  "checkin.save.invalid":
    "Homeowner did not accept that Check-in. Choose again and try once more.",
  "checkin.summary": "Today's Check-in: {level}",
  "checkin.summary.restrictions": "Not today: {demands}",

  // Sign up
  "signUp.heading": "Sign up",
  "signUp.hint": "Make an account, then create your Home or join one.",
  "signUp.emailLabel": "Email",
  "signUp.passwordLabel": "Password",
  "signUp.confirmLabel": "Confirm password",
  "signUp.mismatch": "The two passwords do not match.",
  "signUp.submit": "Sign up",
  "signUp.submitting": "Signing up...",
  "signUp.haveLogin": "Already signed up?",
  "signUp.haveLoginAction": "Sign in",

  // Sign in
  "signIn.heading": "Sign in",
  "signIn.hint": "See what is yours to do today.",
  "signIn.confirmedNotice": "Your email is confirmed. Sign in to start.",
  "signIn.emailLabel": "Email",
  "signIn.passwordLabel": "Password",
  "signIn.submit": "Sign in",
  "signIn.submitting": "Signing in...",
  "signIn.newHere": "New here?",
  "signIn.newHereAction": "Sign up",

  // Confirm email
  "confirm.heading": "Confirm your email",
  "confirm.intro": "We sent a code to {email}.",
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
    "Cannot reach the service. This is the last sign-in this device remembers.",
  "signedIn.signOut": "Sign out",

  // Shared by the auth screens
  "auth.showPassword": "Show password",

  "auth.failure.alreadyRegistered":
    "That email is already signed up. Sign in instead, or confirm it if you never entered the code.",
  "auth.failure.invalidPassword":
    "That password is not strong enough. Choose a different password. {rules}",
  "auth.failure.invalidInput":
    "Check the email and the details you typed, then try again.",
  "auth.failure.wrongCode":
    "That code is not right. Check the latest email and try again.",
  "auth.failure.expiredCode":
    "That code has expired. Request a new code and use the latest email.",
  "auth.failure.notConfirmed":
    "Confirm your email first: enter the code we sent, or request a new code.",
  "auth.failure.notAuthorized":
    "The email or password is not right. Check both and try again.",
  "auth.failure.rateLimited":
    "Too many attempts. Wait a few minutes, then try again.",
  "auth.failure.network":
    "Could not reach the sign-in service. Check your connection and try again.",
  "auth.failure.error": "Something went wrong. Try again in a moment.",

  // Password rules. The checklist uses auth.rule.*; the one-sentence text uses auth.rules.*.
  "auth.rule.length": {
    one: "At least {count} character",
    other: "At least {count} characters",
  },
  "auth.rule.lowercase": "A lower case letter",
  "auth.rule.uppercase": "An upper case letter",
  "auth.rule.number": "A number",
  "auth.rule.symbol": "A symbol",
  "auth.rule.status.met": "{rule}: Met",
  "auth.rule.status.notMet": "{rule}: Not met yet",
  "auth.rule.announce.met": "{rule} met.",
  "auth.rule.announce.notMet": "{rule} not met.",
  "auth.rule.announce.count": {
    one: "{met} of {count} rule met.",
    other: "{met} of {count} rules met.",
  },
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
  "invite.lookup.problem":
    "Homeowner could not check your Invite right now. Your link is kept, so you can still sign in and try again.",
  "invite.dead.not_found":
    "This Invite link is not valid. It may have been copied wrongly. Ask the Resident for a new Invite.",
  "invite.dead.used":
    "This Invite was already used. An Invite works only once, so ask the Resident for a new one.",
  "invite.dead.expired":
    "This Invite has expired. An Invite lasts seven days, so ask the Resident for a new one.",
  "invite.dead.continue": "Continue",
  "invite.join.heading": "Join a Home",
  "invite.join.loading": "Getting your Invite ready...",
  "invite.join.submit": "Join this Home",
  "invite.join.submitting": "Joining...",
  "invite.join.dismiss": "Not now",
  "invite.leave.heading": "Joining means leaving your Home",
  "invite.leave.warning":
    "Joining this Home means leaving your current one. Your Preferences and Restrictions for its Chores are deleted. If you are its last Resident, the Home and its Chores are deleted too.",
  "invite.leave.confirm": "Leave my Home and join this one",
  "invite.leave.cancel": "Stay in my Home",
  "invite.alreadyHere":
    "You already live in this Home, so there was nothing to join. The Invite was not used up.",
  "invite.failure.offline":
    "Homeowner cannot reach the service, so you have not joined. Your Invite is kept; check your connection and try again.",
  "invite.failure.error":
    "Something went wrong and you have not joined. Your Invite is kept; try again in a moment.",
  "invite.failure.notSignedIn":
    "Your sign-in has ended. Sign in again to continue.",
  "invite.failure.retry": "Try again",
  "invite.rating.heading": "Rate the biggest Chores",
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
  "invite.share.hint": "A single-use link for someone you live with. It works for seven days.",
  "invite.share.button": "Share an Invite link",
  "invite.share.creating": "Making the Invite...",
  "invite.share.title": "Join my Home on Homeowner",
  "invite.share.text":
    "Join my Home on Homeowner. This link works once and lasts seven days.",
  "invite.share.shared":
    "Your Invite is ready and was handed to the app you chose.",
  "invite.share.copied":
    "Your Invite link is copied. Paste it into a message to send it.",
  "invite.share.failed":
    "The Invite link could not be shared or copied. Try again.",
  "invite.share.tooMany":
    "Your Home already has the most open Invites allowed. Wait for some to be used or to expire.",
  "invite.share.noHome": "You need a Home before you can invite anyone.",
  "invite.share.offline":
    "Homeowner cannot reach the service, so no Invite was made. Check your connection and try again.",
  "invite.share.error":
    "Something went wrong and no Invite was made. Try again in a moment.",

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
    "You already have a Home, so it was loaded. The Chores you reviewed were not added; add them from the Catalog.",
  "catalog.questions.heading": "About your Home",
  "catalog.questions.submit": "Suggest Chores",
  "catalog.questions.submitting": "Working out your Chores...",
  "catalog.questions.skip": "Skip and add Chores later",
  "catalog.questions.invalid":
    "Some answers need fixing. Check the fields below.",
  "catalog.questions.offline":
    "Homeowner cannot reach the service, so no Chores could be suggested. Your answers are still here; check your connection and try again.",
  "catalog.questions.error":
    "Something went wrong suggesting Chores. Your answers are still here; try again in a moment.",
  "catalog.answers.error.invalid": "This answer is not valid.",
  "catalog.answers.error.out_of_range":
    "This answer is outside the allowed range.",
  "catalog.answers.error.unknown": "This answer is not recognised.",
  "catalog.rooms.legend": "Rooms",
  "catalog.rooms.range": "From 0 to {max}",
  "catalog.rooms.bedrooms": "Bedrooms",
  "catalog.rooms.bathrooms": "Bathrooms",
  "catalog.rooms.kitchens": "Kitchens",
  "catalog.rooms.livingRooms": "Living rooms",
  "catalog.rooms.laundryAreas": "Laundry areas",
  "catalog.outdoor.legend": "Outdoor space",
  "catalog.outdoor.none": "None",
  "catalog.outdoor.balcony": "Balcony",
  "catalog.outdoor.yard": "Yard",
  "catalog.outdoor.garden": "Garden",
  "catalog.pets.legend": "Pets",
  "catalog.pets.dog": "Dog",
  "catalog.pets.cat": "Cat",
  "catalog.pets.fish": "Fish",
  "catalog.pets.bird": "Bird",
  "catalog.pets.other": "Another kind of pet",
  "catalog.collection.legend": "Trash and recycling collection",
  "catalog.collection.trash": "Trash collection days",
  "catalog.collection.recycling": "Recycling collection days",
  "catalog.habits.legend": "Cooking and appliances",
  "catalog.habits.cooking.legend": "How often do you cook at home?",
  "catalog.habits.cooking.rarely": "Rarely",
  "catalog.habits.cooking.sometimes": "Sometimes",
  "catalog.habits.cooking.daily": "Every day",
  "catalog.habits.dishwasher": "We have a dishwasher",
  "catalog.habits.washingMachine": "We have a washing machine",
  "catalog.regenerate.prompt":
    "Changing your answers suggests the Chores again and loses your edits. Continue?",
  "catalog.regenerate.confirm": "Yes, suggest again",
  "catalog.regenerate.cancel": "Keep my edits",
  "catalog.review.heading": "Review your Chores",
  "catalog.review.count": {
    one: "{count} Chore suggested",
    other: "{count} Chores suggested",
  },
  "catalog.review.empty": "No Chores are suggested.",
  "catalog.review.remove.label": "Remove {name}",
  "catalog.review.remove.prompt": "Remove {name} from the suggestions?",
  "catalog.review.remove.confirm": "Yes, remove",
  "catalog.review.remove.cancel": "Keep it",
  "catalog.review.removed": "{name} was removed.",
  "catalog.review.edited": "{name} was updated.",
  "catalog.review.item.invalid": "Fix this Chore before creating your Home.",
  "catalog.review.tooMany":
    "That is more Chores than can be created at once. Remove some and try again.",
  "catalog.review.lists.loading": "Getting ready to edit Chores...",
  "catalog.review.lists.error":
    "Something went wrong loading the lists needed to edit Chores. Try again in a moment.",
  "chores.addFromCatalog": "Add from the Catalog",
  "chores.catalog.heading": "Add from the Catalog",
  "chores.catalog.loading": "Loading the Catalog...",
  "chores.catalog.load.offline":
    "Homeowner cannot reach the service, so the Catalog could not be loaded. Check your connection and try again.",
  "chores.catalog.load.error":
    "Something went wrong loading the Catalog. Try again in a moment.",
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
  "onboarding.load.error":
    "Something went wrong loading your setup. Try again in a moment.",
  "onboarding.load.notSignedIn":
    "Your sign-in has ended. Sign in again to continue.",
  "onboarding.retry": "Try again",
  "onboarding.next": "Next",
  "onboarding.back": "Back",
  "onboarding.saving": "Saving...",
  "onboarding.advance.offline":
    "Could not reach the service, so you are still on this step. Check your connection and try again.",
  "onboarding.advance.error":
    "Something went wrong saving your progress, so you are still on this step. Try again.",
  "onboarding.advance.notSignedIn":
    "Your sign-in has ended. Sign in again to carry on.",
  "onboarding.install.heading": "Add Homeowner to your Home Screen",
  "onboarding.install.done": "I have added it",
  "onboarding.reminders.heading": "Turn on reminders",
  "onboarding.reminders.intro":
    "A nudge on this device when your Check-in is due. The app also asks for it whenever you open it, so reminders are optional.",
  "onboarding.reminders.needsInstall":
    "Open Homeowner from its Home Screen icon to turn on reminders, or skip this step.",
  "onboarding.reminders.unsupported": "This browser cannot show reminders.",
  "onboarding.reminders.continue": "Continue",
  "onboarding.reminders.notNow": "Not now",
  "onboarding.baseline.heading": "Your Baseline",
  "onboarding.baseline.intro":
    "How much Energy you usually have on each day of the week. Your daily Check-in adjusts it, so a rough guess is enough.",
  "onboarding.baseline.incomplete":
    "Enter a number for every day, or 0 for a day with no Chores.",
  "onboarding.restrictions.heading": "Your Restrictions",
  "onboarding.preferences.heading": "Your Preferences",
  "onboarding.home.heading": "Create your Home",

  // Toasts
  "toast.dismiss": "Dismiss message",
  "toast.region": "Messages",
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof enUS;
