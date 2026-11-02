import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";

// What this covers, in both locales: a housemate's page at /home/residents/:id under the Home tab. The header
// (name, Streak, last-30-days count), the day groups (Today, Yesterday, then the weekday, from the Home's date and
// zone: 02:30Z is still the evening before in Sao Paulo), the oldest Completion first, the "with" line and no
// actions, the empty state, not found, an error with Retry, the skeleton and its steady layout, a deep link and
// reload that keep the Home tab highlighted, your own id going to Me, and Back returning to /home.

const LOCALES = [
  {
    locale: "pt-BR",
    back: "Seu lar",
    streak: "dias de sequência",
    done30: "Tarefas concluídas em 30 dias",
    recent: "Concluídas há pouco",
    today: "Hoje",
    yesterday: "Ontem",
    // Intl writes the weekday in lower case; the heading capitalises its first letter with CSS.
    saturday: "sábado, 12 de janeiro",
    tenBack: "sábado, 5 de janeiro",
    twentyNineBack: "segunda-feira, 17 de dezembro",
    shower: "9:02",
    vacuumMeta: "Pisos · 9:15, com Bruna Souza",
    stoveMeta: "Cozinha · 19:40",
    trashMeta: "Lixo · 23:30",
    empty: "Nada concluído nos últimos 30 dias.",
    notFound: "Não encontramos este morador no seu lar.",
    error: "Algo deu errado ao carregar este morador. Tente novamente em instantes.",
    retry: "Tentar novamente",
    nav: "Principal",
    home: "Lar",
    residentsRegion: "Moradores",
  },
  {
    locale: "en-US",
    back: "Your Home",
    streak: "day Streak",
    done30: "Tasks done in 30 days",
    recent: "Done lately",
    today: "Today",
    yesterday: "Yesterday",
    saturday: "Saturday, January 12",
    tenBack: "Saturday, January 5",
    twentyNineBack: "Monday, December 17",
    shower: "9:02 AM",
    vacuumMeta: "Floors · 9:15 AM, with Bruna Souza",
    stoveMeta: "Kitchen · 7:40 PM",
    trashMeta: "Trash · 11:30 PM",
    empty: "Nothing completed in the last 30 days.",
    notFound: "We could not find this Resident in your Home.",
    error: "Something went wrong loading this Resident. Try again in a moment.",
    retry: "Try again",
    nav: "Main",
    home: "Home",
    residentsRegion: "Residents",
  },
] as const;

const state = signedInResident();
state.residents = [
  { id: "resident-1", you: true, name: "resident", photoUrl: null, streak: 6 },
  {
    id: "resident-2",
    you: false,
    name: "Ana Souza",
    photoUrl: null,
    streak: 11,
    completions: [
      // Out of order on purpose: the page shows the oldest of a day first, and 02:30Z is 23:30 the day before.
      { id: "c3", choreName: "Take out the trash", category: "trash", completedAt: "2030-01-15T02:30:00Z" },
      { id: "c2", choreName: "Vacuum the living room", category: "floors", completedAt: "2030-01-15T12:15:00Z", with: [{ id: "resident-3", name: "Bruna Souza" }] },
      { id: "c1", choreName: "Deep clean the shower", category: "bathroom", completedAt: "2030-01-15T12:02:00Z" },
      { id: "c4", choreName: "Clean the stove", category: "kitchen", completedAt: "2030-01-14T22:40:00Z" },
      { id: "c5", choreName: "Wash the dishes", category: "kitchen", completedAt: "2030-01-12T14:00:00Z" },
      // Thirty local days back: outside the window, so it is never shown or counted.
      { id: "c6", choreName: "Old chore", category: "other", completedAt: "2029-12-16T14:00:00Z" },
    ],
  },
  {
    id: "resident-5",
    you: false,
    name: "Carla Lima",
    photoUrl: null,
    streak: 2,
    completions: [
      { id: "d1", choreName: "Water the plants", category: "outdoor", completedAt: "2030-01-15T12:00:00Z" },
      { id: "d2", choreName: "Mop the kitchen", category: "floors", completedAt: "2030-01-05T14:00:00Z" },
      { id: "d3", choreName: "Clean the oven", category: "kitchen", completedAt: "2029-12-17T14:00:00Z" },
      { id: "d4", choreName: "Old chore", category: "other", completedAt: "2029-12-16T14:00:00Z" },
    ],
  },
  { id: "resident-4", you: false, name: "jrocha", photoUrl: null, streak: 0 },
];

