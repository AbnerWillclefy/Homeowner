// Axe in jsdom has no layout and no computed colour, so it cannot check contrast.
// Contrast is covered by src/tokens.test.ts; color-contrast is disabled below for that reason.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const NAMES = [
  "Button", "Input", "SearchField", "SegmentedControl", "Switch", "Card", "StatCard", "Amount", "Badge",
  "CategoryTag", "ListRow", "ProgressBar", "AlertCard", "Toast", "EmptyState", "Skeleton", "Sheet", "Dialog",
  "Sidebar", "BottomBar", "PaceChart", "DonutChart", "BarChart", "Banner", "Tooltip", "Menu", "Select", "Table",
];
const COMBOS = [
  ["dark", "pt-BR"],
  ["light", "pt-BR"],
  ["dark", "en"],
  ["light", "en"],
] as const;

async function expectNoViolations(overlay = false) {
  const { violations } = await axe.run(document.body, {
    rules: {
      "color-contrast": { enabled: false },
      // An open overlay is portaled out of <main> by design (Radix, vaul), so axe sees it outside any landmark.
      region: { enabled: !overlay },
    },
  });
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

const mount = (theme: string, locale: string) => {
  history.replaceState(null, "", `?theme=${theme}&locale=${locale}`);
  render(<App />);
};

afterEach(() => vi.unstubAllGlobals());

describe("showcase accessibility", () => {
  it.each(COMBOS)("has no axe violations in %s %s", async (theme, locale) => {
    mount(theme, locale);
    await expectNoViolations();
  }, 30_000);

  it("has a section for every component", () => {
    mount("dark", "en");
    for (const name of NAMES) expect(screen.getByRole("heading", { level: 2, name: new RegExp(`^${name}( /|$)`) })).toBeTruthy();
  });

  it.each([true, false])("has no axe violations with overlays open, wide screen %s", async (wide) => {
    vi.stubGlobal("matchMedia", () => ({ matches: wide, addEventListener() {}, removeEventListener() {} }));
    mount("dark", "en");
    const user = userEvent.setup();
    // Each overlay is modal, so open one, check, close, then the next.
    for (const [opener, closer, role] of [
      ["Open filters", "Close", "dialog"],
      ["Delete account", "Cancel", "alertdialog"],
      ["More actions", null, wide ? "menu" : "dialog"],
    ] as const) {
      await user.click(screen.getByRole("button", { name: opener }));
      expect(screen.getByRole(role)).toBeTruthy();
      await expectNoViolations(true);
      if (closer) await user.click(screen.getAllByRole("button", { name: closer }).at(-1)!);
      else await user.keyboard("{Escape}");
    }
    for (const name of ["Change category", "Connection failure", "Plain notice"]) {
      await user.click(screen.getByRole("button", { name }));
    }
    await expectNoViolations(true);
    await user.click(screen.getAllByRole("combobox", { name: "Account" })[0]);
    expect(screen.getByRole("listbox")).toBeTruthy();
    await expectNoViolations(true);
  }, 30_000);
});
