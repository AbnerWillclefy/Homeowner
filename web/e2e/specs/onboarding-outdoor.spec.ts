import { test, expect } from "../fixtures";
import { catalogHandlers } from "../mocks/handlers/catalog";
import { homeHandlers } from "../mocks/handlers/home";
import { onboarding } from "../pages/onboarding";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { residentsHandlers } from "../mocks/handlers/residents";
import { todayHandlers } from "../mocks/handlers/today";
import { seedSession } from "../mocks/session";
import { launchApp } from "../pages/launch";

// What this covers: the outdoor areas in the Home questionnaire. A chip adds a counter row at 1 and hides itself,
// stepping the row down to 0 removes it and brings the chip back, there is no "None", and two gardens become two
// Chores in the review. Starts on the Home step (the earlier steps are done), in pt-BR first and then English.

const LOCALES = [
  {
    locale: "pt-BR",
    next: "Próximo: sobre o seu lar",
    suggest: "Sugerir afazeres",
    legend: "Área externa",
    garden: "Jardim",
    gardens: "Jardins",
    balcony: "Varanda",
    balconies: "Varandas",
    yards: "Quintais",
    none: "Nenhuma",
    chores: ["Regar o jardim 1", "Regar o jardim 2"],
  },
  {
    locale: "en-US",
    next: "Next: about your Home",
    suggest: "Suggest Chores",
    legend: "Outdoor space",
    garden: "Garden",
    gardens: "Gardens",
    balcony: "Balcony",
    balconies: "Balconies",
    yards: "Yards",
    none: "None",
    chores: ["Water the garden 1", "Water the garden 2"],
  },
] as const;

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, fakeState: { onboardingStored: "preferences" } });

    test.beforeEach(async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(onboardingHandlers);
      fakeApi.use(homeHandlers);
      fakeApi.use(catalogHandlers);
      fakeApi.use(todayHandlers);
      fakeApi.use(residentsHandlers);
      await seedSession(page);
      await launchApp(page, baseURL!);
      await page.getByRole("button", { name: l.next, exact: true }).click();
    });

    test("a chip adds a row at 1, stepping to 0 brings the chip back, and there is no None", async ({ page }) => {
      const chip = onboarding.outdoorChip(page, l.garden);
      const count = onboarding.outdoorCount(page, l.gardens);

      await expect(chip).toBeVisible();
      await expect(count).toHaveCount(0);
      await expect(page.getByText(l.none, { exact: true })).toHaveCount(0);

      await chip.click();
      await expect(count).toHaveValue("1");
      await expect(chip).toHaveCount(0);
      // The chip unmounted, so focus moved to the new row's field.
      await expect(count).toBeFocused();

      // Typing 0 keeps the row while the field has focus; leaving it removes the row.
      await count.fill("0");
      await expect(count).toBeVisible();
      await count.blur();
      await expect(count).toHaveCount(0);
      await expect(chip).toBeVisible();
    });

    test("the − button at 1 removes the row at once and the chip shows again", async ({ page }) => {
      await onboarding.outdoorChip(page, l.garden).click();
      const count = onboarding.outdoorCount(page, l.gardens);
      await expect(count).toHaveValue("1");
      // The round buttons are pointer-only and hidden from the accessibility tree, so find the one beside the field.
      await count.locator("xpath=preceding-sibling::button").click();
      await expect(count).toHaveCount(0);
      await expect(onboarding.outdoorChip(page, l.garden)).toBeVisible();
    });

    test("two gardens become two Chores in the review", async ({ page, fakeApi }) => {
      await onboarding.outdoorChip(page, l.garden).click();
      await onboarding.outdoorCount(page, l.gardens).fill("2");
      await page.getByRole("button", { name: l.suggest, exact: true }).click();

      for (const name of l.chores) await expect(page.getByRole("heading", { name, level: 4, exact: true })).toBeVisible();
      const sent = fakeApi.requests.filter((r) => r.method === "POST" && r.path === "/catalog/proposals");
      expect(sent.map((r) => (r.body as { outdoor?: unknown }).outdoor)).toEqual([{ balconies: 0, yards: 0, gardens: 2 }]);
    });

    test("a count above 10 is held at 10 and the rows keep a fixed order", async ({ page }) => {
      await onboarding.outdoorChip(page, l.garden).click();
      await onboarding.outdoorCount(page, l.gardens).fill("11");
      await expect(onboarding.outdoorCount(page, l.gardens)).toHaveValue("10");
      await expect(page.getByText(l.legend, { exact: true })).toBeVisible();
      // The Varanda row is added after the garden but shows before it.
      const balconyChip = page.getByRole("button", { name: new RegExp(l.balcony, "i") });
      await balconyChip.click();
      const labels = await page.locator("label", { hasText: new RegExp(`^(${l.balconies}|${l.yards}|${l.gardens})$`) }).allTextContents();
      expect(labels).toEqual([l.balconies, l.gardens]);
    });
  });
}
