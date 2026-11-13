// Screenshots the Revenue screens a pull request changes, in pt-BR and dark theme at phone and desktop width,
// against revenue-fake-api.mjs, and prints the description with them under "### Mobile" and "### Desktop".
// Usage: CHANGED=<files> BODY=<description> BASE_URL=<Revenue preview> API_URL=<the build's VITE_API_URL>
//        PLAYWRIGHT_DIR=<dir with playwright> node revenue-screenshots.mjs <out dir> <image url prefix>
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { withScreenshots } from "./bedrock-screenshots.mjs";
import { answer } from "./revenue-fake-api.mjs";

const widths = [
  { heading: "Mobile", viewport: { width: 390, height: 844 } },
  { heading: "Desktop", viewport: { width: 1440, height: 900 } },
];
const TIMEZONE = "America/Sao_Paulo";

/** The routes whose domain folder changed (named after the route, see src/app/screens.tsx); the Overview when only shared code did. */
export function changedScreens(changedFiles) {
  const domains = new Set(changedFiles.map((f) => f.match(/^revenue\/src\/domains\/([^/]+)\//)?.[1]).filter(Boolean));
  const routes = [...domains].sort().map((d) => (d === "overview" ? "/" : `/${d}`));
  return routes.length ? routes : ["/"];
}

async function main([outDir, prefix]) {
  const { chromium } = createRequire(join(process.env.PLAYWRIGHT_DIR, "noop.js"))("playwright");
  const routes = changedScreens(process.env.CHANGED.split("\n").filter(Boolean));
  const apiUrl = process.env.API_URL;
  // The day in the zone the page runs in, so the fake's dates and the screen's "today" agree.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
  const unmocked = new Set();
  const browser = await chromium.launch();
  const images = {};
  for (const { heading, viewport } of widths) {
    const context = await browser.newContext({
      locale: "pt-BR", timezoneId: TIMEZONE, colorScheme: "dark", viewport, reducedMotion: "reduce", serviceWorkers: "block",
    });
    // Signed in with a token that never needs refreshing, so Cognito is never called.
    await context.addInitScript(() => {
      localStorage.setItem("revenue.session", JSON.stringify({ idToken: "fake", refreshToken: "fake", expiresAt: 4102444800000 }));
      localStorage.setItem("revenue.theme", "dark");
      localStorage.setItem("revenue.locale", "pt-BR");
    });
    await context.route(`${apiUrl}/**`, (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const found = answer(request.method(), new URL(request.url()), today);
      if (found === null) unmocked.add(`${request.method()} ${new URL(request.url()).pathname}`);
      return route.fulfill({ status: found?.status ?? 404, headers: cors, json: found?.body ?? {} });
    });
    const page = await context.newPage();
    images[heading] = [];
    for (const route of routes) {
      await page.goto(`${process.env.BASE_URL}${route}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const file = `auto-revenue${route.replace(/\//g, "-").replace(/-$/, "")}-${heading.toLowerCase()}.png`;
      // A viewport as tall as the page, not fullPage: fixed bars (the tab bar, the sidebar) stay where a person sees them.
      await page.setViewportSize({ ...viewport, height: await page.evaluate(() => document.documentElement.scrollHeight) });
      await page.screenshot({ path: join(outDir, file) });
      await page.setViewportSize(viewport);
      images[heading].push(`![${route} ${heading}](${prefix}${file})`);
    }
    await context.close();
  }
  await browser.close();
  if (unmocked.size) throw new Error(`No fake answer in .github/scripts/revenue-fake-api.mjs for:\n${[...unmocked].join("\n")}`);
  process.stdout.write(withScreenshots(process.env.BODY, prefix, images));
}

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
