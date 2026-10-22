import { test, expect } from "../fixtures";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { onboarding, type Day, type Level } from "../pages/onboarding";

// What this covers: onboarding over the query cache. Going Back to a profile step already seen shows its fields at
// once, with no loading line, even while GET /me/profile is held, and the saved position stays where it was.

const WEEK_LEVELS: Record<Day, Level> = {
  Monday: "Normal",
  Tuesday: "Normal",
  Wednesday: "High",
  Thursday: "Low",
  Friday: "Normal",
  Saturday: "High",
  Sunday: "Low",
};

test.beforeEach(async ({ page, baseURL, fakeApi }) => {
  fakeApi.use(onboardingHandlers);
  await seedSession(page);
  await launchApp(page, baseURL!);
});

test("going Back to the Baseline shows it at once, with no loading line, while the profile read is held", async ({ page }) => {
  await onboarding.completeReminders(page);
  await onboarding.completeBaseline(page, WEEK_LEVELS);
  await onboarding.expectOnStep(page, "Your Restrictions", 3, 5);

  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/me\/profile$/, async (route) => {
    if (route.request().resourceType() === "document") return route.fallback();
    await held;
    await route.fallback();
  });

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/welcome\/baseline$/);
  await expect(onboarding.baselineDay(page, "Monday")).toBeVisible();
  await expect(page.getByText("Loading your details")).toHaveCount(0);
  await expect(onboarding.baselineDay(page, "Monday").getByLabel("Normal", { exact: true })).toBeChecked();
  release();

  // The saved step is still Restrictions: Next goes on from the Baseline to it without a new answer to wait for.
  await onboarding.next(page);
  await expect(page).toHaveURL(/\/welcome\/restrictions$/);
});
