import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mount } from "../testing";
import { StatusBadge, STATUS_TOKEN } from "./StatusBadge";
import type { StatusState } from "./thresholds";

const { render, container } = mount();

const STATES: StatusState[] = ["ok", "warn", "bad", "neutral"];

describe("StatusBadge", () => {
  it("shows its label as text and an aria-hidden icon, for every state", async () => {
    for (const state of STATES) {
      await render(<StatusBadge state={state} label={`Label ${state}`} />);
      expect(container().textContent).toBe(`Label ${state}`);
      const icon = container().querySelector("svg")!;
      expect(icon).not.toBeNull();
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("uses a different icon for each state, so colour is never the only cue", async () => {
    const shapes = new Set<string>();
    for (const state of STATES) {
      await render(<StatusBadge state={state} label="x" />);
      shapes.add(container().querySelector("svg")!.innerHTML);
    }
    expect(shapes.size).toBe(4);
  });

  it("has a border, so it survives forced-colours mode", async () => {
    await render(<StatusBadge state="warn" label="x" />);
    expect(container().firstElementChild!.className).toContain("border");
  });
});

// Contrast of each badge's text and border colour on surface-raised, in both themes. The tokens come from the shared
// file and from the admin's own index.css (the warning pair lives only there).
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
function tokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return Object.fromEntries(
    [...css.slice(start, end).matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1]!, m[2]!]),
  );
}

describe("badge contrast (AA, 4.5:1)", () => {
  const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");
  const shared = read("../../../web/src/tokens.css");
  const admin = read("../index.css");
  const light = { ...tokens(shared, "@theme"), ...tokens(admin, "@theme") };
  const dark = { ...light, ...tokens(shared, '[data-theme="dark"]'), ...tokens(admin, '[data-theme="dark"]') };

  for (const [theme, t] of [["light", light], ["dark", dark]] as const) {
    for (const state of STATES) {
      it(`${state} text and border on surface-raised in the ${theme} theme`, () => {
        const colour = t[STATUS_TOKEN[state]];
        expect(colour, `token ${STATUS_TOKEN[state]}`).toBeDefined();
        expect(contrast(colour!, t["surface-raised"]!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("defines the warning token for both themes in the admin's own css", () => {
    expect(tokens(admin, "@theme")["warning"]).toBeDefined();
    expect(tokens(admin, '[data-theme="dark"]')["warning"]).toBeDefined();
  });
});
