// Renders design artboards (docs/design/**/*.dc.html) outside the design canvas and pairs them with the app's screenshots.
// Nothing here knows about one app: the caller passes the artboard directory, its files and its viewport.
import { basename, join, resolve, sep } from "node:path";
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

/** Answers one request of the artboard origin from `dir`. A stylesheet that is not there is added to `missing`: the runtime resolves a failed stylesheet quietly, so only this keeps an unstyled artboard from passing. */
export async function serveArtboard(route, dir, missing) {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const found = artboardPath(dir, path);
  const notFound = () => {
    if (request.resourceType() === "stylesheet") missing.push(path);
    return route.fulfill({ status: 404, body: "not found" });
  };
  if (!found) return notFound();
  return route.fulfill({ path: found, status: 200 }).catch(notFound);
}

/** Shoots `file` of `dir` into `path` at `viewport`. `css` is added after the render, to reshape a fixed frame without editing the file. Throws "<file>: ..." when the artboard breaks. */
export async function shootArtboard(page, dir, file, viewport, path, css = "") {
  const errors = [];
  const missing = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(`${ORIGIN}/**`, (route) => serveArtboard(route, dir, missing));
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
  if (missing.length) throw new Error(`${file}: stylesheet not found: ${missing.join(", ")}`);
  if (errors.length) throw new Error(`${file}: page error: ${errors.join("; ")}`);
  if (state !== "done") throw new Error(`${file}: ${message}`);
  const left = leftoversIn(html);
  if (left) throw new Error(`${file}: the rendered artboard still contains ${left}`);
  // Before `css`: the artboard is checked as its own CSS renders it, so the phone overrides cannot cause or hide a failure.
  const key = `${basename(dir)}/${file}`;
  const failures = heightFailures(key, (await page.evaluate(measureHeights)).filter(({ declared, rendered }) => undersized(declared, rendered)), HEIGHT_EXEMPT);
  if (failures.length) throw new Error(failures.join("; "));
  if (css) await page.addStyleTag({ content: css });
  // A viewport as tall as the page, like the app shot.
  await page.setViewportSize({ ...viewport, height: await page.evaluate(() => document.documentElement.scrollHeight) });
  await page.screenshot({ path });
}

/** True when an element declaring `declared` px renders at 0 or shorter than that; the margin absorbs sub-pixel rounding. */
export function undersized(declared, rendered) {
  return rendered === 0 || rendered < declared - 0.5;
}

/** Artboards ("<app dir>/<file>" → reason) that render shorter than they declare and cannot be fixed. It may only shrink: an entry that renders clean fails. */
export const HEIGHT_EXEMPT = {};

/** The messages for the undersized elements `found` ({description, declared, rendered}) of `key`; an exempt key gives none, and gives a "remove it" message when it found nothing. */
export function heightFailures(key, found, exempt) {
  if (key in exempt) return found.length ? [] : [`${key}: renders every declared height, remove it from HEIGHT_EXEMPT`];
  return found.map(({ description, declared, rendered }) => `${key}: ${description} declares ${declared}px but renders ${rendered}px`);
}

