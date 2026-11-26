import assert from "node:assert/strict";
import { test } from "node:test";
import { pairsMarkdown } from "./artboards.mjs";
import { withScreenshots } from "./bedrock-screenshots.mjs";
import { rowsFrom } from "./web-screenshots.mjs";

const prefix = "https://example.test/";
const row = (artboard, route, extra = {}) => ({ artboard, route, app: `auto-web-${artboard.toLowerCase()}-mobile-app.png`, design: `auto-web-${artboard.toLowerCase()}-mobile-design.png`, overflow: null, exempt: false, ...extra });

test("an overflow that is not exempt is returned with its message, so the check fails", () => {
  const message = "Chores scrolls sideways: page is 412px wide in a 390px viewport; widest element <table> wide ends at 412px";
  const { overflowing } = rowsFrom([row("Main", "/"), row("Chores", "/chores", { overflow: message })], prefix);
  assert.deepEqual(overflowing, [message]);
  assert.match(overflowing[0], /<table> wide/);
});

test("an exempt overflow does not fail the check", () => {
  const { overflowing } = rowsFrom([row("Chores", "/chores", { overflow: "wide", exempt: true })], prefix);
  assert.deepEqual(overflowing, []);
});

test("the rows come out as one pt-BR table, labelled by route and artboard, with both images", () => {
  const { rows } = rowsFrom([row("Main", "/"), row("CheckIn", "/")], prefix);
  const md = pairsMarkdown({ "pt-BR": rows });
  assert.deepEqual(Object.keys(md), ["pt-BR"]);
  assert.equal(md["pt-BR"].length, 1);
  assert.match(md["pt-BR"][0], /<code>\/ · CheckIn<\/code>[\s\S]*<code>\/ · Main<\/code>/);
  assert.match(md["pt-BR"][0], /src="https:\/\/example\.test\/auto-web-main-mobile-design\.png"/);
  assert.doesNotMatch(md["pt-BR"][0], /no artboard/);
});

test("a Revenue table already in the description survives the web table, and an old web table is replaced", () => {
  const rev = `![](${prefix}auto-revenue-home-mobile.png)`;
  const old = `![](${prefix}auto-web-old.png)`;
  const body = `### Mobile\n\n${rev}\n\n### pt-BR\n\n${old}\n`;
  const out = withScreenshots(body, prefix, { "pt-BR": [`![](${prefix}auto-web-new.png)`] }, `${prefix}auto-web-`);
  assert.ok(out.includes(rev));
  assert.ok(!out.includes(old));
  assert.ok(out.includes("auto-web-new.png"));
});
