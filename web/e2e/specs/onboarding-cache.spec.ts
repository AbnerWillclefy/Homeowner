import { test, expect } from "../fixtures";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { hold } from "../mocks/hold";
import { residentsHandlers } from "../mocks/handlers/residents";
import { todayHandlers } from "../mocks/handlers/today";
import { signedInResident, RESIDENT_EMAIL } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { onboarding, JOINER, type Day, type Level } from "../pages/onboarding";

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

// The Home exists and `home` is stored: the walk starts at the Baseline (the Home step is never shown again), and
// this User is a joiner (`joined`), so the walk is 4 screens.
test.use({ fakeState: { ...signedInResident(), onboardingStored: "home", joined: true } });

test.beforeEach(async ({ page, baseURL, fakeApi }) => {
  fakeApi.use(onboardingHandlers);
  // Launching on Today starts its reads at once; with no Home they answer "none" (ADR 0016).
  fakeApi.use(todayHandlers);
  fakeApi.use(residentsHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
  await launchApp(page, baseURL!);
});

test("going Back to the Baseline shows it at once, with no loading line, while the profile read is held", async ({ page }) => {
  await expect(page).toHaveURL(/\/welcome\/baseline$/);
  // Nothing before the Baseline to go back to: the Home step would make a second Home.
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  await onboarding.completeBaseline(page, WEEK_LEVELS, JOINER);
  await onboarding.expectOnStep(page, "Your Restrictions", 2, 4);

  const held = hold(page, /\/me\/profile$/);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/welcome\/baseline$/);
  await expect(onboarding.baselineDay(page, "Monday")).toBeVisible();
  await expect(page.getByText("Loading your details")).toHaveCount(0);
  await expect(onboarding.baselineDay(page, "Monday").getByRole("radio", { name: "Normal", exact: true })).toBeChecked();
  held.release();

  // The saved step is still Restrictions: Next goes on from the Baseline to it without a new answer to wait for.
  await onboarding.next(page);
  await expect(page).toHaveURL(/\/welcome\/restrictions$/);
});