/** Runs in the page: every visible element with a literal px height or min-height, as {description, declared, rendered}. Uses nothing outside itself. shortcut: var() heights are skipped and the cascade is approximated by document order, resolve var() through a probe element when token heights need checking. */
export function measureHeights() {
  const px = (v) => (typeof v === "string" && /^\d+(\.\d+)?px$/.test(v.trim()) ? parseFloat(v) : null);
  const rules = [];
  const collect = (list) => {
    for (const rule of list) {
      // Style rules also have a (nesting) cssRules in Chromium, so test for them first.
      if (rule.selectorText && rule.style) rules.push(rule);
      else if (rule.cssRules && (!rule.conditionText || matchMedia(rule.conditionText).matches)) collect(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      collect(sheet.cssRules);
    } catch {
      // The Google Fonts sheet is cross-origin and its cssRules throws.
    }
  }
  const declaredOf = (el) => {
    const inline = px(el.style.height) ?? px(el.style.minHeight);
    if (inline !== null) return inline;
    let found = null;
    for (const rule of rules) {
      let hit = false;
      try {
        hit = el.matches(rule.selectorText);
      } catch {
        // A selector this browser cannot parse never matches.
      }
      if (hit) found = px(rule.style.height) ?? px(rule.style.minHeight) ?? found;
    }
    return found;
  };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!el.checkVisibility()) continue;
    const declared = declaredOf(el);
    if (declared === null) continue;
    const max = px(getComputedStyle(el).maxHeight);
    if (max !== null && max < declared) continue;
    out.push({
      description: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join("")}> "${(el.textContent ?? "").trim().slice(0, 30)}"`,
      declared,
      rendered: el.getBoundingClientRect().height,
    });
  }
  return out;
}

/** The failure message when the page is wider than the viewport, naming the widest offender; null when it fits. `measured` is {scrollWidth, innerWidth, offenders: [{description, right}]}. */
export function overflowOf(route, { scrollWidth, innerWidth, offenders }) {
  if (scrollWidth <= innerWidth) return null;
  const widest = offenders.reduce((a, b) => (b.right > a.right ? b : a), { description: "unknown", right: 0 });
  return `${route} scrolls sideways: page is ${scrollWidth}px wide in a ${innerWidth}px viewport; widest element ${widest.description} ends at ${Math.round(widest.right)}px`;
}

/** Runs in the page: the widths and the elements that end past the viewport. */
export function measureOverflow() {
  const offenders = [...document.querySelectorAll("body *")]
    .map((el) => ({ el, right: el.getBoundingClientRect().right }))
    .filter(({ right }) => right > window.innerWidth)
    .map(({ el, right }) => ({
      description: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join("")}> "${(el.textContent ?? "").trim().slice(0, 30)}"`,
      right,
    }));
  return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, offenders };
}

/** The design elements measured against the app's, by role. `design` is a CSS selector list of the artboards' classes (Homeowner's hm-*, Bedrock's br-*), `app` the `data-slot` Bedrock sets on the component root (bedrock/src; renaming one is a breaking change). `bedrock` says the app side is a Bedrock component, so a difference there is fixed in Bedrock. Roles an app does not render through Bedrock yet (web: list, row, field, segmented-control, dialog, bottom-bar, card; Revenue: list, field) show as count mismatches until those screens move to Bedrock (ADR 0030). */
export const ROLES = [
  { role: "list", design: ".hm-list, .br-list", app: "[data-slot=list]", bedrock: true },
  { role: "row", design: ".hm-item, .br-listrow", app: "[data-slot=row], [data-slot=list-row]", bedrock: true },
  { role: "page-header", design: ".hm-head", app: "[data-slot=page-header]", bedrock: true },
  { role: "search-field", design: ".br-search__box", app: "[data-slot=search-field]", bedrock: true },
  { role: "sheet", design: ".hm-sheet, .br-sheet", app: "[data-slot=sheet]", bedrock: true },
  { role: "dialog", design: ".hm-dialog, .br-dialog", app: "[data-slot=dialog]", bedrock: true },
  { role: "toast", design: ".hm-toast, .br-toast", app: "[data-slot=toast]", bedrock: true },
  { role: "field", design: ".hm-field, .br-field", app: "[data-slot=field]", bedrock: true },
  { role: "segmented-control", design: ".hm-seg, .br-seg", app: "[data-slot=segmented-control]", bedrock: true },
  { role: "bottom-bar", design: ".br-bottombar", app: "[data-slot=bottom-bar]", bedrock: true },
  { role: "choice-group", design: ".br-choices", app: "[data-slot=choice-group]", bedrock: true },
  { role: "step-indicator", design: ".br-stepper:has(.br-stepper__track)", app: "[data-slot=step-indicator]", bedrock: true },
  { role: "card", design: ".br-card", app: "[data-slot=card]", bedrock: true },
];

/** The selector of each role for one side, `side` being "app" or "design": what `measureBoxes` takes. */
export function roleSelectors(side) {
  return Object.fromEntries(ROLES.map((r) => [r.role, r[side]]));
}

