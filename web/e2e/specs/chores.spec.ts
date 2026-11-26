import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { catalogHandlers } from "../mocks/handlers/catalog";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";
import { tabs } from "../pages/tabs";

// What this covers: the Chores screen's search, Category chips, "+" menu, the Chore Sheet, and a delete that is held
// for Undo. The delete rows pin the held write: Undo sends nothing, and closing the Toast sends exactly one DELETE.

test.use({ fakeState: signedInResident() });

test.beforeEach(async ({ page, baseURL, fakeApi }) => {
  fakeApi.use(signedInHandlers);
  fakeApi.use(catalogHandlers);
  await seedSession(page, { email: RESIDENT_EMAIL });
  await launchApp(page, baseURL!);
  // The second link of the Main bar is Chores in either locale.
  await page.getByRole("navigation").getByRole("link").nth(1).click();
  await expect(tabs.chores.chore(page, "Wash the dishes")).toBeVisible();
});

// Closing the delete's Toast is what sends it; an earlier "saved" Toast has its own Dismiss button.
const closeDeleteToast = (page: Page) =>
  page.getByRole("listitem").filter({ hasText: "deleted." }).getByRole("button", { name: "Dismiss message" }).click();
const deletes = (requests: { method: string }[]) => requests.filter((r) => r.method === "DELETE").length;

test("search finds a Chore by part of its name, ignoring case, and offers to clear when nothing matches", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search Chores" });
  await search.fill("MOP");
  await expect(tabs.chores.chore(page, "Mop the floors")).toBeVisible();
  await expect(tabs.chores.chore(page, "Wash the dishes")).toHaveCount(0);

  await search.fill("zzz");
  await expect(page.getByText("No Chores found")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(search).toHaveValue("");
  await expect(tabs.chores.chore(page, "Wash the dishes")).toBeVisible();
});

