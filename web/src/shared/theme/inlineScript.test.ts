import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { resolveTheme, THEME_COLORS } from "./theme";

// The pre-render script in index.html cannot import theme.ts, so this test runs
// the real script text against fakes and checks it agrees with resolveTheme.
const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const match = /<script id="theme-init">([\s\S]*?)<\/script>/.exec(html);

interface Fakes {
  getItem?: (key: string) => unknown;
  prefersLight?: boolean;
  noMatchMedia?: boolean;
}

function runScript({ getItem, prefersLight = false, noMatchMedia = false }: Fakes) {
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
  if (!noMatchMedia) sandbox.matchMedia = () => ({ matches: prefersLight });
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
    for (const systemPrefersLight of [true, false]) {
      const { theme } = runScript({ getItem: () => value, prefersLight: systemPrefersLight });
      expect(theme).toBe(resolveTheme({ stored: value, systemPrefersLight }).applied);
    }
  });

  it("reads the homeowner.theme key", () => {
    const keys: string[] = [];
    runScript({ getItem: (key) => (keys.push(key), null) });
    expect(keys).toEqual(["homeowner.theme"]);
  });

  it("is dark with nothing stored and no stated preference", () => {
    expect(runScript({ prefersLight: false }).theme).toBe("dark");
  });

  it("keeps light for a light OS with nothing stored", () => {
    expect(runScript({ prefersLight: true }).theme).toBe("light");
  });

  it("lets a stored light beat a dark OS, and a stored dark beat a light OS", () => {
    expect(runScript({ getItem: () => "light", prefersLight: false }).theme).toBe("light");
    expect(runScript({ getItem: () => "dark", prefersLight: true }).theme).toBe("dark");
  });

  it("falls back to the system when storage throws, and to dark with no preference", () => {
    const throwing = () => {
      throw new Error("blocked");
    };
    expect(runScript({ getItem: throwing, prefersLight: true }).theme).toBe("light");
    expect(runScript({ getItem: throwing, prefersLight: false }).theme).toBe("dark");
  });

  it("uses dark when matchMedia is missing", () => {
    expect(runScript({ noMatchMedia: true }).theme).toBe("dark");
    expect(runScript({ getItem: () => "light", noMatchMedia: true }).theme).toBe("light");
  });

  it("sets the status bar colour to match", () => {
    expect(runScript({ getItem: () => "dark" }).themeColor).toBe(THEME_COLORS.dark);
    expect(runScript({ getItem: () => "light" }).themeColor).toBe(THEME_COLORS.light);
  });
});
