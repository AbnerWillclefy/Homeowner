import { test, expect } from "../fixtures";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { shell, TABS } from "../pages/shell";

// What this covers: the frame applies the page spacing once (the design's hm-head, hm-scroll and hm-stack). At phone
// width the head starts 24px below the top and 16px from the left, the body's first block is 16px below the head
// (8px of head plus 8px of body), its blocks are 16px apart, and none adds its own outer padding or margin.

const TITLES: Record<(typeof TABS)[number], string> = { Today: "Hoje", Chores: "Afazeres", Home: "Seu lar", Me: "Sobre você" };
const LABELS: Record<(typeof TABS)[number], string> = { Today: "Hoje", Chores: "Afazeres", Home: "Lar", Me: "Eu" };
const WIDTH = 390;

test.use({ locale: "pt-BR", fakeState: signedInResident(), viewport: { width: WIDTH, height: 844 } });

test.beforeEach(async ({ page, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
});

test("each tab's head and body measure the frame's spacing", async ({ page, baseURL }) => {
  await launchApp(page, baseURL!);
  for (const name of TABS) {
    await page.getByRole("navigation").getByRole("link", { name: LABELS[name], exact: true }).click();
    await expect(shell.title(page, TITLES[name])).toBeVisible();
    const body = page.locator('[data-slot="tab-body"]');
    await expect(body).toHaveCount(1);
    // Wait for the tab's first load: a skeleton is one block, the loaded tab has several.
    await expect(body.locator("> *").nth(1)).toBeVisible();

    const main = (await page.locator("main").boundingBox())!;
    const head = (await page.locator('[data-slot="page-header"]').boundingBox())!;
    expect(head.y - main.y, `${name} head top`).toBe(24);
    expect(head.x, `${name} head left`).toBe(16);

    const boxes = [];
    for (const child of await body.locator("> *").all()) {
      const box = await child.boundingBox();
      if (box && box.height > 0) boxes.push(box);
    }
    expect(boxes.length, `${name} body blocks`).toBeGreaterThan(1);
    expect(boxes[0]!.y - (head.y + head.height), `${name} head to body`).toBe(16);
    for (const [i, box] of boxes.entries()) {
      expect(box.x, `${name} block ${i} left`).toBe(16);
      expect(box.width, `${name} block ${i} width`).toBe(WIDTH - 32);
      if (i > 0) expect(box.y - (boxes[i - 1]!.y + boxes[i - 1]!.height), `${name} block ${i} gap`).toBe(16);
    }
  }
});
