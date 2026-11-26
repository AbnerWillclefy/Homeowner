import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers: the Home settings Sheet. Choosing a value sends `PUT /home` at once, with both fields, and a Toast
// offers Desfazer, which sends the whole previous settings back. A refused write puts the old value back. The time
// picker lists every 15 minutes. Leave still asks first, in a Dialog.

const LOCALES = [
  { locale: "pt-BR", settings: "Ajustes do lar", time: "Horário da alocação", zone: "Fuso horário", undo: "Desfazer", at0645: "6:45", at0700: "7:00", changed: "Horário da alocação alterado.", leave: "Sair deste lar", cancel: "Cancelar", nothing: "nada mudou" },
  { locale: "en-US", settings: "Home settings", time: "Allocation time", zone: "Timezone", undo: "Undo", at0645: "6:45 AM", at0700: "7:00 AM", changed: "Allocation time changed.", leave: "Leave this Home", cancel: "Cancel", nothing: "nothing changed" },
] as const;

const puts = (requests: { method: string; path: string; body: unknown }[]) => requests.filter((r) => r.method === "PUT" && r.path === "/home").map((r) => r.body);
const open = async (page: Page, name: string) => {
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  return page.getByRole("dialog");
};

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: signedInResident() });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    test("the time picker lists 96 slots, from midnight to 23:45", async ({ page }) => {
      await visit(page, "/home");
      const sheet = await open(page, l.settings);
      await sheet.getByRole("combobox", { name: l.time, exact: true }).click();
      const options = page.getByRole("option");
      await expect(options).toHaveCount(96);
      await expect(options.last()).toContainText(l.locale === "pt-BR" ? "23:45" : "11:45 PM");
    });

    test("choosing a time sends the whole settings at once; Desfazer sends the previous ones", async ({ page, fakeApi }) => {
      await visit(page, "/home");
      const sheet = await open(page, l.settings);
      await sheet.getByRole("combobox", { name: l.time, exact: true }).click();
      await page.getByRole("option", { name: l.at0645, exact: true }).click();

      await expect.poll(() => puts(fakeApi.requests)).toEqual([{ timezone: "America/Sao_Paulo", allocationTime: "06:45" }]);
      await expect(sheet).toHaveCount(0);
      await expect(page.getByText(l.changed, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: l.undo }).click();

      await expect.poll(() => puts(fakeApi.requests).length).toBe(2);
      expect(puts(fakeApi.requests)[1]).toEqual({ timezone: "America/Sao_Paulo", allocationTime: "07:00" });
      expect(fakeApi.state.home?.allocationTime).toBe("07:00");
      await expect((await open(page, l.settings)).getByRole("combobox", { name: l.time, exact: true })).toContainText(l.at0700);
    });

    test("a refused write puts the old value back and says so", async ({ page, fakeApi }) => {
      fakeApi.override("PUT /home", json(500, { error: "internal error" }), { once: true });
      await visit(page, "/home");
      const sheet = await open(page, l.settings);
      await sheet.getByRole("combobox", { name: l.time, exact: true }).click();
      await page.getByRole("option", { name: l.at0645, exact: true }).click();

      await expect(page.getByText(new RegExp(l.nothing)).first()).toBeVisible();
      expect(fakeApi.state.home?.allocationTime).toBe("07:00");
      await expect((await open(page, l.settings)).getByRole("combobox", { name: l.time, exact: true })).toContainText(l.at0700);
    });

    test("Leave still asks for confirmation before anything is sent", async ({ page, fakeApi }) => {
      await visit(page, "/home");
      const dialog = await open(page, l.leave);
      await expect(dialog).toBeVisible();
      expect(fakeApi.requests.filter((r) => r.method === "DELETE")).toHaveLength(0);
      await dialog.getByRole("button", { name: l.cancel }).click();
      await expect(dialog).toHaveCount(0);
      expect(fakeApi.requests.filter((r) => r.method === "DELETE")).toHaveLength(0);
    });
  });
}
