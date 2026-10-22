import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
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

  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/me\/profile$/, async (route) => {
    if (route.request().resourceType() === "document") return route.fallback();
    await held;
    await route.fallback();
  });
  await page.getByRole("link", { name: "Me", exact: true }).click();

  await expect(baseline).toBeVisible();
  await expect(page.getByRole("img", { name: "Refreshing" })).toBeVisible();
  release();
  await expect(page.getByRole("img", { name: "Refreshing" })).toHaveCount(0);
  await expect(baseline).toBeVisible();
});
