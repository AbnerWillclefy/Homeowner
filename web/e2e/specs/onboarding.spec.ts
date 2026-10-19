import type { ChoreWire } from "../../src/domains/chores/api/api";
import { test, expect } from "../fixtures";
import type { FakeApi } from "../mocks/api";
import { json } from "../mocks/api";
import { catalogHandlers, propose } from "../mocks/handlers/catalog";
import { homeHandlers } from "../mocks/handlers/home";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { residentsHandlers } from "../mocks/handlers/residents";
import { todayHandlers } from "../mocks/handlers/today";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { onboarding, WEEK, type Day, type Level, type WalkInput } from "../pages/onboarding";
import { shell } from "../pages/shell";

// What this covers: a signed-in User with no Home, from the first onboarding screen to Today. The app shows five
// steps on this device (reminders, Baseline, Restrictions, Preferences, Home). The server also has an `install`
// step, but the app skips it except on iOS in a browser tab, so it is not shown here and is not covered: read
// "every step" as these five.

// The levels and the points they save (src/domains/profile/logic/baselineLevels.ts).
const POINTS: Record<Level, number> = { Low: 4, Normal: 8, High: 14 };

const WEEK_LEVELS: Record<Day, Level> = {
  Monday: "Normal",
  Tuesday: "Normal",
  Wednesday: "High",
  Thursday: "Low",
  Friday: "Normal",
  Saturday: "High",
  Sunday: "Low",
};

const WALK: WalkInput = {
  baseline: WEEK_LEVELS,
  restrictions: ["Heavy lifting"],
  preferences: [{ category: "Kitchen", choice: "Like" }],
  home: { timezone: "Europe/Lisbon", allocationTime: "07:30" },
  answers: { bathrooms: 2, pets: ["Dog"] },
};

// The questionnaire starts with one bedroom, bathroom, kitchen and living room; the walk changes bathrooms and pets.
const SENT_ANSWERS = {
  rooms: { bedrooms: 1, bathrooms: 2, kitchens: 1, livingRooms: 1, laundryAreas: 0 },
  pets: ["dog"],
};

// The names the app shows and saves, built from the Catalog ids (a second bathroom is "... 2").
const REVIEW_NAMES = [
  "Change the bed linen",
  "Clean the kitchen",
  "Clean the bathroom 1",
  "Clean the bathroom 2",
  "Tidy the living room",
  "Walk the dog",
];

/**
 * The proposals the fake makes for SENT_ANSWERS, as the app sends them back to create the Home. Each name is built
 * from the proposal's own fallback name and instance, so a proposal that drifts from REVIEW_NAMES fails here.
 */
function expectedChores(): ChoreWire[] {
  const chores = propose(SENT_ANSWERS).map(({ catalogId: _id, instance, ...fields }) => ({
    ...fields,
    name: instance === null ? fields.name : `${fields.name} ${instance}`,
  }));
  expect(chores.map((chore) => chore.name)).toEqual(REVIEW_NAMES);
  return chores;
}

const bodiesOf = (api: FakeApi, method: string, path: string) =>
  api.requests.filter((request) => request.method === method && request.path === path).map((request) => request.body);

const onboardingSteps = (api: FakeApi) => bodiesOf(api, "PUT", "/me/onboarding");

test.beforeEach(async ({ page, baseURL, fakeApi }) => {
  fakeApi.use(onboardingHandlers);
  fakeApi.use(homeHandlers);
  fakeApi.use(catalogHandlers);
  fakeApi.use(todayHandlers);
  fakeApi.use(residentsHandlers);
  await seedSession(page);
  await launchApp(page, baseURL!);
});

