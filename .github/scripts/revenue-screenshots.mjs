// Screenshots the Revenue screens a pull request changes, in pt-BR and dark theme at phone and desktop width,
// against revenue-fake-api.mjs, and prints the description with them under "### Mobile" and "### Desktop".
// Usage: CHANGED=<files> BODY=<description> BASE_URL=<Revenue preview> API_URL=<the build's VITE_API_URL>
//        PLAYWRIGHT_DIR=<dir with playwright> node revenue-screenshots.mjs <out dir> <image url prefix>
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareBoxes, measureBoxes, measureOverflow, overflowOf, pairsMarkdown, roleSelectors, shootArtboard } from "./artboards.mjs";
import { withScreenshots } from "./bedrock-screenshots.mjs";
import { answer, TODAY } from "./revenue-fake-api.mjs";

const widths = [
  { heading: "Mobile", viewport: { width: 375, height: 844 } },
  { heading: "Desktop", viewport: { width: 1440, height: 900 } },
];
export const TIMEZONE = "America/Sao_Paulo";
/** The instant every page runs at: midday in São Paulo on the fake's TODAY, so no zone puts it on another date. */
export const FIXED_TIME = `${TODAY}T12:00:00-03:00`;

const ARTBOARD_DIR = fileURLToPath(new URL("../../docs/design/revenue/", import.meta.url));

// The phone artboards are a fixed 390 x 844 frame with an inner scroller. Opened at 375px that would cut 15px and everything below the fold, so the frame grows to the page (the files are not edited).
const PHONE_CSS = ".rv-phone{width:auto;height:auto;min-height:100vh;overflow:visible}.rv-phone__scroll{overflow:visible;flex:none}";

const dc = (mobile, desktop) => ({ Mobile: mobile && `${mobile}.dc.html`, Desktop: desktop && `${desktop}.dc.html` });
/** The artboard file of each route and width, null when the design has none (docs/design/revenue/README.md). Every route of the app has an entry. */
export const ARTBOARDS = {
  "/": dc("MobileOverview", "Main"),
  "/transactions": dc("MobileTransactions", "Transactions"),
  "/bills": dc("MobileBillsList", "Bills"),
  "/card-bills": dc("MobileCardBills", "CardBills"),
  "/categories": dc("MobileCategories", "Categories"),
  "/categories/:category": dc(null, null),
  "/goals": dc("MobileGoals", "Goals"),
  "/net-worth": dc("MobileNetWorth", "NetWorth"),
  "/projection": dc("MobileProjection", "Projection"),
  "/sources": dc("MobileSources", "Accounts"),
  "/pantry": dc("MobilePantry", "Pantry"),
  "/pantry/list": dc("MobileShoppingList", "ShoppingList"),
  "/chat": dc("MobileChat", "Chat"),
  "/settings": dc("MobileSettings", "Settings"),
  "/plan": dc("MobilePlan", null),
  "/more": dc("MobileMore", null),
  "/onboarding": dc(null, "Onboarding"),
};

/** Screens that live in a domain folder besides its own route: a change to the folder shoots them too. */
const EXTRA_ROUTES = { pantry: ["/pantry/list"] };

/** Routes that overflow the phone today. Each entry is removed by its screen ticket; the list only shrinks. */
// /goals: its Aporte row ends at 387px; the ticket that reworks the Goals screen removes this entry.
const OVERFLOW_EXEMPT = new Set(["/goals"]);

