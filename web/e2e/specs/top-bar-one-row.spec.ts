import { test, expect } from "../fixtures";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { uncheckedDay } from "../mocks/handlers/today";
import { RESIDENT_EMAIL, signedInResident } from "../mocks/sampleHome";
import { seedSession } from "../mocks/session";
import { visit } from "../pages/launch";
import { shell } from "../pages/shell";

// What this covers: the top bar stays on one row at 320px and the default text size, in every state of the Energy
// indicator (Energy, Drained, no Baseline, checked in before the Allocation, no Check-in, read failed), in pt-BR
// only. One row means the indicator, the Streak and the logo share a vertical centre.
//
// With the voice microphone (a browser with speech recognition, which Chromium is) the three controls no longer fit
// beside the logo in the 17rem column, so the bar wraps by design: the logo stays on the first row and the indicator,
// the Streak and the microphone share the second, still inside the column. Without it, one row as before.

const LOCALES = ["pt-BR"] as const;
const STATES = ["energy", "drained", "no-baseline", "pending", "unset", "failed"] as const;

for (const locale of LOCALES) {
  test.describe(locale, () => {
    test.use({ locale, viewport: { width: 320, height: 640 }, fakeState: signedInResident() });

    for (const state of STATES) {
      test(`the top bar is one row when the Energy indicator is ${state}, without the microphone`, async ({ page, baseURL, fakeApi }) => {
        await page.addInitScript(() => {
          Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
          Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
        });
        fakeApi.use(signedInHandlers);
        fakeApi.state.streak = 3;
        await seedSession(page, { email: RESIDENT_EMAIL });
        const day = { ...fakeApi.state.dayPlan! };
        if (state === "drained") fakeApi.state.checkIn = { date: "2030-01-15", checkedIn: true, level: "drained", restrictions: [] };
        if (state === "no-baseline") fakeApi.state.dayPlan = { ...day, energy: 0 };
        if (state === "pending") fakeApi.state.dayPlan = { ...day, planned: false, energy: null, mine: [], others: [], pool: [] };
        if (state === "unset") fakeApi.state.checkIn = uncheckedDay();
        if (state === "failed") fakeApi.override("GET /home/check-in", json(500, { error: "boom" }));

        // /chores: nothing opens by itself there, so the unset state needs no dialog closed first.
        await visit(page, new URL("/chores", baseURL!).toString());
        const bar = shell.topBar(page);
        const energy = bar.locator('[data-slot="energy"] button');
        await expect(energy).toBeVisible();
        await expect(bar.locator('[data-slot="streak"] button')).toBeVisible();

        const [logo, indicator, streak, box] = await Promise.all([
          shell.logo(page).boundingBox(),
          energy.boundingBox(),
          bar.locator('[data-slot="streak"] button').boundingBox(),
          bar.boundingBox(),
        ]);
        const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
        expect(Math.abs(centre(indicator!) - centre(logo!))).toBeLessThan(2);
        expect(Math.abs(centre(streak!) - centre(logo!))).toBeLessThan(2);
        expect(box!.height).toBeLessThan(2 * 44);
        expect(indicator!.x + indicator!.width).toBeLessThanOrEqual(streak!.x + 1);
      });
    }

    test("with the microphone the bar wraps to two rows: the logo, then the three controls on one row", async ({ page, baseURL, fakeApi }) => {
      fakeApi.use(signedInHandlers);
      fakeApi.state.streak = 3;
      await seedSession(page, { email: RESIDENT_EMAIL });
      await visit(page, new URL("/chores", baseURL!).toString());
      const bar = shell.topBar(page);
      const mic = bar.locator('[data-slot="voice"] button');
      await expect(mic).toBeVisible();
      const [logo, indicator, streak, voice, box] = await Promise.all([
        shell.logo(page).boundingBox(),
        bar.locator('[data-slot="energy"] button').boundingBox(),
        bar.locator('[data-slot="streak"] button').boundingBox(),
        mic.boundingBox(),
        bar.boundingBox(),
      ]);
      const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
      expect(centre(indicator!) - centre(logo!)).toBeGreaterThan(40);
      expect(Math.abs(centre(streak!) - centre(indicator!))).toBeLessThan(2);
      expect(Math.abs(centre(voice!) - centre(indicator!))).toBeLessThan(2);
      expect(box!.height).toBeLessThanOrEqual(2 * 44 + 1);
      expect(indicator!.x + indicator!.width).toBeLessThanOrEqual(streak!.x + 1);
      expect(streak!.x + streak!.width).toBeLessThanOrEqual(voice!.x + 1);
      expect(voice!.x + voice!.width).toBeLessThanOrEqual(320);
      expect(voice!.width).toBeGreaterThanOrEqual(44);
    });
  });
}
