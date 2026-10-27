import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { mount } from "../testing";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { EnvironmentSwitch } from "./EnvironmentSwitch";
import { MismatchBanner } from "./MismatchBanner";

const { render, container } = mount();

describe("MismatchBanner", () => {
  it("is an alert naming both environments when they differ", async () => {
    await render(<MismatchBanner build="staging" server="production" />);
    const alert = container().querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("This build says staging but the API says production");
  });

  it("is hidden when they match, or before the API has answered", async () => {
    await render(<MismatchBanner build="staging" server="staging" />);
    expect(container().querySelector('[role="alert"]')).toBeNull();
    await render(<MismatchBanner build="staging" server={undefined} />);
    expect(container().querySelector('[role="alert"]')).toBeNull();
  });
});

describe("EnvironmentSwitch", () => {
  const urls = { production: "https://admin.example.com" };

  it("links to the other environment's admin with the same path and query", async () => {
    await render(
      <MemoryRouter initialEntries={["/ai?range=7d"]}>
        <EnvironmentSwitch current="staging" urls={urls} />
      </MemoryRouter>,
    );
    const link = container().querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://admin.example.com/ai?range=7d");
    expect(link.getAttribute("aria-label")).toBe("Switch to production admin");
  });

  it("is disabled text, not a link, when the URL is not configured", async () => {
    await render(
      <MemoryRouter>
        <EnvironmentSwitch current="staging" urls={{}} />
      </MemoryRouter>,
    );
    expect(container().querySelector("a")).toBeNull();
    expect(container().textContent).toBe("Production URL not configured");
  });

  it("shows no switch in local with no other entries", async () => {
    await render(
      <MemoryRouter>
        <EnvironmentSwitch current="local" urls={{ local: "http://localhost:5174" }} />
      </MemoryRouter>,
    );
    expect(container().textContent).toBe("");
  });
});

describe("EnvironmentBadge", () => {
  it("says the environment in text, for every environment", async () => {
    for (const environment of ["local", "staging", "production"] as const) {
      await render(<EnvironmentBadge environment={environment} />);
      expect(container().textContent).toBe(`Environment: ${environment.toUpperCase()}`);
    }
  });

  it("has different looks for staging and production", async () => {
    await render(<EnvironmentBadge environment="staging" />);
    const staging = container().firstElementChild!.className;
    await render(<EnvironmentBadge environment="production" />);
    expect(container().firstElementChild!.className).not.toBe(staging);
  });
});

// Contrast of the badge colour pairs in both themes, read from the shared token file.
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
  const css = readFileSync(resolve(import.meta.dirname, "../../../web/src/tokens.css"), "utf8");
  const light = tokens(css, "@theme");
  const dark = { ...light, ...tokens(css, '[data-theme="dark"]') };

  for (const [theme, t] of [["light", light], ["dark", dark]] as const) {
    it(`production, staging and local text in the ${theme} theme`, () => {
      expect(contrast(t["surface-raised"]!, t["danger"]!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["accent-contrast"]!, t["accent"]!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["text"]!, t["surface-raised"]!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
