import { test, expect } from "../fixtures";
import { json, type FakeState } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: Today names Residents instead of numbering them, in both locales. The greeting uses the
// Resident's name, another Resident's group and a two-person Task show a name and an avatar, a photo that answers
// text/html falls back to initials, and a failed residents call still leaves Today working with a placeholder.
// Swap offers are not built in the PWA yet, so no swap card is covered here.

const PHOTO_URL = "https://photos.test/carlos.jpg";
const LONG_NAME = "Abcdefghijklmnopqrstuvwxyzabcdefghijklmn"; // 40 characters, no break opportunity

/** Abner (the caller), Ana (a housemate sharing a Task) and Carlos (a photo that will not load). */
function housemates(): FakeState {
  const state = signedInResident();
  state.user.displayName = "Abner";
  state.residents = [
    { id: "resident-1", you: true, name: "Abner", photoUrl: null },
    { id: "resident-2", you: false, name: "Ana Souza", photoUrl: null },
    { id: "resident-3", you: false, name: "Carlos Lima", photoUrl: PHOTO_URL },
  ];
  const plan = state.dayPlan!;
  const [dishes, mop] = plan.mine as [(typeof plan.mine)[number], (typeof plan.mine)[number]];
  plan.mine = [dishes, { ...mop, with: ["resident-2"] }];
  plan.others = [
    { residentId: "resident-2", tasks: [{ ...dishes, id: "task-5", choreName: "Water the plants", with: ["resident-1"] }] },
    { residentId: "resident-3", tasks: [{ ...dishes, id: "task-6", choreName: "Sweep the porch" }] },
  ];
  return state;
}

const LOCALES = [
  { locale: "pt-BR", withAna: "Com Ana Souza", withYou: "Com você", someone: "Um morador" },
  { locale: "en-US", withAna: "With Ana Souza", withYou: "With you", someone: "A housemate" },
] as const;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: housemates() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
      // A missing avatar comes back from the CDN as 200 text/html, not as an error.
      await page.route(PHOTO_URL, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }));
    });

    test("the greeting uses the Resident's name", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(page.getByRole("heading", { level: 2, name: /, Abner$/ })).toBeVisible();
    });

    test("another Resident's group shows their name and initials", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const group = page.getByRole("heading", { level: 4, name: "Ana Souza" });
      await expect(group).toBeVisible();
      await expect(group.getByText("AS", { exact: true })).toBeVisible();
      await expect(page.getByText("Water the plants")).toBeVisible();
    });

    test("a two-person Task says who it is with", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      await expect(page.getByText(l.withAna, { exact: true })).toBeVisible();
      await expect(page.getByText(l.withYou, { exact: true })).toBeVisible();
    });

    test("a photo that answers text/html falls back to initials", async ({ page, baseURL }) => {
      await launchApp(page, baseURL!);
      const group = page.getByRole("heading", { level: 4, name: "Carlos Lima" });
      await expect(group.getByText("CL", { exact: true })).toBeVisible();
      await expect(group.locator("img")).toHaveCount(0);
    });

    test("a residents call that fails leaves Today working with a placeholder", async ({ page, baseURL, fakeApi }) => {
      fakeApi.override("GET /home/residents", json(500, { error: "internal error" }));
      await launchApp(page, baseURL!);
      await expect(page.getByText("Water the plants")).toBeVisible();
      await expect(page.getByText(l.someone, { exact: true })).toHaveCount(2);
      await expect(page.getByText("Ana Souza")).toHaveCount(0);
    });

    test("a 40-character name wraps instead of overflowing", async ({ page, baseURL, fakeApi }) => {
      fakeApi.state.residents![1]!.name = LONG_NAME;
      fakeApi.state.user.displayName = LONG_NAME;
      await launchApp(page, baseURL!);
      await expect(page.getByRole("heading", { level: 4, name: LONG_NAME })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(LONG_NAME) })).toBeVisible();
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflows).toBe(false);
    });
  });
}
