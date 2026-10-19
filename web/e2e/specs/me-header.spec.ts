import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json, type FakeState } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers, in both locales: the Me header (Avatar initials, name, email, Streak), the "Add your name and
// photo" link and the edit pencil, the edit route (saving, clearing, the length message before and after the
// request), no Streak line without a Home, and a failed GET /me that leaves the cards below working.

const LONG_NAME = "Abcdefghijklmnopqrstuvwxyzabcdefghijklmn"; // 40 characters, no break opportunity
const TOO_LONG = "a".repeat(41);
const LOCAL_PART = "resident";

const LOCALES = [
  {
    locale: "pt-BR",
    me: "Eu",
    today: "Hoje",
    addLink: "Adicione seu nome e foto",
    edit: "Editar nome e foto",
    nameLabel: "Nome",
    save: "Salvar",
    back: "Voltar",
    tooLong: "O nome pode ter no máximo 40 caracteres. Encurte e salve de novo.",
    streak: "Sequência de 5 dias",
    loadFailed: "Não foi possível carregar seu nome.",
    retry: "Tentar de novo",
    baseline: "Energia base",
  },
  {
    locale: "en-US",
    me: "Me",
    today: "Today",
    addLink: "Add your name and photo",
    edit: "Edit name and photo",
    nameLabel: "Name",
    save: "Save",
    back: "Back",
    tooLong: "A name can have at most 40 characters. Shorten it and save again.",
    streak: "5-day Streak",
    loadFailed: "Could not load your name.",
    retry: "Try again",
    baseline: "Baseline",
  },
] as const;

