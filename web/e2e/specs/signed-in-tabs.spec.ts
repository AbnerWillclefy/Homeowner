import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { choresHandlers } from "../mocks/handlers/chores";
import { homeHandlers } from "../mocks/handlers/home";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { todayHandlers } from "../mocks/handlers/today";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";
import { shell, TABS } from "../pages/shell";
import { tabs } from "../pages/tabs";

// What this covers: a signed-in Resident with a Home, from a seeded session (no sign-in steps; no fake Cognito is
// registered, so any Cognito call fails the test as unmocked). Actions that change data are out of scope.

test.use({ fakeState: signedInResident() });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(onboardingHandlers); // the profile, categories and demands the Me tab reads
  fakeApi.use(homeHandlers);
  fakeApi.use(choresHandlers);
  fakeApi.use(todayHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
});

const TASKS = ["Wash the dishes", "Mop the floors"];
const CHORES = ["Wash the dishes", "Mop the floors", "Take out the trash"];

test("every tab opens and shows the Home's data", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);

  await expect(tabs.today.heading(page)).toBeVisible();
  await shell.expectOnTab(page, "Today");
  await expect(tabs.today.mine(page)).toBeVisible();
  for (const name of TASKS) await expect(tabs.today.task(page, name)).toBeVisible();
  await expect(tabs.today.others(page)).toBeVisible();
  await expect(page.getByText("Resident 1")).toBeVisible();
  await expect(tabs.today.pool(page)).toBeVisible();

  await shell.openTab(page, "Chores");
  await shell.expectOnTab(page, "Chores");
  await expect(tabs.chores.heading(page)).toBeVisible();
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();

  await shell.openTab(page, "Home");
  await shell.expectOnTab(page, "Home");
  await expect(tabs.home.heading(page)).toBeVisible();
  await expect(tabs.home.timezone(page)).toHaveValue("America/Sao_Paulo");
  await expect(tabs.home.allocationTime(page)).toHaveValue("07:00");
  await expect(tabs.home.invite(page)).toBeVisible();

  await shell.openTab(page, "Me");
  await shell.expectOnTab(page, "Me");
  await expect(tabs.me.heading(page)).toBeVisible();
  await expect(tabs.me.baseline(page)).toBeVisible();
  await expect(tabs.me.day(page, "Monday").getByLabel("Normal")).toBeChecked();
  await expect(tabs.me.preferences(page)).toBeVisible();
  await expect(tabs.me.kitchenLike(page)).toBeChecked();
  await expect(tabs.me.restrictions(page)).toBeVisible();
  await expect(tabs.me.bending(page)).toBeChecked();
  await expect(tabs.me.signedInAs(page, RESIDENT_EMAIL)).toBeVisible();

  await shell.openTab(page, "Today");
  await shell.expectOnTab(page, "Today");
  for (const name of TASKS) await expect(tabs.today.task(page, name)).toBeVisible();
});

test("reloading keeps the Resident on the tab", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.expectOnToday(page);

  for (const name of TABS) {
    await test.step(name, async () => {
      await shell.openTab(page, name);
      await shell.expectOnTab(page, name);
      await page.reload();
      await shell.expectOnTab(page, name);
      await expect(shell.nav(page)).toBeVisible();
    });
  }

  await visit(page, "/home");
  await shell.expectOnTab(page, "Home");
  await expect(tabs.home.heading(page)).toBeVisible();
});

test("a day with no Tasks says so", async ({ page, baseURL, fakeApi }) => {
  fakeApi.state.dayPlan = { ...fakeApi.state.dayPlan!, mine: [] };
  await launchApp(page, baseURL!);

  await expect(tabs.today.heading(page)).toBeVisible();
  await expect(tabs.today.empty(page)).toBeVisible();
  for (const name of TASKS) await expect(tabs.today.task(page, name)).toHaveCount(0);
});

test("a Day Plan that fails to load shows a message and recovers on retry", async ({ page, baseURL, fakeApi }) => {
  fakeApi.override("GET /home/day-plan", json(500, { error: "internal error" }), { once: true });
  await launchApp(page, baseURL!);

  await expect(tabs.today.heading(page)).toBeVisible();
  await expect(tabs.today.loadError(page)).toBeVisible();

  await tabs.today.retry(page).click();
  for (const name of TASKS) await expect(tabs.today.task(page, name)).toBeVisible();
  await expect(tabs.today.loadError(page)).toHaveCount(0);
});
