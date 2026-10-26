import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp, visit } from "../pages/launch";
import { shell, TABS } from "../pages/shell";
import { tabs } from "../pages/tabs";

// What this covers: a signed-in Resident with a Home, from a seeded session (no sign-in steps; no fake Cognito is
// registered, so any Cognito call fails the test as unmocked). Actions that change data are out of scope.

test.use({ fakeState: signedInResident() });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
});

const TASKS = ["Wash the dishes", "Mop the floors"];
const CHORES = ["Wash the dishes", "Mop the floors", "Take out the trash"];

test("Today shows the planned day", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);

  await expect(tabs.today.heading(page)).toBeVisible();
  await shell.expectOnTab(page, "Today");
  await expect(tabs.today.mine(page)).toBeVisible();
  for (const name of TASKS) await expect(tabs.today.task(page, name)).toBeVisible();
  await expect(tabs.today.others(page)).toBeVisible();
  await expect(page.getByText("Bruna Souza")).toBeVisible();
  await expect(tabs.today.pool(page)).toBeVisible();
});

test("Today has no Replan control, in either language", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);

  await expect(tabs.today.mine(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Replan now" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Replanejar agora" })).toHaveCount(0);
});

test("Chores lists the Home's Chores", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.openTab(page, "Chores");

  await shell.expectOnTab(page, "Chores");
  await expect(tabs.chores.heading(page)).toBeVisible();
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();
});

test("Home shows the Home's settings and invite", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.openTab(page, "Home");

  await shell.expectOnTab(page, "Home");
  await expect(tabs.home.heading(page)).toBeVisible();
  await expect(tabs.home.timezone(page)).toHaveValue("America/Sao_Paulo");
  await expect(tabs.home.allocationTime(page)).toHaveValue("07:00");
  await expect(tabs.home.invite(page)).toBeVisible();
});

test("Me shows the Resident's Profile", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.openTab(page, "Me");

  await shell.expectOnTab(page, "Me");
  await expect(tabs.me.heading(page)).toBeVisible();
  // The three cards start closed (see me-cards.spec.ts); open each to read what it holds.
  await expect(tabs.me.baseline(page)).toBeVisible();
  await tabs.me.open(page, "Baseline");
  await expect(tabs.me.day(page, "Monday").getByLabel("Normal")).toBeChecked();
  await expect(tabs.me.preferences(page)).toBeVisible();
  await tabs.me.open(page, "Preferences");
  await expect(tabs.me.kitchenLike(page)).toBeChecked();
  await expect(tabs.me.restrictions(page)).toBeVisible();
  await tabs.me.open(page, "Restrictions");
  await expect(tabs.me.bending(page)).toBeChecked();
  await expect(tabs.me.signedInAs(page, RESIDENT_EMAIL)).toBeVisible();
});

test("going back to Today from another tab shows the Tasks again", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.openTab(page, "Me");
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

test("launching asks for the User once: the Shell reads the entry sign-in already cached", async ({ page, baseURL, fakeApi }) => {
  await launchApp(page, baseURL!);
  await expect(tabs.today.mine(page)).toBeVisible();

  expect(fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/me")).toHaveLength(1);
});

test.describe("a refresh with the Home on screen", () => {
  // React Query refetches stale data when the app regains focus; the page reports it as a visibility change.
  const regainFocus = (page: import("@playwright/test").Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));

  test("shows the Refreshing indicator and keeps the content, with no skeleton", async ({ page, baseURL }) => {
    await launchApp(page, baseURL!);
    await shell.openTab(page, "Home");
    await expect(tabs.home.heading(page)).toBeVisible();

    await page.route((url) => url.pathname === "/home", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fallback();
    });
    await regainFocus(page);

    await expect(page.getByRole("img", { name: "Refreshing" })).toBeVisible();
    await expect(tabs.home.timezone(page)).toHaveValue("America/Sao_Paulo");
    await expect(page.getByRole("img", { name: "Refreshing" })).toHaveCount(0);
  });

  test("keeps the content and shows no alert when the refresh fails", async ({ page, baseURL, fakeApi }) => {
    await launchApp(page, baseURL!);
    await shell.openTab(page, "Home");
    await expect(tabs.home.heading(page)).toBeVisible();

    fakeApi.override("GET /home", json(500, { error: "internal error" }), { once: true });
    await regainFocus(page);
    await expect.poll(() => fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/home").length).toBe(2);

    await expect(tabs.home.timezone(page)).toHaveValue("America/Sao_Paulo");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test("a Day Plan that fails to load shows a message and recovers on retry", async ({ page, baseURL, fakeApi }) => {
  // Two failures: the launch read, then the read Today makes on mount because the launch read did not succeed.
  fakeApi.override("GET /home/day-plan", json(500, { error: "internal error" }), { once: true });
  fakeApi.override("GET /home/day-plan", json(500, { error: "internal error" }), { once: true });
  await launchApp(page, baseURL!);

  await expect(tabs.today.heading(page)).toBeVisible();
  await expect(tabs.today.loadError(page)).toBeVisible();

  await tabs.today.retry(page).click();
  for (const name of TASKS) await expect(tabs.today.task(page, name)).toBeVisible();
  await expect(tabs.today.loadError(page)).toHaveCount(0);
});