for (const l of LOCALES) {
  test.describe(l.locale, () => {
    test.use({ locale: l.locale, viewport: { width: 390, height: 844 }, fakeState: state });

    test.beforeEach(async ({ page, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      await seedSession(page, { email: RESIDENT_EMAIL });
    });

    test("shows the name, Streak, the 30-day count and the days newest first with their headings", async ({ page }) => {
      await visit(page, "/home/residents/resident-2");
      await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
      await expect(page.getByText(l.streak, { exact: true })).toBeVisible();
      await expect(page.getByText(l.done30, { exact: true })).toBeVisible();
      // The Streak is 11 and five Completions fall in the window (the old one is out).
      await expect(page.getByText("11", { exact: true })).toBeVisible();
      await expect(page.getByText("5", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: l.recent, level: 3 })).toBeVisible();

      const headings = page.getByRole("heading", { level: 4 });
      await expect(headings).toHaveText([l.today, l.yesterday, l.saturday]);

      const cards = page.getByRole("listitem").filter({ hasText: " · " });
      await expect(cards).toHaveCount(5);
      await expect(cards.nth(0)).toContainText("Deep clean the shower");
      await expect(cards.nth(0)).toContainText(l.shower);
      await expect(cards.nth(1)).toContainText("Vacuum the living room");
      await expect(cards.nth(1)).toContainText(l.vacuumMeta);
      await expect(cards.nth(2)).toContainText("Clean the stove");
      await expect(cards.nth(2)).toContainText(l.stoveMeta);
      await expect(cards.nth(3)).toContainText("Take out the trash");
      await expect(cards.nth(3)).toContainText(l.trashMeta);
      await expect(cards.nth(4)).toContainText("Wash the dishes");
      await expect(page.getByText("Old chore")).toHaveCount(0);
    });

    test("lists the whole 30-day window: today-10 and today-29 show, today-30 does not", async ({ page }) => {
      await visit(page, "/home/residents/resident-5");
      await expect(page.getByRole("heading", { name: "Carla Lima", level: 2 })).toBeVisible();
      await expect(page.getByRole("heading", { level: 4 })).toHaveText([l.today, l.tenBack, l.twentyNineBack]);
      await expect(page.getByText(l.done30, { exact: true })).toBeVisible();
      await expect(page.getByText("3", { exact: true })).toBeVisible();
      await expect(page.getByText("Old chore")).toHaveCount(0);
    });

    test("at the largest text size nothing is cut with an ellipsis and nothing overflows sideways", async ({ page }) => {
      await visit(page, "/home/residents/resident-5");
      await expect(page.getByRole("heading", { name: "Carla Lima", level: 2 })).toBeVisible();
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await expect(page.getByText(l.done30, { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { level: 4, name: l.twentyNineBack })).toBeVisible();
      const clipped = await page.locator("main *").evaluateAll(
        (nodes) =>
          nodes.filter((n) => {
            const style = getComputedStyle(n);
            return style.textOverflow === "ellipsis" || (n.scrollWidth > n.clientWidth + 1 && style.overflowX !== "visible");
          }).length,
      );
      expect(clipped).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("has no actions on a Completion and nothing private", async ({ page }) => {
      await visit(page, "/home/residents/resident-2");
      await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
      // A Completion is a record: no button on the page (the top bar's Energy pill and Streak are the only two) and no link inside a card.
      await expect(page.getByRole("button")).toHaveCount(2);
      await expect(page.getByTestId("top-bar").getByRole("button")).toHaveCount(2);
      await expect(page.getByRole("listitem").filter({ hasText: " · " }).getByRole("link")).toHaveCount(0);
      // The Resident's own Energy is in the top bar; nothing private about the other Resident is in the page.
      const body = await page.locator("main").evaluate((main) => {
        const copy = main.cloneNode(true) as HTMLElement;
        copy.querySelector('[data-testid="top-bar"]')?.remove();
        return copy.textContent ?? "";
      });
      expect(body).not.toMatch(/Energy|Energia|Baseline|Check-in|Preference|Preferência|Restriction|Restrição/);
    });

    test("an empty week shows a neutral line, and the name and Streak still show", async ({ page }) => {
      await visit(page, "/home/residents/resident-4");
      await expect(page.getByRole("heading", { name: "jrocha", level: 2 })).toBeVisible();
      await expect(page.getByText(l.empty)).toBeVisible();
      // Zero reads in the same voice as any number (pt-BR counts 0 as singular).
      await expect(page.getByText(/^(Tarefas? concluídas? em 30 dias|Tasks done in 30 days)$/)).toBeVisible();
      // The page's two zeros, and the top bar's Streak button, which also reads 0 for this Home.
      await expect(page.getByText("0", { exact: true })).toHaveCount(3);
      await expect(page.getByTestId("top-bar").getByText("0", { exact: true })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 4 })).toHaveCount(0);
    });

    test("an unknown Resident shows a not-found message with the back link, not a redirect", async ({ page }) => {
      await visit(page, "/home/residents/nobody");
      await expect(page.getByText(l.notFound)).toBeVisible();
      await expect(page.getByRole("link", { name: l.back })).toBeVisible();
      await expect(page).toHaveURL((url) => url.pathname === "/home/residents/nobody");
    });

    test("a failed load shows an inline error with Retry and the back link, and Retry recovers", async ({ page, fakeApi }) => {
      fakeApi.override("GET /home/residents/{id}", json(500, { error: "internal error" }), { once: true });
      await visit(page, "/home/residents/resident-2");
      await expect(page.getByRole("alert")).toHaveText(l.error);
      await expect(page.getByRole("link", { name: l.back })).toBeVisible();
      await page.getByRole("button", { name: l.retry }).click();
      await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    });

    test("while the page is held the back link shows and a skeleton of the same size takes the place of the content", async ({ page }) => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(/\/home\/residents\/resident-2$/, async (route) => {
        // The page itself has the same path; only the API call is held.
        if (route.request().resourceType() === "document") return route.fallback();
        await held;
        await route.fallback();
      });
      await visit(page, "/home/residents/resident-2");
      await expect(page.getByRole("link", { name: l.back })).toBeVisible();
      const skeleton = page.getByTestId("resident-skeleton");
      await expect(skeleton).toBeVisible();
      const before = (await skeleton.boundingBox())!;
      const backBefore = (await page.getByRole("link", { name: l.back }).boundingBox())!;

      release();
      await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
      const header = (await page.getByRole("heading", { name: "Ana Souza", level: 2 }).boundingBox())!;
      const backAfter = (await page.getByRole("link", { name: l.back }).boundingBox())!;
      expect(backAfter.y).toBeCloseTo(backBefore.y, 0);
      // The name sits where the skeleton's name bar was: the header did not move.
      expect(header.y).toBeGreaterThan(before.y);
      expect(header.y).toBeLessThan(before.y + 160);
    });

    test("a deep link and a reload stay on the page with the Home tab highlighted", async ({ page }) => {
      await visit(page, "/home/residents/resident-2");
      await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
      const current = page.getByRole("navigation", { name: l.nav }).locator('a[aria-current="page"]');
      await expect(current).toHaveText(l.home);
      await page.reload();
      await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeVisible();
      await expect(page).toHaveURL((url) => url.pathname === "/home/residents/resident-2");
      await expect(current).toHaveText(l.home);
    });

    test("opening your own id from a link goes to Me", async ({ page }) => {
      await visit(page, "/home/residents/resident-1");
      await expect(page).toHaveURL((url) => url.pathname === "/me");
    });

    test("a row on the Home tab opens the page, and Back returns to /home", async ({ page }) => {
      await visit(page, "/home");
      await page.getByRole("region", { name: l.residentsRegion, exact: true }).getByRole("link", { name: /Ana Souza/ }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/home/residents/resident-2");
      await expect(page.getByRole("heading", { name: "Ana Souza", level: 2 })).toBeFocused();
      await page.getByRole("link", { name: l.back }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/home");
    });

    test("an unknown path under Residents still goes to Today", async ({ page }) => {
      await visit(page, "/home/residents");
      await expect(page).toHaveURL((url) => url.pathname === "/");
    });
  });
}
