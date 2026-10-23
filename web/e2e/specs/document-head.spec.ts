import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { shell } from "../pages/shell";

// What this covers: the built index.html's head. The service worker registration script is deferred and keeps its
// name, each latin Nunito weight in use (400, 600, 700) has a woff2 preload that the server answers, and the API
// origin has a preconnect with crossorigin. The worker itself is blocked in these tests, so offline start is checked
// by hand.

test.use({ fakeState: signedInResident() });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  await seedSession(page);
});

test("registers the service worker with a deferred script of the same name", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.expectOnToday(page);

  const script = page.locator("head script[id='vite-plugin-pwa:register-sw']");
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute("src", "/registerSW.js");
  expect(await script.evaluate((el) => (el as HTMLScriptElement).defer)).toBe(true);
});

test("preloads each Nunito weight by its hashed file, and the server answers for it", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.expectOnToday(page);

  const preloads = page.locator("head link[rel=preload][as=font][type='font/woff2'][crossorigin]");
  await expect(preloads).toHaveCount(3);
  const hrefs = await preloads.evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
  for (const weight of [400, 600, 700]) {
    const matching = hrefs.filter((href) => new RegExp(`nunito-latin-${weight}-normal-[^/]+\\.woff2$`).test(href));
    expect(matching, `a preload for weight ${weight}`).toHaveLength(1);
    const response = await page.request.get(new URL(matching[0], baseURL!).toString());
    expect(response.status()).toBe(200);
  }
});

test("preconnects to the API origin with crossorigin", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  await shell.expectOnToday(page);

  const preconnect = page.locator("head link[rel=preconnect][crossorigin]");
  await expect(preconnect).toHaveCount(1);
  await expect(preconnect).toHaveAttribute("href", "https://api.e2e.test");
});