test("a new User walks onboarding, creates the Home and lands on Today", async ({ page, fakeApi }) => {
  // Signed in, no Home: sent to the first step.
  await expect(page).toHaveURL(/\/welcome\/reminders$/);
  await onboarding.completeReminders(page);
  expect(onboardingSteps(fakeApi)).toEqual([{ step: "reminders" }]);

  // One day missing: Next says so and does not leave the step or tell the server it is done.
  await onboarding.expectOnStep(page, "Your Baseline", 2, 5);
  for (const day of WEEK.slice(0, -1)) await onboarding.setBaseline(page, day, WEEK_LEVELS[day]);
  await onboarding.next(page);
  await expect(onboarding.incompleteBaselineAlert(page)).toBeVisible();
  await expect(page).toHaveURL(/\/welcome\/baseline$/);
  expect(onboardingSteps(fakeApi)).toEqual([{ step: "reminders" }]);

  // The six picks already made are no-ops here; the seventh completes the week.
  await onboarding.completeBaseline(page, WALK.baseline);
  // Each pick saved on its own, Monday first, as points.
  expect(bodiesOf(fakeApi, "PUT", "/me/baseline")).toEqual([
    { monday: POINTS.Normal },
    { tuesday: POINTS.Normal },
    { wednesday: POINTS.High },
    { thursday: POINTS.Low },
    { friday: POINTS.Normal },
    { saturday: POINTS.High },
    { sunday: POINTS.Low },
  ]);
  expect(fakeApi.state.profile.baseline).toEqual({
    monday: 8,
    tuesday: 8,
    wednesday: 14,
    thursday: 4,
    friday: 8,
    saturday: 14,
    sunday: 4,
  });
  expect(onboardingSteps(fakeApi)).toEqual([{ step: "reminders" }, { step: "baseline" }]);

  await onboarding.completeRestrictions(page, WALK.restrictions);
  expect(fakeApi.requests.filter((r) => r.path.startsWith("/me/restrictions/")).map((r) => `${r.method} ${r.path}`)).toEqual([
    "PUT /me/restrictions/heavy_lifting",
  ]);
  expect(fakeApi.state.profile.restrictions).toEqual(["heavy_lifting"]);

  await onboarding.completePreferences(page, WALK.preferences);
  // Only the pick that is not Neutral was sent.
  expect(fakeApi.requests.filter((r) => r.path.startsWith("/me/preferences/")).map((r) => [r.method, r.path, r.body])).toEqual([
    ["PUT", "/me/preferences/kitchen", { preference: "like" }],
  ]);
  expect(fakeApi.state.profile.preferences).toEqual({ kitchen: "like" });
  // The Home starts in the browser's zone, which the config pins.
  await expect(onboarding.timezone(page)).toHaveValue("America/Sao_Paulo");

  await onboarding.completeHomeSettings(page, WALK.home);
  await expect(onboarding.bathrooms(page)).toHaveValue("1");

  await onboarding.answerQuestions(page, WALK.answers);
  await onboarding.suggestChores(page);
  // What was typed is what the Catalog was asked about; the review shows what it proposed.
  expect(bodiesOf(fakeApi, "POST", "/catalog/proposals")).toEqual([SENT_ANSWERS]);
  await onboarding.reviewShows(page, REVIEW_NAMES);

  await onboarding.createHome(page);

  // Today, behind the start choice.
  await onboarding.dismissStartChoice(page);
  await shell.expectOnToday(page);
  await expect(page.getByText(/Today's plan is made at 7:30\sAM\./)).toBeVisible();

  // The Home and its Chores were created from exactly what was entered.
  expect(bodiesOf(fakeApi, "POST", "/home")).toEqual([
    { timezone: "Europe/Lisbon", allocationTime: "07:30", chores: expectedChores() },
  ]);
  expect(fakeApi.state.home).toEqual({ id: "home-1", timezone: "Europe/Lisbon", allocationTime: "07:30" });
  expect(fakeApi.state.chores.map((chore) => chore.name)).toEqual(REVIEW_NAMES);
  expect(fakeApi.state.onboardingStored).toBe("done");

  // A reload keeps the User in the app: the server says done, so there is no way back to onboarding.
  const readsBefore = bodiesOf(fakeApi, "GET", "/me/onboarding").length;
  await page.reload();
  await shell.expectOnToday(page);
  await expect(onboarding.startChoiceDialog(page)).toHaveCount(0);
  expect(bodiesOf(fakeApi, "GET", "/me/onboarding").length).toBeGreaterThan(readsBefore);
  expect(fakeApi.state.onboardingStored).toBe("done");
});

test("a refused Create Home shows a message, keeps what was entered, and the retry sends the same Home", async ({ page, fakeApi }) => {
  await onboarding.walkToReview(page, WALK);

  fakeApi.override("POST /home", json(500, { error: "internal error" }), { once: true });
  await onboarding.createHome(page);

  await expect(onboarding.createFailedAlert(page)).toBeVisible();
  // Still on the review, list unchanged, and the button works again instead of staying on "Creating...".
  await expect(page).toHaveURL(/\/welcome\/home$/);
  await onboarding.reviewShows(page, REVIEW_NAMES);
  await expect(onboarding.createHomeButton(page)).toBeEnabled();
  expect(fakeApi.state.home).toBeNull();
  expect(fakeApi.state.onboardingStored).toBe("preferences");

  // Going back shows the answers and settings are still there, and coming forward asks the Catalog nothing new.
  await onboarding.back(page);
  await expect(onboarding.bathrooms(page)).toHaveValue("2");
  await expect(onboarding.petCheckbox(page, "Dog")).toBeChecked();
  await onboarding.back(page);
  await expect(onboarding.timezone(page)).toHaveValue("Europe/Lisbon");
  await expect(onboarding.allocationTime(page)).toHaveValue("07:30");
  await onboarding.continueFromSettings(page);
  await onboarding.suggestChores(page);
  await onboarding.reviewShows(page, REVIEW_NAMES);
  expect(bodiesOf(fakeApi, "POST", "/catalog/proposals")).toHaveLength(1);

  await onboarding.createHome(page);
  await onboarding.dismissStartChoice(page);
  await shell.expectOnToday(page);

  const sent = bodiesOf(fakeApi, "POST", "/home");
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
  expect(sent[1]).toEqual({ timezone: "Europe/Lisbon", allocationTime: "07:30", chores: expectedChores() });
  expect(fakeApi.state.home).not.toBeNull();
});