test("a Category chip keeps only that Category's group, and All shows them again", async ({ page }) => {
  const filter = page.getByRole("group", { name: "Filter by Category" });
  await filter.getByRole("button", { name: "Floors" }).click();
  await expect(filter.getByRole("button", { name: "Floors" })).toHaveAttribute("aria-pressed", "true");
  await expect(tabs.chores.chore(page, "Mop the floors")).toBeVisible();
  await expect(tabs.chores.chore(page, "Wash the dishes")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Floors · 1" })).toBeVisible();

  await filter.getByRole("button", { name: "All" }).click();
  await expect(tabs.chores.chore(page, "Wash the dishes")).toBeVisible();
});

test("a row names its Category as text", async ({ page }) => {
  await expect(tabs.chores.row(page, "Wash the dishes")).toContainText("Kitchen");
});

test("the + menu offers a new Chore and the Catalog, and focus comes back to + when the Sheet closes", async ({ page }) => {
  const add = page.getByRole("button", { name: "Add a Chore" });
  await add.click();
  await expect(page.getByRole("menuitem")).toHaveText(["New Chore", "From the Catalog"]);
  await page.getByRole("menuitem", { name: "From the Catalog" }).click();
  await expect(page.getByRole("dialog", { name: "Add from the Catalog" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close the Catalog" }).click();
  await expect(add).toBeFocused();

  await add.click();
  await page.getByRole("menuitem", { name: "New Chore" }).click();
  await expect(page.getByRole("dialog", { name: "Add a Chore" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("a Sheet that is refused stays open with the error and what was typed", async ({ page }) => {
  await page.getByRole("button", { name: "Add a Chore" }).click();
  await page.getByRole("menuitem", { name: "New Chore" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Name").fill("Dust");
  await sheet.getByRole("button", { name: "Add Chore" }).click();
  await expect(sheet.getByRole("alert").first()).toBeVisible();
  await expect(sheet.getByLabel("Name")).toHaveValue("Dust");
});

test("opening another Chore starts its Sheet from that Chore's values", async ({ page }) => {
  await tabs.chores.row(page, "Wash the dishes").click();
  await expect(page.getByRole("dialog").getByLabel("Name")).toHaveValue("Wash the dishes");
  await page.keyboard.press("Escape");
  await tabs.chores.row(page, "Mop the floors").click();
  await expect(page.getByRole("dialog").getByLabel("Name")).toHaveValue("Mop the floors");
});

test("delete shows the row gone at once, and Undo brings it back with no DELETE sent", async ({ page, fakeApi }) => {
  await tabs.chores.row(page, "Wash the dishes").click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete Chore" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Chores" })).toBeFocused();
  await expect(tabs.chores.chore(page, "Wash the dishes")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(tabs.chores.chore(page, "Wash the dishes")).toBeVisible();
  // Give a wrongly sent write time to arrive.
  await page.waitForTimeout(300);
  expect(deletes(fakeApi.requests)).toBe(0);
});

test("delete then closing the Toast sends one DELETE and the row stays gone", async ({ page, fakeApi }) => {
  await tabs.chores.row(page, "Wash the dishes").click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete Chore" }).click();
  await expect(page.getByText("Wash the dishes deleted. Its Tasks leave today's plan.", { exact: true })).toBeVisible();
  expect(deletes(fakeApi.requests)).toBe(0);
  await closeDeleteToast(page);
  await expect.poll(() => deletes(fakeApi.requests)).toBe(1);
  await expect(tabs.chores.chore(page, "Wash the dishes")).toHaveCount(0);
  await expect(tabs.chores.chore(page, "Mop the floors")).toBeVisible();
});

test("a Home with no Chores shows the first-use state with a way to add one", async ({ page, fakeApi }) => {
  for (const name of ["Wash the dishes", "Mop the floors", "Take out the trash"]) {
    await tabs.chores.row(page, name).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete Chore" }).click();
  }
  // The held delete is sent when the next one starts, so two have gone and one is held until the Toast closes.
  await expect(tabs.chores.empty(page)).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await page.getByRole("button", { name: "New Chore" }).click();
  await expect(page.getByRole("dialog", { name: "Add a Chore" })).toBeVisible();
  expect(deletes(fakeApi.requests)).toBe(2);
});

// The same screen on a 390px phone in pt-BR, where "+" and the Sheets open as bottom drawers and the words are longest.
test.describe("pt-BR on a phone", () => {
  test.use({ locale: "pt-BR", viewport: { width: 390, height: 844 } });

  test("search, chip, + drawer, the Sheet and Desfazer work, and the page does not scroll sideways", async ({ page, fakeApi }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Afazeres" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.getByRole("searchbox", { name: "Buscar afazer" }).fill("MOP");
    await expect(tabs.chores.chore(page, "Mop the floors")).toBeVisible();
    await expect(tabs.chores.chore(page, "Wash the dishes")).toHaveCount(0);
    await page.getByRole("button", { name: "Limpar a busca" }).click();
    await page.getByRole("group", { name: "Filtrar por categoria" }).getByRole("button", { name: "Pisos" }).click();
    await expect(tabs.chores.chore(page, "Wash the dishes")).toHaveCount(0);
    await page.getByRole("group", { name: "Filtrar por categoria" }).getByRole("button", { name: "Todas" }).click();

    await page.getByRole("button", { name: "Adicionar afazer" }).click();
    await expect(page.getByRole("dialog", { name: "Adicionar afazer" }).getByRole("button")).toHaveText(["Fechar", "Novo afazer", "Do Catálogo"]);
    await page.getByRole("button", { name: "Novo afazer" }).click();
    await expect(page.getByRole("dialog", { name: "Adicionar afazer" }).getByLabel("Nome")).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();

    await tabs.chores.row(page, "Wash the dishes").click();
    await page.getByRole("dialog").getByRole("button", { name: "Excluir afazer" }).click();
    await expect(tabs.chores.chore(page, "Wash the dishes")).toHaveCount(0);
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(tabs.chores.chore(page, "Wash the dishes")).toBeVisible();
    await page.waitForTimeout(300);
    expect(deletes(fakeApi.requests)).toBe(0);
  });
});