/** Runs in the page: for each role of `selectors` ({role: css}), the visible matches in document order as {x, width, height, gap}. `gap` is the distance below the previous match of the role, null for the first; no absolute y, so a header shift is not repeated down the page. Uses nothing outside itself. */
export function measureBoxes(selectors) {
  const round = (n) => Math.round(n * 10) / 10;
  return Object.fromEntries(
    Object.entries(selectors).map(([role, selector]) => {
      let previous = null;
      const boxes = [...document.querySelectorAll(selector)]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          const box = { x: round(r.left), width: round(r.width), height: round(r.height), gap: previous === null ? null : round(r.top - previous) };
          previous = r.bottom;
          return box;
        });
      return [role, boxes];
    }),
  );
}

/** Compares measured boxes ({role: [{x, width, height, gap}]}) role by role and index. `diffs` holds every difference strictly over `threshold` px, and a different count as {role, prop: "count", app, design}; `small` counts the other non-zero ones. A gap that is null on either side (the first element) is not compared. */
export function compareBoxes(app, design, threshold = 4) {
  const diffs = [];
  let small = 0;
  for (const role of new Set([...Object.keys(app), ...Object.keys(design)])) {
    const a = app[role] ?? [];
    const d = design[role] ?? [];
    if (!a.length && !d.length) continue;
    if (a.length !== d.length) diffs.push({ role, prop: "count", app: a.length, design: d.length });
    for (let index = 0; index < Math.min(a.length, d.length); index++) {
      for (const prop of ["x", "width", "height", "gap"]) {
        if (a[index][prop] === null || d[index][prop] === null) continue;
        const delta = Math.abs(a[index][prop] - d[index][prop]);
        if (delta > threshold) diffs.push({ role, index, prop, app: a[index][prop], design: d[index][prop] });
        else if (delta > 0) small++;
      }
    }
  }
  return { diffs, small };
}

/** Most rows of one pair's table: GitHub caps a description at 65,536 characters, and a drifted frame can differ everywhere. The measure file keeps them all. */
export const MAX_TABLE_ROWS = 20;

/** The differences of a pair as one table row, on the pair's own line. `measure` is compareBoxes' answer; "" without any. */
function measureRow({ diffs, small }) {
  if (!diffs.length && !small) return "";
  const n = diffs.length;
  const rows = diffs.slice(0, MAX_TABLE_ROWS).map((d) => `<tr><td>${d.index === undefined ? d.role : `${d.role} #${d.index + 1}`}</td><td>${d.prop}</td><td>${d.app}</td><td>${d.design}</td></tr>`).join("");
  const more = n > MAX_TABLE_ROWS ? `<p>${n - MAX_TABLE_ROWS} more in the measure file</p>` : "";
  const table = n ? `<table><tr><th>Element</th><th>Property</th><th>App</th><th>Design</th></tr>${rows}</table>${more}` : "";
  return `<tr><td colspan="2"><details><summary>${n} difference${n === 1 ? "" : "s"} over 4px, ${small} smaller</summary>${table}</details></td></tr>`;
}

/** One HTML table per heading with App and Design side by side. `images` is { Mobile: [{ route, app, design, measure? }] } with URLs; `design` is null without an artboard, `measure` is compareBoxes' answer and adds a collapsed table of the differences under the pair. One line per heading, so withScreenshots drops it whole on a re-run: the details stay on that line. */
export function pairsMarkdown(images) {
  const cell = (url, alt) => (url ? `<td><img src="${url}" alt="${alt}"></td>` : "<td>no artboard</td>");
  return Object.fromEntries(
    Object.entries(images).map(([heading, rows]) => [
      heading,
      rows.length
        ? [`<table><tr><th>App</th><th>Design</th></tr>${rows.map(({ route, app, design, measure }) => `<tr><td colspan="2"><code>${route}</code></td></tr><tr>${cell(app, `${route} ${heading} app`)}${cell(design, `${route} ${heading} design`)}</tr>${measure ? measureRow(measure) : ""}`).join("")}</table>`]
        : [],
    ]),
  );
}