/** The routes whose domain folder changed (named after the route, see src/app/screens.tsx) and the extra ones of that folder; the Overview when only shared code did. A change to the app frame shoots the tab screens too. */
export function changedScreens(changedFiles) {
  const frame = changedFiles.some((f) => f.startsWith("revenue/src/app/"));
  const domains = new Set(changedFiles.map((f) => f.match(/^revenue\/src\/domains\/([^/]+)\//)?.[1]).filter(Boolean));
  const routes = [...domains].sort().flatMap((d) => [d === "overview" ? "/" : `/${d}`, ...(EXTRA_ROUTES[d] ?? [])]);
  const all = frame ? [...new Set(["/", "/plan", "/more", ...routes])] : routes;
  return all.length ? all : ["/"];
}

async function main([outDir, prefix]) {
  const { chromium } = createRequire(join(process.env.PLAYWRIGHT_DIR, "noop.js"))("playwright");
  const routes = changedScreens(process.env.CHANGED.split("\n").filter(Boolean));
  const apiUrl = process.env.API_URL;
  const unmocked = new Set();
  const overflowing = [];
  const browser = await chromium.launch();
  const images = {};
  for (const { heading, viewport } of widths) {
    const context = await browser.newContext({
      locale: "pt-BR", timezoneId: TIMEZONE, colorScheme: "dark", viewport, reducedMotion: "reduce", serviceWorkers: "block",
    });
    // Frozen on the context, so the app and any page opened in it show November 2026 on whatever day this runs; timers still run.
    await context.clock.setFixedTime(FIXED_TIME);
    // Signed in with a token that never needs refreshing, so Cognito is never called.
    await context.addInitScript(() => {
      localStorage.setItem("revenue.session", JSON.stringify({ idToken: "fake", refreshToken: "fake", expiresAt: 4102444800000 }));
      localStorage.setItem("revenue.theme", "dark");
      localStorage.setItem("revenue.locale", "pt-BR");
    });
    await context.route(`${apiUrl}/**`, (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const found = answer(request.method(), new URL(request.url()), TODAY);
      if (found === null) unmocked.add(`${request.method()} ${new URL(request.url()).pathname}`);
      return route.fulfill({ status: found?.status ?? 404, headers: cors, json: found?.body ?? {} });
    });
    const page = await context.newPage();
    images[heading] = [];
    for (const route of routes) {
      await page.goto(`${process.env.BASE_URL}${route}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      if (heading === "Mobile") {
        const message = overflowOf(route, await page.evaluate(measureOverflow));
        if (message && OVERFLOW_EXEMPT.has(route)) console.error(`warning (exempt): ${message}`);
        else if (message) overflowing.push(message);
      }
      const base = `auto-revenue${route.replace(/\//g, "-").replace(/-$/, "")}-${heading.toLowerCase()}`;
      // Measured before the viewport grows to the page, like the shot.
      const appBoxes = await page.evaluate(measureBoxes, roleSelectors("app"));
      // A viewport as tall as the page, not fullPage: fixed bars (the tab bar, the sidebar) stay where a person sees them.
      await page.setViewportSize({ ...viewport, height: await page.evaluate(() => document.documentElement.scrollHeight) });
      await page.screenshot({ path: join(outDir, `${base}-app.png`) });
      await page.setViewportSize(viewport);
      const artboard = ARTBOARDS[route]?.[heading];
      let measure;
      if (artboard) {
        // A second page of the same context, so the context's settings reach the artboard too.
        const designPage = await context.newPage();
        await shootArtboard(designPage, ARTBOARD_DIR, artboard, viewport, join(outDir, `${base}-design.png`), heading === "Mobile" ? PHONE_CSS : "");
        const designBoxes = await designPage.evaluate(measureBoxes, roleSelectors("design"));
        await designPage.close();
        // The raw boxes land on the screenshots branch with the PNGs, for the reviewer (design-pairs.sh).
        writeFileSync(join(outDir, `${base}-measure.json`), JSON.stringify({ app: appBoxes, design: designBoxes }));
        measure = compareBoxes(appBoxes, designBoxes);
      }
      images[heading].push({ route, app: `${prefix}${base}-app.png`, design: artboard ? `${prefix}${base}-design.png` : null, measure });
    }
    await context.close();
  }
  await browser.close();
  if (unmocked.size) throw new Error(`No fake answer in .github/scripts/revenue-fake-api.mjs for:\n${[...unmocked].join("\n")}`);
  if (overflowing.length) throw new Error(`Horizontal overflow at ${widths[0].viewport.width}px:\n${overflowing.join("\n")}`);
  process.stdout.write(withScreenshots(process.env.BODY, prefix, pairsMarkdown(images)));
}

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
