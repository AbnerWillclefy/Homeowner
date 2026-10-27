import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { shell } from "../pages/shell";
import { tabs } from "../pages/tabs";

// What this covers: the Chores tab over the query cache. A create, an edit and a delete write the server's answer
// into the cache, so none sends a new GET /home/chores. Going to another tab and back shows the cached list at once,
// with the quiet Refreshing indicator (not a skeleton) while the read behind it is held.

test.use({ fakeState: signedInResident() });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
});

const CHORES = ["Wash the dishes", "Mop the floors", "Take out the trash"];

test("a create, an edit and a delete update the list with no new GET /home/chores", async ({ page, baseURL, fakeApi }) => {
  const reads = () => fakeApi.requests.filter((r) => r.method === "GET" && r.path === "/home/chores").length;
  await launchApp(page, baseURL!);
  await shell.openTab(page, "Chores");
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();
  const readsBefore = reads();

  await page.getByRole("button", { name: "Add a Chore" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Clean the windows");
  await dialog.getByLabel("Category").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Add Chore" }).click();
  await expect(tabs.chores.chore(page, "Clean the windows")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(reads()).toBe(readsBefore);

  await page.getByRole("button", { name: "Edit Clean the windows" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Clean every window");
  await page.getByRole("dialog").getByRole("button", { name: "Save Chore" }).click();
  await expect(tabs.chores.chore(page, "Clean every window")).toBeVisible();
  await expect(tabs.chores.chore(page, "Clean the windows")).toHaveCount(0);
  expect(reads()).toBe(readsBefore);

  await page.getByRole("button", { name: "Delete Clean every window" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(tabs.chores.chore(page, "Clean every window")).toHaveCount(0);
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();
  expect(reads()).toBe(readsBefore);
});

test("coming back to Chores shows the cached list at once and the indicator while the read is held", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.openTab(page, "Chores");
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();
  await shell.openTab(page, "Today");
  await expect(tabs.today.heading(page)).toBeVisible();

  const held = hold(page, /\/home\/chores$/);
  await shell.openTab(page, "Chores");
  // Today's plan cards carry the same names, so wait for Chores to replace them before matching by text.
  await expect(tabs.chores.heading(page)).toBeVisible();

  // The cached list and the add buttons are there while the read is held: a skeleton would have replaced them.
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a Chore" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Refreshing" })).toBeVisible();
  held.release();
  await expect(page.getByRole("img", { name: "Refreshing" })).toHaveCount(0);
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();
});

test("a refetch that fails keeps the list and shows no alert", async ({ page, baseURL, fakeApi }) => {
  await launchApp(page, baseURL!);
  await shell.openTab(page, "Chores");
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();
  await shell.openTab(page, "Today");
  await expect(tabs.today.heading(page)).toBeVisible();

  fakeApi.override("GET /home/chores", { status: 500, body: { error: "internal error" } }, { once: true });
  await shell.openTab(page, "Chores");
  await expect.poll(() => fakeApi.requests.filter((r) => r.path === "/home/chores").length).toBeGreaterThan(1);
  for (const name of CHORES) await expect(tabs.chores.chore(page, name)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
