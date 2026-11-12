// Screenshots the Bedrock showcase sections a pull request changes, in pt-BR and English,
// and prints the pull request description with them under "### pt-BR" and "### English".
// Usage: CHANGED=<files> BODY=<description> BASE_URL=<showcase> PLAYWRIGHT_DIR=<dir with playwright>
//        node bedrock-screenshots.mjs <out dir> <image url prefix>
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const locales = [
  { heading: "pt-BR", locale: "pt-BR", suffix: "pt-BR" },
  { heading: "English", locale: "en", suffix: "en" },
];

// "alert-card.tsx" and "AlertCard.tsx" both name the AlertCard section.
const key = (file) => file.replace(/^.*\//, "").replace(/\.tsx?$/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

/** The sections whose own file, or whose component's file, changed. */
export function changedSections(sections, changedFiles) {
  const changed = new Set(changedFiles.map(key));
  return sections.filter((s) => changed.has(key(s)));
}

/** The description with this script's earlier images replaced by `images` ({ "pt-BR": [md], English: [md] }). */
export function withScreenshots(body, prefix, images) {
  let lines = body.replace(/\r/g, "").split("\n").filter((l) => !l.includes(`${prefix}auto-`));
  for (const { heading } of locales) {
    // The template's headings sit in an HTML comment; images there would not show.
    let comment = false;
    const at = lines.findIndex((l) => {
      if (l.includes("<!--")) comment = !l.slice(l.lastIndexOf("<!--")).includes("-->");
      else if (l.includes("-->")) comment = false;
      return !comment && new RegExp(`^### *${heading} *$`).test(l);
    });
    if (at < 0) {
      lines.push("", `### ${heading}`, "", ...images[heading]);
      continue;
    }
    let next = at + 1;
    while (next < lines.length && lines[next].trim() === "") next++;
    lines = [...lines.slice(0, at + 1), "", ...images[heading], "", ...lines.slice(next)];
  }
  return lines.join("\n");
}

async function main([outDir, prefix]) {
  const { chromium } = createRequire(join(process.env.PLAYWRIGHT_DIR, "noop.js"))("playwright");
  const changed = process.env.CHANGED.split("\n").filter(Boolean);
  const browser = await chromium.launch();
  const images = {};
  for (const { heading, locale, suffix } of locales) {
    // Light theme and a phone viewport, as a Resident sees it by default (frontend-engineer.md).
    const page = await browser.newPage({ locale, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await page.goto(`${process.env.BASE_URL}/?theme=light&locale=${locale}`);
    await page.evaluate(() => document.fonts.ready);
    const all = await page.$$eval("[data-section]", (els) => els.map((e) => e.dataset.section));
    const picked = changedSections(all, changed);
    images[heading] = [];
    // A change no single section owns (tokens, the showcase frame) gets the whole page.
    for (const name of picked.length ? picked : ["showcase"]) {
      const file = `auto-${name}-${suffix}.png`;
      const target = name === "showcase" ? page : page.locator(`[data-section="${name}"]`);
      await target.screenshot({ path: join(outDir, file), ...(name === "showcase" && { fullPage: true }) });
      images[heading].push(`![${name} ${heading}](${prefix}${file})`);
    }
    await page.close();
  }
  await browser.close();
  process.stdout.write(withScreenshots(process.env.BODY, prefix, images));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
