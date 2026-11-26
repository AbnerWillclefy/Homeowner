import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { withScreenshots } from "./bedrock-screenshots.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { artboardPath, compareBoxes, heightFailures, leftoversIn, overflowOf, MAX_TABLE_ROWS, pairsMarkdown, roleSelectors, ROLES, serveArtboard, undersized } from "./artboards.mjs";

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

const box = (extra = {}) => ({ x: 16, width: 358, height: 64, gap: 0, ...extra });

test("a row of 72px against 64px (12px against 8px padding) is one height difference", () => {
  const { diffs, small } = compareBoxes({ row: [box({ height: 72 })] }, { row: [box()] });
  assert.deepEqual(diffs, [{ role: "row", index: 0, prop: "height", app: 72, design: 64 }]);
  assert.equal(small, 0);
});

test("a 3px difference is counted as small, 4px too, and 5px is a difference", () => {
  const three = compareBoxes({ row: [box({ height: 67 })] }, { row: [box()] });
  assert.deepEqual(three, { diffs: [], small: 1 });
  assert.equal(compareBoxes({ row: [box({ height: 68 })] }, { row: [box()] }).diffs.length, 0);
  assert.equal(compareBoxes({ row: [box({ height: 69 })] }, { row: [box()] }).diffs.length, 1);
});

test("x, width and the gap above are compared too, and a first element has no gap", () => {
  const { diffs } = compareBoxes({ row: [box({ gap: null }), box({ x: 24, width: 342, gap: 16 })] }, { row: [box({ gap: null }), box({ gap: 0 })] });
  assert.deepEqual(diffs.map((d) => d.prop), ["x", "width", "gap"]);
  assert.ok(diffs.every((d) => d.index === 1));
});

test("three rows in the app against five in the artboard is a count difference, and the first three still compare", () => {
  const { diffs } = compareBoxes({ row: [box(), box(), box({ height: 80 })] }, { row: [box(), box(), box(), box(), box()] });
  assert.deepEqual(diffs, [
    { role: "row", prop: "count", app: 3, design: 5 },
    { role: "row", index: 2, prop: "height", app: 80, design: 64 },
  ]);
});

test("a role missing on one side is a count difference, and a role on neither side is nothing", () => {
  assert.deepEqual(compareBoxes({ "bottom-bar": [] }, { "bottom-bar": [box()] }).diffs, [{ role: "bottom-bar", prop: "count", app: 0, design: 1 }]);
  assert.deepEqual(compareBoxes({ row: [] }, {}), { diffs: [], small: 0 });
});

test("roles stay separate: a list box never matches a row box", () => {
  const { diffs } = compareBoxes({ list: [box({ height: 200 })], row: [box()] }, { list: [box({ height: 200 })], row: [box({ height: 200 })] });
  assert.deepEqual(diffs, [{ role: "row", index: 0, prop: "height", app: 64, design: 200 }]);
});

test("each role maps a design selector to the data-slot Bedrock sets, and the selectors per side are keyed by role", () => {
  assert.ok(ROLES.length >= 10);
  assert.ok(ROLES.every(({ role, design, app, bedrock }) => role && design && /^\[data-slot=/.test(app) && typeof bedrock === "boolean"));
  assert.equal(new Set(ROLES.map((r) => r.role)).size, ROLES.length);
  assert.match(roleSelectors("design").row, /\.hm-item/);
  assert.match(roleSelectors("design").row, /\.br-listrow/);
  assert.match(roleSelectors("app").row, /\[data-slot=row\]/);
  assert.match(roleSelectors("app").row, /\[data-slot=list-row\]/);
});

const measure = { diffs: [{ role: "row", index: 0, prop: "height", app: 72, design: 64 }, { role: "list", prop: "count", app: 1, design: 2 }], small: 5 };

test("a pair's differences are one details block on the same line as its table, in a row after the images", () => {
  const { Mobile } = pairsMarkdown({ Mobile: [{ ...images.Mobile[0], measure }] });
  assert.equal(Mobile.length, 1);
  assert.ok(!Mobile[0].includes("\n"));
  assert.match(Mobile[0], /<\/tr><tr><td colspan="2"><details><summary>2 differences over 4px, 5 smaller<\/summary><table>/);
  assert.match(Mobile[0], /<td>row #1<\/td><td>height<\/td><td>72<\/td><td>64<\/td>/);
  assert.match(Mobile[0], /<td>list<\/td><td>count<\/td><td>1<\/td><td>2<\/td>/);
});

test("a pair with only small differences says how many, and one with none shows no details", () => {
  const small = pairsMarkdown({ Mobile: [{ ...images.Mobile[0], measure: { diffs: [], small: 3 } }] }).Mobile[0];
  assert.match(small, /0 differences over 4px, 3 smaller/);
  assert.doesNotMatch(pairsMarkdown({ Mobile: [{ ...images.Mobile[0], measure: { diffs: [], small: 0 } }] }).Mobile[0], /details/);
  assert.doesNotMatch(pairsMarkdown(images).Mobile[0], /details/);
});

test("a long table is cut at the cap and says how many are in the measure file", () => {
  const diffs = Array.from({ length: MAX_TABLE_ROWS + 7 }, (_, i) => ({ role: "row", index: i, prop: "height", app: 80, design: 64 }));
  const line = pairsMarkdown({ Mobile: [{ ...images.Mobile[0], measure: { diffs, small: 0 } }] }).Mobile[0];
  assert.equal(line.match(/<td>row #/g).length, MAX_TABLE_ROWS);
  assert.match(line, /7 more in the measure file/);
  assert.match(line, new RegExp(`${MAX_TABLE_ROWS + 7} differences over 4px`));
  const exact = pairsMarkdown({ Mobile: [{ ...images.Mobile[0], measure: { diffs: diffs.slice(0, MAX_TABLE_ROWS), small: 0 } }] }).Mobile[0];
  assert.doesNotMatch(exact, /more in the measure file/);
});

test("shooting again with differences replaces the whole pair instead of piling up", () => {
  const md = pairsMarkdown({ Mobile: images.Mobile.map((r) => ({ ...r, measure })), Desktop: [] });
  const body = "Closes #1\n\n### Mobile\n\n### Desktop\n";
  const once = withScreenshots(body, prefix, md);
  assert.match(once, /<details>/);
  assert.equal(withScreenshots(once, prefix, md), once);
  assert.equal(once.match(/<details>/g).length, 2);
});