/** A Resident with a Home, a 5-day Streak and (unless `name` is null) a name they set. */
function resident(name: string | null): FakeState {
  const state = signedInResident();
  state.streak = 5;
  if (name !== null) {
    state.user.displayName = name;
    state.residents![0]!.name = name;
  }
  return state;
}

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true });
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    async function openMe(page: Page, baseURL: string | undefined) {
      await launchApp(page, baseURL!);
      await nav(page, l.me).click();
    }

    test.describe("with a name", () => {
      test.use({ fakeState: resident("Abner Lima") });

      test("shows the initials, name, email and Streak, and a pencil instead of the add link", async ({ page, baseURL }) => {
        await openMe(page, baseURL);
        await expect(page.getByText("AL", { exact: true })).toBeVisible();
        await expect(page.getByText("Abner Lima", { exact: true })).toBeVisible();
        await expect(page.getByText(RESIDENT_EMAIL, { exact: true }).first()).toBeVisible();
        await expect(page.getByText(l.streak, { exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: l.addLink })).toHaveCount(0);

        const pencil = page.getByRole("link", { name: l.edit });
        const box = (await pencil.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      });

      test("keeps Me highlighted on the edit screen and Back returns without saving", async ({ page, baseURL, fakeApi }) => {
        await openMe(page, baseURL);
        await page.getByRole("link", { name: l.edit }).click();
        await expect(page).toHaveURL(/\/me\/edit$/);
        await expect(nav(page, l.me)).toHaveAttribute("aria-current", "page");
        await page.getByLabel(l.nameLabel).fill("Someone else");
        await page.getByRole("link", { name: l.back }).click();
        await expect(page).toHaveURL(/\/me$/);
        await expect(page.getByText("Abner Lima", { exact: true })).toBeVisible();
        expect(fakeApi.requests.some((r) => r.method === "PUT" && r.path === "/me/name")).toBe(false);
      });

      test("saving a name returns to Me and changes the greeting on Today without a reload", async ({ page, baseURL }) => {
        await openMe(page, baseURL);
        await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
        await page.getByRole("link", { name: l.edit }).click();
        await page.getByLabel(l.nameLabel).fill("  Bia Costa  ");
        await expect(page.getByText("9/40", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: l.save }).click();

        await expect(page).toHaveURL(/\/me$/);
        await expect(page.getByText("Bia Costa", { exact: true })).toBeVisible();
        await expect(page.getByText("BC", { exact: true })).toBeVisible();
        await nav(page, l.today).click();
        await expect(page.getByRole("heading", { level: 2, name: /, Bia Costa$/ })).toBeVisible();
        expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
      });

      test("clearing the name falls back to the email's local part and brings the add link back", async ({ page, baseURL, fakeApi }) => {
        await openMe(page, baseURL);
        await page.getByRole("link", { name: l.edit }).click();
        await page.getByLabel(l.nameLabel).fill("   ");
        await page.getByRole("button", { name: l.save }).click();

        await expect(page).toHaveURL(/\/me$/);
        await expect(page.getByText(LOCAL_PART, { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("link", { name: l.addLink })).toBeVisible();
        const put = fakeApi.requests.find((r) => r.method === "PUT" && r.path === "/me/name");
        expect(put?.body).toEqual({ name: null });
      });

      test("a name over 40 characters is stopped before any request", async ({ page, baseURL, fakeApi }) => {
        await openMe(page, baseURL);
        await page.getByRole("link", { name: l.edit }).click();
        await page.getByLabel(l.nameLabel).fill(TOO_LONG);
        await expect(page.getByRole("alert").filter({ hasText: l.tooLong })).toBeVisible();
        await expect(page.getByRole("button", { name: l.save })).toBeDisabled();
        expect(fakeApi.requests.some((r) => r.method === "PUT" && r.path === "/me/name")).toBe(false);

        await page.getByLabel(l.nameLabel).fill(LONG_NAME);
        await expect(page.getByRole("button", { name: l.save })).toBeEnabled();
        expect(await noOverflow(page)).toBe(true);
      });

      test("the API's too_long answer is shown in plain words and keeps what was typed", async ({ page, baseURL, fakeApi }) => {
        fakeApi.override("PUT /me/name", json(400, { error: "too_long" }));
        await openMe(page, baseURL);
        await page.getByRole("link", { name: l.edit }).click();
        await page.getByLabel(l.nameLabel).fill(LONG_NAME);
        await page.getByRole("button", { name: l.save }).click();
        await expect(page.getByRole("alert").filter({ hasText: l.tooLong })).toBeVisible();
        await expect(page).toHaveURL(/\/me\/edit$/);
        await expect(page.getByLabel(l.nameLabel)).toHaveValue(LONG_NAME);
      });

      test("a 40-character name wraps instead of overflowing on Me", async ({ page, baseURL, fakeApi }) => {
        fakeApi.state.user.displayName = LONG_NAME;
        await openMe(page, baseURL);
        await expect(page.getByText(LONG_NAME, { exact: true })).toBeVisible();
        expect(await noOverflow(page)).toBe(true);
      });
    });

    test.describe("with nothing set", () => {
      test.use({ fakeState: resident(null) });

      test("shows the email's local part, the add link, and the link opens the edit route", async ({ page, baseURL }) => {
        await openMe(page, baseURL);
        await expect(page.getByText(LOCAL_PART, { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("link", { name: l.edit })).toHaveCount(0);
        const add = page.getByRole("link", { name: l.addLink });
        await expect(add).toBeVisible();
        expect(((await add.boundingBox())!).height).toBeGreaterThanOrEqual(44);
        await add.click();
        await expect(page).toHaveURL(/\/me\/edit$/);
        await expect(page.getByLabel(l.nameLabel)).toHaveValue("");
      });
    });

    test.describe("without a Home", () => {
      test.use({ fakeState: { ...resident("Abner Lima"), home: null } });

      test("has no Streak line", async ({ page, baseURL }) => {
        await openMe(page, baseURL);
        await expect(page.getByText("Abner Lima", { exact: true })).toBeVisible();
        await expect(page.getByText(l.streak, { exact: true })).toHaveCount(0);
        await expect(page.getByText(/Streak|Sequência/)).toHaveCount(0);
      });
    });

    test.describe("when GET /me fails", () => {
      test.use({ fakeState: resident("Abner Lima") });

      test("shows Retry, keeps the cards working, and Retry brings the header back", async ({ page, baseURL, fakeApi }) => {
        // The app asks for /me more than once while it starts, so the failure is switched off by hand, not by count.
        let broken = true;
        fakeApi.override("GET /me", (_, state) => {
          if (broken) return json(500, { error: "internal error" });
          const { id, email, displayName, photoUrl } = state.user;
          return json(200, { id, email, displayName: displayName ?? null, name: displayName ?? email, photoUrl: photoUrl ?? null });
        });
        await openMe(page, baseURL);
        await expect(page.getByRole("alert").filter({ hasText: l.loadFailed })).toBeVisible();
        await page.getByRole("button", { name: l.baseline, exact: true }).click();
        await expect(page.getByRole("button", { name: l.baseline, exact: true })).toHaveAttribute("aria-expanded", "true");

        broken = false;
        await page.getByRole("button", { name: l.retry }).click();
        await expect(page.getByText("Abner Lima", { exact: true })).toBeVisible();
      });
    });
  });
}
