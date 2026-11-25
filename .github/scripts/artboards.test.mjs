import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { withScreenshots } from "./bedrock-screenshots.mjs";
import { artboardPath, leftoversIn, pairsMarkdown } from "./artboards.mjs";

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
