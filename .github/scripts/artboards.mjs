// Renders design artboards (docs/design/**/*.dc.html) outside the design canvas and pairs them with the app's screenshots.
// Nothing here knows about one app: the caller passes the artboard directory, its files and its viewport.
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "http://artboard.test";
const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const RUNTIME = here("./dc-runtime.js");
const BEDROCK = here("../../docs/design/bedrock");

/** The file on disk behind a URL path of the artboard origin, or null for a path outside the allowed directories. */
export function artboardPath(dir, urlPath) {
  const name = decodeURIComponent(urlPath).replace(/^\/+/, "");
  if (name.split("/").includes("..")) return null;
  if (name === "support.js") return RUNTIME;
  const [base, rest] = name.startsWith("ds/bedrock/") ? [BEDROCK, name.slice("ds/bedrock/".length)] : [dir, name];
  const file = resolve(base, rest);
  return file.startsWith(resolve(base) + sep) ? file : null;
}

/** The first leftover of the template language in the rendered HTML, or null when it is clean. */
export function leftoversIn(html) {
  return ["{{", "<sc-if", "<sc-for"].find((marker) => html.includes(marker)) ?? null;
}

/** Shoots `file` of `dir` into `path` at `viewport`. `css` is added after the render, to reshape a fixed frame without editing the file. Throws "<file>: ..." when the artboard breaks. */
export async function shootArtboard(page, dir, file, viewport, path, css = "") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const found = artboardPath(dir, new URL(route.request().url()).pathname);
    if (!found) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ path: found, status: 200 }).catch(() => route.fulfill({ status: 404, body: "not found" }));
  });
  await page.setViewportSize(viewport);
  await page.goto(`${ORIGIN}/${file}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.dc, null, { timeout: 10000 }).catch(() => {
    throw new Error(`${file}: the artboard never finished rendering${errors.length ? `: ${errors.join("; ")}` : ""}`);
  });
  await page.evaluate(() => document.fonts.ready);
  const { state, message, html } = await page.evaluate(() => ({
    state: document.documentElement.dataset.dc,
    message: document.documentElement.dataset.dcError,
    html: document.body.innerHTML,
  }));
  if (errors.length) throw new Error(`${file}: page error: ${errors.join("; ")}`);
  if (state !== "done") throw new Error(`${file}: ${message}`);
  const left = leftoversIn(html);
  if (left) throw new Error(`${file}: the rendered artboard still contains ${left}`);
  if (css) await page.addStyleTag({ content: css });
  // A viewport as tall as the page, like the app shot.
  await page.setViewportSize({ ...viewport, height: await page.evaluate(() => document.documentElement.scrollHeight) });
  await page.screenshot({ path });
}

/** One HTML table per heading with App and Design side by side. `images` is { Mobile: [{ route, app, design }] } with URLs; `design` is null without an artboard. One line per heading, so withScreenshots drops it whole on a re-run. */
export function pairsMarkdown(images) {
  const cell = (url, alt) => (url ? `<td><img src="${url}" alt="${alt}"></td>` : "<td>no artboard</td>");
  return Object.fromEntries(
    Object.entries(images).map(([heading, rows]) => [
      heading,
      rows.length
        ? [`<table><tr><th>App</th><th>Design</th></tr>${rows.map(({ route, app, design }) => `<tr><td colspan="2"><code>${route}</code></td></tr><tr>${cell(app, `${route} ${heading} app`)}${cell(design, `${route} ${heading} design`)}</tr>`).join("")}</table>`]
        : [],
    ]),
  );
}
