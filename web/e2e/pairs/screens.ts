// Which artboard of docs/design/homeowner/ shows which screen of the app, and which artboards a change selects.
// Plain data and pure functions, so Vitest can check them (screens.test.ts) without a browser.

/** The world a screen is shot in: the fake state it starts from and what is done around the first load. */
export type Data =
  | "default" // a Resident with a planned day, checked in
  | "unchecked" // today has no Check-in yet
  | "done" // every Task of the plan is done
  | "no-chores" // a Home with no Chores
  | "loading" // the day-plan read is held, and the shot is taken before it is released
  | "offline" // the plan is shown from the cache after the network goes away
  | "signed-out" // no session
  | "onboarding" // signed in, no Home yet
  | "invite" // signed in, with an Invite link to open
  | "signed-out-invite"; // no session, with an Invite link to open

/** What is done on the loaded screen before the shot. Each name has an opener in openers.ts. */
export const STATES = [
  "check-in", // the Check-in dialog (it opens by itself on an unchecked day)
  "check-in-later", // the Check-in dialog closed with "Agora não", so the hero asks the question
  "task", // the Sheet of the first Task card
  "swap", // the dialog to offer a Swap, from the menu of another Resident's Task
  "streak", // the Streak dialog
  "voice", // the voice panel
  "start-choice", // the start choice, after joining through an Invite
  "invite-rating", // the rating step, after joining through an Invite
  "leave", // the Leave Home confirm
  "confirm-email", // the Confirm screen, which needs the e-mail from the sign-up step
] as const;
export type State = (typeof STATES)[number];

/** An artboard the app shows today. */
export interface Screen {
  /** The folders of `web/src/domains/` that own it: a change in one of them selects this screen. */
  domains: string[];
  /** The path to open, search included. */
  path: string;
  data?: Data;
  state?: State;
}
/** An artboard with nothing to shoot yet: why, and the ticket that removes the entry when it names one. */
export interface NoScreen {
  none: string;
}
export type Entry = Screen | NoScreen;

const at = (path: string, domains: string[], rest: Pick<Screen, "data" | "state"> = {}): Screen => ({ path, domains, ...rest });
const none = (reason: string): NoScreen => ({ none: reason });

const onboard = (step: string, domains: string[]): Screen => at(`/welcome/${step}`, ["onboarding", ...domains], { data: "onboarding" });
const TODAY = ["dayplan"];

/** One entry per file of docs/design/homeowner/, by artboard name. screens.test.ts fails when a file has none. */
export const SCREENS: Record<string, Entry> = {
  // Hoje
  Main: at("/", [...TODAY, "streak", "voice"]),
  TodayCheckIn: at("/", ["checkin", ...TODAY], { data: "unchecked", state: "check-in-later" }),
  TodayDone: at("/", TODAY, { data: "done" }),
  TodayLoading: at("/", TODAY, { data: "loading" }),
  TodayOffline: at("/", TODAY, { data: "offline" }),
  CheckIn: at("/", ["checkin"], { data: "unchecked", state: "check-in" }),
  TaskSheet: at("/", TODAY, { state: "task" }),
  SwapSheet: at("/", TODAY, { state: "swap" }),
  StreakSheet: at("/", ["streak"], { state: "streak" }),
  VoiceSheet: at("/", ["voice"], { state: "voice" }),
  StartChoice: at("/#invite=abc123", ["startchoice", "invite"], { data: "invite", state: "start-choice" }),
  // Afazeres
  Chores: at("/chores", ["chores"]),
  ChoreSheet: at("/chores?edit=louca", ["chores"]),
  ChoresEmpty: at("/chores", ["chores"], { data: "no-chores" }),
  CatalogQuestions: none("The Catalog's questions open from the Chores screen's Do Catálogo menu item; today it lists entries with no questions."),
  CatalogReview: none("The Catalog's suggestions open from the Chores screen's Do Catálogo menu item; today it lists entries with no review step."),
  // Lar
  Home: at("/home", ["home", "residents"]),
  Resident: at("/home/residents/resident-2", ["residents"]),
  InviteSheet: none("The Invite opens a Sheet from the Home screen's rows in #894."),
  HomeSettings: none("Home settings open a Sheet from the Home screen's rows in #894."),
  LeaveDialog: at("/home", ["home"], { state: "leave" }),
  // Eu
  Me: at("/me", ["profile", "settings"]),
  NameEdit: at("/me/edit", ["profile"]),
  BaselineSheet: none("The Baseline opens a Sheet from a row of Me in #895."),
  PreferencesSheet: none("The Preferences open a Sheet from a row of Me in #895."),
  RestrictionsSheet: none("The Restrictions open a Sheet from a row of Me in #895."),
  Completions: at("/me", ["residents"]),
  AppearanceSheet: none("Appearance and language open a Sheet from a row of Me in #895."),
  AccountSheet: none("The account opens a Sheet from a row of Me in #895."),
  // Entrada
  SignIn: at("/signin", ["auth"], { data: "signed-out" }),
  SignUp: at("/signup", ["auth"], { data: "signed-out" }),
  Confirm: at("/signup", ["auth"], { data: "signed-out", state: "confirm-email" }),
  ForgotPassword: at("/forgot-password", ["auth"], { data: "signed-out" }),
  OnboardHome: onboard("home", ["home", "catalog"]),
  OnboardBaseline: onboard("baseline", ["profile"]),
  OnboardRestrictions: onboard("restrictions", ["profile"]),
  OnboardPreferences: onboard("preferences", ["profile"]),
  OnboardReminders: onboard("reminders", ["push"]),
  InviteSignedOut: at("/#invite=abc123", ["invite"], { data: "signed-out-invite" }),
  InviteRating: at("/#invite=abc123", ["invite"], { data: "invite", state: "invite-rating" }),
  // Partes
  BottomBar: none("A part: every tab shot shows it."),
  Parts: none("A component sheet, not a screen."),
};

/** The four tabs: a change to the app frame shoots them all. */
const TABS = ["Main", "Chores", "Home", "Me"];

/**
 * Artboards that overflow the 390px phone today, each with the screen ticket that removes the entry.
 * Lowering MAX_EXEMPT is how that ticket proves it: the list only shrinks (screens.test.ts).
 */
export const OVERFLOW_EXEMPT = new Set<string>([]);
export const MAX_EXEMPT = 0;

/**
 * Artboards with a serious or critical axe violation that is not fixed yet: each entry needs a reason comment and a ticket.
 * Lowering MAX_AXE_EXEMPT is how the fix proves it: the list only shrinks (screens.test.ts).
 */
export const AXE_EXEMPT = new Set<string>([]);
export const MAX_AXE_EXEMPT = 0;

/** The artboards a pull request's changed files select, sorted: the ones of each domain folder changed, the four tabs for the app frame, and `Main` when only shared code changed. */
export function changedArtboards(changedFiles: string[]): string[] {
  const files = changedFiles.filter((f) => !/\.test\.tsx?$/.test(f) && !f.startsWith("web/src/sw"));
  const domains = new Set(files.map((f) => /^web\/src\/domains\/([^/]+)\//.exec(f)?.[1]).filter((d): d is string => d !== undefined));
  const frame = files.some((f) => f.startsWith("web/src/app/"));
  const picked = new Set(frame ? TABS : []);
  for (const [name, entry] of Object.entries(SCREENS)) {
    if ("domains" in entry && entry.domains.some((d) => domains.has(d))) picked.add(name);
  }
  return picked.size > 0 ? [...picked].sort() : ["Main"];
}
