import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { compareBoxes, measureBoxes, measureOverflow, overflowOf, roleSelectors, shootArtboard } from "../../../.github/scripts/artboards.mjs";
import { test } from "../fixtures";
import { hold } from "../mocks/hold";
import { json } from "../mocks/api";
import { signedInHandlers } from "../mocks/handlers/signedIn";
import { onboardingHandlers } from "../mocks/handlers/onboarding";
import { homeHandlers } from "../mocks/handlers/home";
import { seedSession } from "../mocks/session";
import { RESIDENT_EMAIL } from "../mocks/sampleHome";
import { pairsHome } from "./data";
import { OPENERS } from "./openers";
import { AXE_EXEMPT, changedArtboards, OVERFLOW_EXEMPT, SCREENS } from "./screens";

// The design pairs: each selected artboard's screen in the app (pt-BR, dark, 390px, against the e2e fakes) beside the
// artboard itself. Run by the ui-screenshots check (.github/scripts/web-screenshots.mjs reads what this writes), or by
// hand: `npm run build:e2e && PAIRS_ALL=1 npx playwright test -c playwright.pairs.config.ts`.
// PAIRS_ALL=1 shoots every artboard; otherwise CHANGED holds the pull request's changed files, one per line.
// PAIRS_OUT is where the PNGs go, PAIRS_RESULTS where one JSON per artboard goes (the rows of the description).

const OUT = resolve(process.env["PAIRS_OUT"] ?? "pairs-out");
const RESULTS = resolve(process.env["PAIRS_RESULTS"] ?? "pairs-results");
const ARTBOARDS = fileURLToPath(new URL("../../../docs/design/homeowner/", import.meta.url));
const VIEWPORT = { width: 390, height: 844 };
// The artboards are a fixed 390 x 844 frame with an inner scroller: the frame grows to the page, like the app shot.
const PHONE_CSS = ".hm-phone{height:auto;min-height:100vh;overflow:visible}.hm-scroll{overflow:visible;flex:none}";
const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const names = process.env["PAIRS_ALL"] ? Object.keys(SCREENS) : changedArtboards((process.env["CHANGED"] ?? "").split("\n").filter(Boolean));

mkdirSync(OUT, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

test.use({ locale: "pt-BR", colorScheme: "dark", viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: "reduce" });

for (const name of names) {
  const entry = SCREENS[name];
  if (!entry || "none" in entry) continue;
  const data = entry.data ?? "default";

  test.describe(name, () => {
    test.use({ fakeState: pairsHome(data, entry.stored) });

    test("pair", async ({ page, baseURL, fakeApi, context }) => {
      // The fake plans 2030-01-15, so the app's clock reads that day too.
      await page.clock.setFixedTime(new Date("2030-01-15T10:30:00-03:00"));
      // A speech recognition that listens to nothing, so the microphone is in Today's header as on the artboards.
      await page.addInitScript(() => {
        const idle = class { lang = ""; start() {} stop() {} abort() {} };
        Object.assign(window, { SpeechRecognition: idle, webkitSpeechRecognition: idle });
      });
      if (data !== "signed-out" && data !== "signed-out-invite") await seedSession(page, { email: RESIDENT_EMAIL });
      if (data === "onboarding") {
        fakeApi.use(onboardingHandlers);
        fakeApi.use(homeHandlers);
      } else if (data === "signed-out" || data === "signed-out-invite") {
        // Nothing signed in answers.
      } else {
        fakeApi.use(signedInHandlers);
      }
      if (data === "invite" || data === "signed-out-invite") {
        fakeApi.on("GET /invites/abc123", () => json(200, {}));
        fakeApi.on("GET /home/chores/settings", () => json(200, { residents: [{ you: true, chores: {} }] }));
        fakeApi.on("POST /invites/abc123/accept", (_, state) => json(200, state.home));
      }

      const held = data === "loading" ? hold(page, /\/home\/day-plan/) : null;
      await page.goto(new URL(entry.path, baseURL!).toString(), { waitUntil: "load" });
      if (held) {
        // The skeleton is the state: shoot it before the read is released.
        await page.waitForTimeout(500);
      } else {
        await page.waitForLoadState("networkidle");
        if (data === "offline") await context.setOffline(true);
      }
      if (entry.state) await OPENERS[entry.state](page);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      // A dialog focuses its title on open: drop the focus ring from the picture.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      const base = `auto-web-${kebab(name)}-mobile`;
      const appBoxes = await page.evaluate(measureBoxes, roleSelectors("app"));
      const message = overflowOf(name, await page.evaluate(measureOverflow));
      // A Sheet or Dialog is fixed to the viewport, so it is shot at phone height, as its artboard is; a page is shot whole.
      if (!entry.state) await page.setViewportSize({ ...VIEWPORT, height: await page.evaluate(() => document.documentElement.scrollHeight) });
      await page.screenshot({ path: join(OUT, `${base}-app.png`) });
      // After the opener, so an open Sheet or Dialog is scanned; after the shot, so the picture is unchanged.
      await page.addScriptTag({ path: fileURLToPath(import.meta.resolve("axe-core/axe.min.js")) });
      const axeResults = await page.evaluate(() => (window as unknown as { axe: { run(c: Document, o: object): Promise<{ violations: { id: string; impact: string | null; nodes: { target: unknown[] }[] }[] }> } }).axe.run(document, { resultTypes: ["violations"] }));
      const axe = axeResults.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.flat().join(" ")) }));
      held?.release();

      const designPage = await context.newPage();
      await shootArtboard(designPage, ARTBOARDS, `${name}.dc.html`, VIEWPORT, join(OUT, `${base}-design.png`), PHONE_CSS);
      const designBoxes = await designPage.evaluate(measureBoxes, roleSelectors("design"));
      await designPage.close();
      // The raw boxes land on the screenshots branch with the PNGs, for the reviewer (.github/scripts/design-pairs.sh).
      writeFileSync(join(OUT, `${base}-measure.json`), JSON.stringify({ app: appBoxes, design: designBoxes }));

      const row = { artboard: name, route: entry.path, app: `${base}-app.png`, design: `${base}-design.png`, measure: compareBoxes(appBoxes, designBoxes), overflow: message, exempt: message !== null && OVERFLOW_EXEMPT.has(name), axe, axeExempt: AXE_EXEMPT.has(name) };
      writeFileSync(join(RESULTS, `${kebab(name)}.json`), JSON.stringify(row));
    });
  });
}
