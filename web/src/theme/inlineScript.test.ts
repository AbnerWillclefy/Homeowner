import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

// The pre-render script in index.html cannot import theme.ts, so this test runs
// the real script text against fakes and checks it agrees with resolveTheme.
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const match = /<script id="theme-init">([\s\S]*?)<\/script>/.exec(html);

interface Fakes {
  getItem?: (key: string) => unknown;
  prefersDark?: boolean;
  noMatchMedia?: boolean;
}

function runScript({ getItem, prefersDark = false, noMatchMedia = false }: Fakes) {
  const dataset: Record<string, string> = {};
  const meta = {
    content: "unset",
    setAttribute(_name: string, value: string) {
      this.content = value;
    },
  };
  const sandbox: Record<string, unknown> = {
    document: {
      documentElement: { dataset },
      querySelector: () => meta,
    },
    localStorage: { getItem: getItem ?? (() => null) },
  };
  if (!noMatchMedia) sandbox.matchMedia = () => ({ matches: prefersDark });
  sandbox.window = sandbox;
  runInNewContext(match![1]!, sandbox);
  return { theme: dataset.theme, themeColor: meta.content };
}

describe("theme-init script in index.html", () => {
  it("exists", () => {
    expect(match).not.toBeNull();
  });

  const stored: unknown[] = ["dark", "light", "system", null, "Dark", "sepia", "", " dark ", "null", 42, {}];
  it.each(stored)("agrees with resolveTheme for stored %j", (value) => {
    for (const systemPrefersDark of [true, false]) {
      const { theme } = runScript({ getItem: () => value, prefersDark: systemPrefersDark });
      expect(theme).toBe(resolveTheme({ stored: value, systemPrefersDark }).applied);
    }
  });

  it("reads the homeowner.theme key", () => {
    const keys: string[] = [];
    runScript({ getItem: (key) => (keys.push(key), null) });
    expect(keys).toEqual(["homeowner.theme"]);
  });

  it("falls back to the system when storage throws", () => {
    const throwing = () => {
      throw new Error("blocked");
    };
    expect(runScript({ getItem: throwing, prefersDark: true }).theme).toBe("dark");
    expect(runScript({ getItem: throwing, prefersDark: false }).theme).toBe("light");
  });

  it("uses light when matchMedia is missing", () => {
    expect(runScript({ noMatchMedia: true }).theme).toBe("light");
    expect(runScript({ getItem: () => "dark", noMatchMedia: true }).theme).toBe("dark");
  });

  it("sets the status bar colour to match", () => {
    expect(runScript({ getItem: () => "dark" }).themeColor).toBe("#121816");
    expect(runScript({ getItem: () => "light" }).themeColor).toBe("#f7f8f5");
  });
});
