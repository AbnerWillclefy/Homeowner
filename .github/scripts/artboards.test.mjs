import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { withScreenshots } from "./bedrock-screenshots.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { artboardPath, heightFailures, leftoversIn, overflowOf, pairsMarkdown, serveArtboard, undersized } from "./artboards.mjs";

const prefix = "https://example.test/";
const images = {
  Mobile: [
    { route: "/goals", app: `${prefix}auto-revenue-goals-mobile-app.png`, design: `${prefix}auto-revenue-goals-mobile-design.png` },
    { route: "/plan", app: `${prefix}auto-revenue-plan-desktop-app.png`, design: null },
  ],
  Desktop: [],
};

test("pairs the app and the design, and says 'no artboard' for a missing side", () => {
  const { Mobile } = pairsMarkdown(images);
  assert.equal(Mobile.length, 1);
  const [both, none] = Mobile[0].split("<tr><td colspan");
  assert.match(both + none, /<th>App<\/th><th>Design<\/th>/);
  assert.match(Mobile[0], /alt="\/goals Mobile app"/);
  assert.match(Mobile[0], /alt="\/goals Mobile design"/);
  const plan = Mobile[0].slice(Mobile[0].indexOf("/plan"));
  assert.match(plan, /<img src="[^"]*plan-desktop-app\.png"[^>]*><\/td><td>no artboard<\/td>/);
  assert.equal(Mobile[0].match(/no artboard/g).length, 1);
});

test("a heading with no routes gets no lines", () => {
  assert.deepEqual(pairsMarkdown(images).Desktop, []);
});

test("shooting again replaces the table instead of piling up headers", () => {
  const md = pairsMarkdown({ Mobile: images.Mobile, Desktop: images.Mobile });
  const body = "Closes #1\n\n### Mobile\n\n### Desktop\n";
  const once = withScreenshots(body, prefix, md);
  assert.match(once, /<img src=/);
  assert.equal(withScreenshots(once, prefix, md), once);
});

test("routes support.js to the stand-in, bedrock to the design system, the rest to the directory", () => {
  const dir = resolve("/tmp/artboards");
  assert.match(artboardPath(dir, "/support.js"), /\.github\/scripts\/dc-runtime\.js$/);
  const bedrock = artboardPath(dir, "/ds/bedrock/tokens.css");
  assert.equal(bedrock, resolve(fileURLToPath(new URL("../../docs/design/bedrock/tokens.css", import.meta.url))));
  assert.equal(artboardPath(dir, "/Goals.dc.html"), join(dir, "Goals.dc.html"));
});

test("refuses a path that leaves the directory", () => {
  const dir = resolve("/tmp/artboards");
  for (const p of ["/../x", "/a/../../x", "/%2e%2e/x", "/ds/bedrock/../../x"]) assert.equal(artboardPath(dir, p), null, p);
});

test("finds each marker of the template language, and passes clean markup", () => {
  assert.equal(leftoversIn("<p>ok</p>"), null);
  assert.equal(leftoversIn("<p>{{x}}</p>"), "{{");
  assert.equal(leftoversIn("<sc-if value='a'></sc-if>"), "<sc-if");
  assert.equal(leftoversIn("<sc-for list='a'></sc-for>"), "<sc-for");
});

test("passes a page that fits and names the widest element of one that overflows", () => {
  assert.equal(overflowOf("/", { scrollWidth: 375, innerWidth: 375, offenders: [] }), null);
  const message = overflowOf("/more", { scrollWidth: 412, innerWidth: 375, offenders: [{ description: "<td> small", right: 390 }, { description: "<table> wide", right: 412 }] });
  assert.match(message, /\/more/);
  assert.match(message, /412px wide in a 375px/);
  assert.match(message, /<table> wide/);
  assert.doesNotMatch(message, /small/);
});

// A route that answers like Playwright's: fulfilling a file that is not there rejects.
function fakeRoute(url, resourceType) {
  const answers = [];
  return {
    answers,
    request: () => ({ url: () => url, resourceType: () => resourceType }),
    fulfill: async (answer) => {
      if (answer.path && !(await import("node:fs")).existsSync(answer.path)) throw new Error("ENOENT");
      answers.push(answer.status);
    },
  };
}

test("a stylesheet that is not there is reported, a missing script or image is not", async () => {
  const dir = mkdtempSync(join(tmpdir(), "artboards-"));
  writeFileSync(join(dir, "ok.css"), "a{}");
  const missing = [];
  const there = fakeRoute("http://artboard.test/ok.css", "stylesheet");
  await serveArtboard(there, dir, missing);
  assert.deepEqual([there.answers, missing], [[200], []]);
  const gone = fakeRoute("http://artboard.test/home.css", "stylesheet");
  await serveArtboard(gone, dir, missing);
  assert.deepEqual([gone.answers, missing], [[404], ["/home.css"]]);
  const outside = fakeRoute("http://artboard.test/..%2Fx.css", "stylesheet");
  await serveArtboard(outside, dir, missing);
  assert.deepEqual(missing, ["/home.css", "/..%2Fx.css"]);
  await serveArtboard(fakeRoute("http://artboard.test/logo.png", "image"), dir, missing);
  assert.equal(missing.length, 2);
});

test("undersized: an element shorter than it declares, or at zero, fails", () => {
  assert.equal(undersized(48, 26), true); // the Chores search box before the fix
  assert.equal(undersized(48, 0), true);
  assert.equal(undersized(48, 48), false);
  assert.equal(undersized(48, 47.6), false);
  assert.equal(undersized(64, 80), false);
});

test("heightFailures names the file and the element, and keeps the exemption list honest", () => {
  const found = [{ description: '<label.br-search__box> "Buscar"', declared: 48, rendered: 26 }];
  const [message, ...more] = heightFailures("homeowner/Chores.dc.html", found, {});
  assert.equal(more.length, 0);
  assert.match(message, /^homeowner\/Chores\.dc\.html: <label\.br-search__box>.* declares 48px but renders 26px$/);
  const exempt = { "homeowner/Chores.dc.html": "reason" };
  assert.deepEqual(heightFailures("homeowner/Chores.dc.html", found, exempt), []);
  assert.match(heightFailures("homeowner/Chores.dc.html", [], exempt)[0], /remove it from HEIGHT_EXEMPT/);
  assert.deepEqual(heightFailures("homeowner/Chores.dc.html", [], {}), []);
});
