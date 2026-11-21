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
  { heading: "Mobile", viewport: { width: 375, height: 844 } },
  { heading: "Desktop", viewport: { width: 1440, height: 900 } },
];
const TIMEZONE = "America/Sao_Paulo";

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

/** The failure message when the page is wider than the viewport, naming the widest offender; null when it fits. `measured` is {scrollWidth, innerWidth, offenders: [{description, right}]}. */
export function overflowOf(route, { scrollWidth, innerWidth, offenders }) {
  if (scrollWidth <= innerWidth) return null;
  const widest = offenders.reduce((a, b) => (b.right > a.right ? b : a), { description: "unknown", right: 0 });
  return `${route} scrolls sideways: page is ${scrollWidth}px wide in a ${innerWidth}px viewport; widest element ${widest.description} ends at ${Math.round(widest.right)}px`;
}

/** Runs in the page: the widths and the elements that end past the viewport. */
function measureOverflow() {
  const offenders = [...document.querySelectorAll("body *")]
    .map((el) => ({ el, right: el.getBoundingClientRect().right }))
    .filter(({ right }) => right > window.innerWidth)
    .map(({ el, right }) => ({
      description: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join("")}> "${(el.textContent ?? "").trim().slice(0, 30)}"`,
      right,
    }));
  return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, offenders };
}

async function main([outDir, prefix]) {
  const { chromium } = createRequire(join(process.env.PLAYWRIGHT_DIR, "noop.js"))("playwright");
  const routes = changedScreens(process.env.CHANGED.split("\n").filter(Boolean));
  const apiUrl = process.env.API_URL;
  // The day in the zone the page runs in, so the fake's dates and the screen's "today" agree.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
  const unmocked = new Set();
  const overflowing = [];
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
      if (heading === "Mobile") {
        const message = overflowOf(route, await page.evaluate(measureOverflow));
        if (message && OVERFLOW_EXEMPT.has(route)) console.error(`warning (exempt): ${message}`);
        else if (message) overflowing.push(message);
      }
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
  if (overflowing.length) throw new Error(`Horizontal overflow at ${widths[0].viewport.width}px:\n${overflowing.join("\n")}`);
  process.stdout.write(withScreenshots(process.env.BODY, prefix, images));
}

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
