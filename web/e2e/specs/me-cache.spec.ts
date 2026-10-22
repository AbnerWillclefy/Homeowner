import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { hold } from "../mocks/hold";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers: the Me tab over the query cache. Opening Me again shows the cached cards at once with the
// quiet Refreshing indicator in the Me header (not the skeleton) while GET /me/profile is held. A first visit
// still shows the skeleton.

test.use({ fakeState: signedInResident() });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
});

test("Me opens at once from the cache with the indicator while the profile read is held", async ({ page }) => {
  await visit(page, "/me");
  const baseline = page.getByRole("button", { name: "Baseline" });
  await expect(baseline).toBeVisible();
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("link", { name: "Me", exact: true })).toBeVisible();

  const held = hold(page, /\/me\/profile$/);
  await page.getByRole("link", { name: "Me", exact: true }).click();

  await expect(baseline).toBeVisible();
  await expect(page.getByRole("img", { name: "Refreshing" })).toBeVisible();
  held.release();
  await expect(page.getByRole("img", { name: "Refreshing" })).toHaveCount(0);
  await expect(baseline).toBeVisible();
});
