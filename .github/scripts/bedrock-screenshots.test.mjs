import assert from "node:assert/strict";
import { test } from "node:test";
import { changedSections, withScreenshots } from "./bedrock-screenshots.mjs";

const prefix = "https://raw.githubusercontent.com/o/r/screenshots/b/";
const images = { "pt-BR": [`![Toast pt-BR](${prefix}auto-Toast-pt-BR.png)`], English: [`![Toast English](${prefix}auto-Toast-en.png)`] };

test("matches sections by their showcase file or their component file", () => {
  const changed = ["bedrock/src/finance/alert-card.tsx", "bedrock/showcase/sections/Toast.tsx", "bedrock/src/index.ts"];
  assert.deepEqual(changedSections(["AlertCard", "Button", "Toast"], changed), ["AlertCard", "Toast"]);
});

test("picks no section when a shared file changed too, so the whole page is shot", () => {
  const changed = ["bedrock/src/components/button.tsx", "bedrock/src/tokens.css"];
  assert.deepEqual(changedSections(["Button", "Toast"], changed), []);
});

test("puts the images under existing headings, keeping the text there", () => {
  const body = "Closes #1\r\n\r\n### pt-BR\r\n\r\nNo browser.\r\n\r\n### English\r\nNo browser.\r\n\r\nfooter";
  assert.equal(
    withScreenshots(body, prefix, images),
    `Closes #1\n\n### pt-BR\n\n${images["pt-BR"][0]}\n\nNo browser.\n\n### English\n\n${images.English[0]}\n\nNo browser.\n\nfooter`,
  );
});

test("adds missing headings at the end", () => {
  assert.equal(withScreenshots("Closes #1", prefix, images), `Closes #1\n\n### pt-BR\n\n${images["pt-BR"][0]}\n\n### English\n\n${images.English[0]}`);
});

test("a second run replaces its own images instead of stacking them", () => {
  const once = withScreenshots("Closes #1\n\n### pt-BR\n\n### English\n", prefix, images);
  assert.equal(withScreenshots(once, prefix, images), once);
});

test("skips the template's commented-out headings", () => {
  const body = "Closes #1\n\n<!--\nUI changes only.\n\n### pt-BR\n\n### English\n-->";
  assert.equal(withScreenshots(body, prefix, images), `${body}\n\n### pt-BR\n\n${images["pt-BR"][0]}\n\n### English\n\n${images.English[0]}`);
});
