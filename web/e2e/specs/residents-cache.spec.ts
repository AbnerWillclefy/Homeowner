import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers: the Home tab and a Resident's page over the query cache. Opening a Resident's page again shows
// the cached page at once, with the quiet Refreshing indicator in the page header (not the skeleton) while the
// read behind it is held. A first visit still shows the skeleton.

const state = signedInResident();
state.residents = [
  { id: "resident-1", you: true, name: "resident", photoUrl: null, streak: 6 },
  { id: "resident-2", you: false, name: "Ana Souza", photoUrl: null, streak: 11 },
];

test.use({ fakeState: state });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
});

test("a page visited before opens at once with the indicator while the read is held", async ({ page }) => {
  await visit(page, "/home");
  const ana = page.getByRole("region", { name: "Residents", exact: true }).getByRole("link", { name: /Ana Souza/ });
  await ana.click();
  await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
  await page.getByRole("link", { name: "Your Home" }).click();
  await expect(ana).toBeVisible();

  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/home\/residents\/resident-2$/, async (route) => {
    if (route.request().resourceType() === "document") return route.fallback();
    await held;
    await route.fallback();
  });
  await ana.click();

  await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
  await expect(page.getByTestId("resident-skeleton")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Refreshing" })).toBeVisible();
  release();
  await expect(page.getByRole("img", { name: "Refreshing" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
});

test("a failed refetch keeps the cached page and shows no alert", async ({ page, fakeApi }) => {
  await visit(page, "/home/residents/resident-2");
  await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
  await page.getByRole("link", { name: "Your Home" }).click();

  fakeApi.override("GET /home/residents/{id}", { status: 500, body: { error: "internal error" } }, { once: true });
  await page.getByRole("region", { name: "Residents", exact: true }).getByRole("link", { name: /Ana Souza/ }).click();
  await expect.poll(() => fakeApi.requests.filter((r) => r.path === "/home/residents/resident-2").length).toBeGreaterThan(1);
  await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
